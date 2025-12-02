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
 * Broadcast auth state change to main thread and all tabs
 */
function broadcastAuthStateChanged(state: CompleteSessionState | null) {
  const message = {
    type: 'AUTH_STATE_CHANGED',
    state: state ? {
      isAuthenticated: state.isAuthenticated,
      isLocked: !state.isUnlocked,
      user: state.username ? {
        username: state.username,
        publicKey: state.publicKey,
        storagePublicKey: state.storagePublicKey
      } : null,
      sessionId: state.sessionId,
      vaultVersion: state.vaultVersion,
      identityCount: state.identityCount
    } : {
      isAuthenticated: false,
      isLocked: true,
      user: null,
      sessionId: null
    }
  };

  // Send to main thread
  self.postMessage(message);

  // Send to all tabs via BroadcastChannel
  try {
    const channel = new BroadcastChannel('nostrpass-vault');
    channel.postMessage(message);
    channel.close();
  } catch (error) {
    console.error('[auth-handlers-atomic] Failed to broadcast:', error);
  }
}

/**
 * Get current auth state
 * ONE call returns complete state - no piecing together
 */
export async function handleGetAuthState(params: { username?: string }) {
  const manager = getSessionStateManager();
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
      publicKey: state.publicKey,
      storagePublicKey: state.storagePublicKey
    },
    sessionId: state.sessionId,
    vaultVersion: state.vaultVersion,
    identityCount: state.identityCount,
    timestamp: Date.now()
  };
}

/**
 * Atomic login
 * Fetches from Nostr and creates session in ONE operation
 */
export async function handleAtomicLogin(params: {
  username: string;
  password: string;
  relays: string[];
  environment?: string;
}) {
  const manager = getSessionStateManager();

  const session = await manager.login({
    username: params.username,
    password: params.password,
    relays: params.relays,
    environment: params.environment
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
  const state = manager.getAuthState(params.username);

  if (!state || !state.vaultData) {
    return null;
  }

  return state.vaultData;
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
