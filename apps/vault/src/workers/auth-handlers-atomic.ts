/**
 * Atomic Auth Message Handlers
 *
 * Simple, atomic auth operations using SessionStateManager.
 * Replaces the complex multi-source auth logic.
 *
 * Broadcasts AUTH_STATE_CHANGED event after state changes.
 */

import { getSessionStateManager, type CompleteSessionState } from './session-state-manager';
import { cryptoPrimitives } from './crypto-primitives';

/**
 * Broadcast auth state change to all tabs via BroadcastChannel
 * Note: In SharedWorker context, we can't use self.postMessage
 */
function broadcastAuthStateChanged(state: CompleteSessionState | null) {
  const message = {
    type: 'AUTH_STATE_CHANGED',
    state: state ? {
      isAuthenticated: state.isAuthenticated,
      isLocked: !state.isUnlocked,
      user: state.username ? {
        username: state.username,
        displayName: state.displayName || state.username,
        publicKey: state.publicKey,
        storagePublicKey: state.storagePublicKey
      } : null,
      sessionId: state.sessionId,
      vaultVersion: state.vaultVersion,
      identityCount: state.identityCount,
      environment: state.environment,
      authProvider: state.authProvider  // Include auth method (username or google)
    } : {
      isAuthenticated: false,
      isLocked: true,
      user: null,
      sessionId: null,
      authProvider: null
    }
  };

  // Send to all tabs via BroadcastChannel (for vault iframes)
  try {
    const channel = new BroadcastChannel('nostrpass-vault');
    channel.postMessage(message);
    channel.close();
  } catch (error) {
    console.error('[auth-handlers-atomic] Failed to broadcast via BroadcastChannel:', error);
  }

  // Also send to all SharedWorker ports (for direct worker connections)
  try {
    const ports = (globalThis as any).__SHARED_WORKER_PORTS__;
    if (ports && ports.size > 0) {
      console.log(`[auth-handlers-atomic] Broadcasting AUTH_STATE_CHANGED to ${ports.size} SharedWorker ports`);
      ports.forEach((port: MessagePort) => {
        try {
          port.postMessage(message);
        } catch (error) {
          console.error('[auth-handlers-atomic] Failed to post to port:', error);
        }
      });
    }
  } catch (error) {
    console.error('[auth-handlers-atomic] Failed to broadcast to SharedWorker ports:', error);
  }
}

/**
 * Get current auth state
 * ONE call returns complete state - no piecing together
 */
export async function handleGetAuthState(params: { username?: string }) {
  const manager = getSessionStateManager();

  // Try to restore session from IndexedDB if no in-memory session exists
  if (!manager.getAuthState(params.username)) {
    await manager.restoreFromDB();
  }

  const state = manager.getAuthState(params.username);

  if (!state) {
    return {
      isAuthenticated: false,
      isLocked: true,
      user: null,
      sessionId: null,
      timestamp: Date.now()
    };
  }

  return {
    isAuthenticated: state.isAuthenticated,
    isLocked: !state.isUnlocked,
    user: {
      username: state.username,
      displayName: state.displayName || state.username,
      publicKey: state.publicKey,
      storagePublicKey: state.storagePublicKey
    },
    sessionId: state.sessionId,
    vaultVersion: state.vaultVersion,
    identityCount: state.identityCount,
    environment: state.environment,
    authProvider: state.authProvider,  // Include auth method (username or google)
    timestamp: Date.now()
  };
}

/**
 * Atomic login
 * Fetches from Nostr and creates session in ONE operation
 */
export async function handleAtomicLogin(params: {
  username?: string;
  identifier?: string;  // Alias for username (used by Google auth flow)
  identifierType?: 'username' | 'google';
  password: string;
  relays: string[];
  environment?: string;
  displayName?: string;
  vaultDTag?: string;  // For multi-vault Google auth: specific d-tag to fetch
  vaultPasswordSalt?: string;  // For multi-vault: password salt from vault picker
}) {
  const manager = getSessionStateManager();

  // Support both 'username' and 'identifier' parameter names
  const username = params.username || params.identifier;

  const session = await manager.login({
    username: username!,
    password: params.password,
    relays: params.relays,
    environment: params.environment,
    identifierType: params.identifierType || 'username',
    displayName: params.displayName,
    vaultDTag: params.vaultDTag,
    vaultPasswordSalt: params.vaultPasswordSalt
  });

  // Broadcast state change
  broadcastAuthStateChanged(session);

  return {
    success: true,
    session: {
      username: session.username,
      sessionId: session.sessionId,
      isAuthenticated: session.isAuthenticated,
      isUnlocked: session.isUnlocked
    }
  };
}

/**
 * Atomic unlock
 * Decrypts keys and updates session in ONE operation
 */
export async function handleAtomicUnlock(params: {
  username: string;
  pin: string;
}) {
  const manager = getSessionStateManager();

  const session = await manager.unlock({
    username: params.username,
    pin: params.pin,
    cryptoPrimitives
  });

  // Restart Nostr subscription now that we have storage keys for decryption
  try {
    const { nostrSync } = await import('./nostr-sync');
    const defaultRelays = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.primal.net',
      'wss://relay.nostr.band',
      'ws://localhost:8080',
    ];
    await nostrSync.startNostrSubscription({
      username: params.username,
      relays: session.relays || defaultRelays
    });
    console.log('[handleAtomicUnlock] Nostr subscription restarted after unlock');
  } catch (error) {
    console.warn('[handleAtomicUnlock] Failed to restart Nostr subscription:', error);
  }

  // Broadcast state change
  broadcastAuthStateChanged(session);

  return {
    success: true,
    session: {
      username: session.username,
      publicKey: session.publicKey,
      isUnlocked: session.isUnlocked,
      vaultVersion: session.vaultVersion,
      identityCount: session.identityCount
    }
  };
}

/**
 * Atomic logout
 * Clears everything in ONE operation
 */
export async function handleAtomicLogout(params: { username: string }) {
  const manager = getSessionStateManager();
  await manager.logout(params.username);

  // Broadcast state change (logged out)
  broadcastAuthStateChanged(null);

  return {
    success: true
  };
}

/**
 * Lock session
 */
export async function handleLockSession(params: { username: string }) {
  const manager = getSessionStateManager();
  manager.lockSession(params.username);

  // Stop Nostr subscription since we can't decrypt without storage keys
  try {
    const { nostrSync } = await import('./nostr-sync');
    await nostrSync.stopNostrSubscription({ username: params.username });
    console.log('[handleLockSession] Nostr subscription stopped on lock');
  } catch (error) {
    console.warn('[handleLockSession] Failed to stop Nostr subscription:', error);
  }

  // Broadcast state change (locked)
  const state = manager.getAuthState(params.username);
  broadcastAuthStateChanged(state);

  return {
    success: true
  };
}

/**
 * Get vault data from session
 */
export async function handleGetVaultDataFromSession(params: { username: string }) {
  const manager = getSessionStateManager();
  // Access full session directly (getAuthState doesn't include vaultData)
  const session = (manager as any).sessions.get(params.username);

  if (!session || !session.vaultData) {
    return null;
  }

  return session.vaultData;
}

/**
 * Update vault metadata
 */
export async function handleUpdateVaultMetadata(params: {
  username: string;
  vaultVersion?: number;
  identityCount?: number;
}) {
  const manager = getSessionStateManager();
  manager.updateVaultMetadata(params.username, {
    vaultVersion: params.vaultVersion,
    identityCount: params.identityCount
  });

  return {
    success: true
  };
}

/**
 * Check if session is valid
 */
export async function handleHasValidSession(params: { username?: string }) {
  const manager = getSessionStateManager();
  const hasSession = manager.hasValidSession(params.username);

  return {
    hasSession,
    activeSessions: manager.getActiveSessions()
  };
}
