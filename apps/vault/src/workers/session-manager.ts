/**
 * Session Manager Module
 *
 * Manages user sessions, authentication state, and session-aware cryptographic operations.
 * This module handles:
 * - Session lifecycle (init, unlock, lock, logout)
 * - Vault operations (create, unlock, recover)
 * - Session-aware crypto operations (sign, encrypt, decrypt)
 * - Permission management
 * - Session state tracking and expiration
 *
 * Architecture:
 * - Sessions are stored in-memory with sensitive key material
 * - Sessions expire after 30 minutes of inactivity
 * - PIN attempts are tracked to prevent brute force
 * - All operations require active, unlocked sessions
 * - Broadcasts session state changes to all tabs via BroadcastChannel
 */

import { NostrCrypto } from './crypto.noble';
import { encrypt as nip04EncryptJS, decrypt as nip04DecryptJS } from 'nostr-tools/nip04';
import { vaultDB, type VaultData, type UserSession } from './db';
import { getEnvironment } from '@nostrpass/nostrHelpers';
import { PERMISSION_KINDS, type PermissionLevel } from '@nostrpass/types';
import { cryptoPrimitives } from './crypto-primitives';
import { nostrSync } from './nostr-sync';

// Singleton crypto instance for session manager operations
const crypto = new NostrCrypto();
import type {
  CreateVaultParams,
  CreateVaultResult,
  UnlockVaultParams,
  UnlockVaultResult,
  LockVaultParams,
  GetSessionParams,
  GetSessionResult,
  RecoverVaultParams,
  RecoverVaultResult,
  UpdateVaultRecoveryParams,
  CheckVaultExistsParams,
  CheckVaultExistsResult,
  DeleteVaultParams,
  DeleteVaultResult,
} from '@nostrpass/types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Extended session interface with recovery and crypto material
 * Extends UserSession with additional fields needed for session management
 */
interface ExtendedSession extends UserSession {
  recoveryQuestions?: string[];
  answers?: string[];
  xpriv?: string;
  // Cache storage keypair derived from xpriv to allow publishing without re-supplying xpriv
  storagePrivateKey?: string;
  storagePublicKey?: string;
  // Cache password key for vault encryption operations
  passwordKey?: string;
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * In-memory session storage (sensitive data)
 * Maps username to active session with decrypted keys
 */
export const activeSessions = new Map<string, ExtendedSession>();

/**
 * PIN attempt tracking to prevent brute force attacks
 * Maps username to attempt count and timestamp
 */
const pinAttempts = new Map<string, { count: number; lastAttempt: number }>();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Log session state changes for debugging
 * Stores session state in global object for inspection
 */
export function logSessionState(action: string, username: string) {
  // Also log to a global for debugging
  (globalThis as any).__DEBUG_SESSIONS = {
    count: activeSessions.size,
    usernames: Array.from(activeSessions.keys()),
    lastAction: action,
    lastUsername: username,
    timestamp: new Date().toISOString()
  };
}

/**
 * Check if a session is already unlocked
 * Warns but does not throw to allow re-unlocking
 */
function ensureNotLocked(username: string) {
  const session = activeSessions.get(username);
  if (session?.isUnlocked) {
    console.warn(`[Worker] Session for ${username} is already unlocked`);
    // Don't throw - just warn. Allow re-unlocking.
  }
}

/**
 * Check if session has expired based on inactivity timeout
 * Sessions expire after 30 minutes of inactivity
 */
function isSessionExpired(session: ExtendedSession): boolean {
  if (!session.unlockedAt) return true;

  // Session expires after 30 minutes of inactivity
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
  const now = Date.now();
  const timeSinceUnlock = now - session.unlockedAt;

  return timeSinceUnlock > SESSION_TIMEOUT;
}

/**
 * Reset PIN attempt tracking for a user
 * Called after successful unlock
 */
function resetPinAttempts(username: string) {
  pinAttempts.delete(username);
}

/**
 * Restore active sessions from IndexedDB on worker startup
 * Creates locked session entries for all stored vaults
 */
async function restoreActiveSessions() {
  try {
    console.log('[Worker] Restoring active sessions from IndexedDB...');

    // Get all vault data from IndexedDB
    const allVaults = await vaultDB.getAllVaults();

    for (const vaultData of allVaults) {
      // Create a basic session entry for each vault (locked state)
      const session: ExtendedSession = {
        username: vaultData.username,
        publicKey: vaultData.publicKey,
        isUnlocked: false, // Sessions start locked after restart
        unlockedAt: Date.now()
      };

      activeSessions.set(vaultData.username, session);
      console.log('[Worker] Restored session for:', vaultData.username);
    }

    console.log('[Worker] Restored', activeSessions.size, 'sessions from IndexedDB');
  } catch (error) {
    console.error('[Worker] Failed to restore active sessions:', error);
  }
}

/**
 * Broadcast vault updates to all tabs via BroadcastChannel
 * Used to sync session state across multiple tabs/windows
 */
function broadcastVaultUpdate(username: string, type: string, data: any) {
  try {
    console.log('[Worker] Broadcasting vault update:', { type, username, data });

    const message = {
      type: 'VAULT_BROADCAST',
      data: {
        broadcastType: type,
        username,
        timestamp: Date.now(),
        ...data
      }
    };

    // Broadcast to BroadcastChannel if available
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('nostrpass-vault');
      channel.postMessage(message);
      channel.close();
    }

    // Also send via postMessage for SharedWorker compatibility
    if (typeof self !== 'undefined' && 'clients' in self) {
      (self as any).clients.matchAll().then((clients: any[]) => {
        clients.forEach(client => client.postMessage(message));
      });
    }
  } catch (error) {
    console.error('[Worker] Failed to broadcast vault update:', error);
  }
}

// ============================================================================
// SESSION MANAGER
// ============================================================================

/**
 * Session manager object containing all session-related handlers
 * Exported as a single object for easy importing and testing
 */
export const sessionManager = {
  /**
   * Initialize crypto and restore sessions
   * Should be called before any session operations
   */
  async ensureCryptoReady(cryptoInstance: NostrCrypto | null): Promise<NostrCrypto> {
    if (!cryptoInstance) {
      throw new Error('Crypto instance not initialized');
    }

    // Restore active sessions from IndexedDB if not already done
    if (activeSessions.size === 0) {
      await restoreActiveSessions();
    }

    return cryptoInstance;
  },

  /**
   * Initialize a locked session by saving vault data and seeding minimal session state
   * Called after successful login or vault creation
   */
  initSession: async (params: { username: string; publicKey: string; vaultData: any; passwordKey?: string }): Promise<{ success: boolean }> => {
    console.log('🔧 [initSession] Received vault data:', {
      username: params.username,
      hasXprivEncrypted: !!params.vaultData.xprivEncrypted,
      xprivEncryptedLength: params.vaultData.xprivEncrypted?.length,
      hasIdentities: !!params.vaultData.identities,
      identitiesCount: params.vaultData.identities?.length,
      allKeys: Object.keys(params.vaultData)
    });

    // Normalize vault data - map xprivEncrypted to encryptedVault for database storage
    const vaultToSave = {
      ...params.vaultData,
      encryptedVault: params.vaultData.xprivEncrypted,  // Map to DB field name
      publicKey: params.publicKey,
      lastUnlocked: Date.now(),
      createdAt: params.vaultData.createdAt || Date.now()
    };

    console.log('💾 [initSession] Saving vault with mapped fields:', {
      username: vaultToSave.username,
      hasEncryptedVault: !!vaultToSave.encryptedVault,
      encryptedVaultLength: vaultToSave.encryptedVault?.length,
      hasIdentities: !!vaultToSave.identities,
      allKeys: Object.keys(vaultToSave)
    });

    // Save/refresh vault data
    await vaultDB.saveVault(vaultToSave);

    // Persist xprivs store too if present
    try {
      const enc = vaultToSave.xprivEncrypted;
      const pinSalt = vaultToSave.salt;
      if (enc && pinSalt) {
        await vaultDB.saveXpriv(params.username, enc, pinSalt, vaultToSave.passwordSalt);
      }
    } catch {}

    // Seed minimal locked session in-memory
    const session: ExtendedSession = {
      username: params.username,
      publicKey: params.publicKey,
      isUnlocked: false,
      unlockedAt: Date.now(),
      passwordKey: params.passwordKey  // Cache password key for vault encryption
    };

    activeSessions.set(params.username, session);
    logSessionState('SESSION_INIT', params.username);

    // Persist non-sensitive session status
    const sessionId = `session_${params.username}_${Date.now()}`;
    await vaultDB.saveSession({
      sessionId,
      username: params.username,
      publicKey: params.publicKey,
      isUnlocked: false,
      createdAt: Date.now()
    } as any);

    // Broadcast login event
    broadcastVaultUpdate(params.username, 'USER_LOGGED_IN', { username: params.username, publicKey: params.publicKey });

    return { success: true };
  },

  /**
   * Login handler - orchestrates the full login flow
   * 1. Try to load vault from local IndexedDB
   * 2. If not found, fetch from Nostr relays
   * 3. Verify password
   * 4. Initialize locked session
   */
  login: async (params: { username: string; password: string; environment?: string; relays?: string[] }, crypto: NostrCrypto): Promise<{
    success: boolean;
    user?: {
      publicKey: string;
      profile: { username: string; storagePublicKey?: string };
    };
    needsMigration?: boolean;
    error?: string;
  }> => {
    console.log('🔍 [WORKER login] Starting login for username:', params.username);

    try {
      // 1. Try to load from local IndexedDB
      console.log('📦 [WORKER login] Loading vault from IndexedDB...');
      let vaultData = await vaultDB.getVault(params.username);
      console.log('📦 [WORKER login] IndexedDB result:', vaultData ? 'found' : 'not found');

      // 2. If not found locally, fetch from Nostr
      if (!vaultData) {
        console.log('📡 [WORKER login] Fetching from Nostr relays...');

        // Dynamic import to avoid circular dependencies
        const { getLoginObj, getVaultFromNostr } = await import('@nostrpass/nostrHelpers');
        const relays = params.relays || [];
        const env = params.environment || 'production';

        const loginObj = await getLoginObj(params.username, env, relays);
        if (!loginObj) {
          return { success: false, error: 'No vault found for this username' };
        }

        console.log('✅ [WORKER login] Found LoginObj on Nostr');

        // Derive password key using salt from LoginObj
        console.log('🔑 [WORKER login] Deriving password key...');
        const passwordDeriveResult = await cryptoPrimitives.deriveKey({
          password: params.password,
          salt: loginObj.passwordSalt
        });
        const passwordKey = passwordDeriveResult.key || passwordDeriveResult;

        // Decrypt VaultObj with password key
        const nostrVault = await getVaultFromNostr(loginObj.storagePublicKey, relays, passwordKey);

        if (!nostrVault) {
          return { success: false, error: 'Vault data not found on Nostr' };
        }

        console.log('✅ [WORKER login] Found VaultObj on Nostr');

        // Save to local IndexedDB for future use
        console.log('💾 [WORKER login] Saving vault to IndexedDB...');
        await vaultDB.saveVault({
          username: params.username,
          publicKey: loginObj.storagePublicKey,
          xprivEncrypted: (nostrVault as any).encryptedVault || (nostrVault as any).xprivEncrypted,
          encryptedVault: (nostrVault as any).encryptedVault || (nostrVault as any).xprivEncrypted,
          salt: (nostrVault as any).salt,
          identities: (nostrVault as any).identities || [],
          activeIdentityByApp: (nostrVault as any).activeIdentityByApp || {},
          passwordVerifier: (nostrVault as any).passwordVerifier,
          passwordSalt: (nostrVault as any).passwordSalt,
          recovery: (nostrVault as any).recovery,
          lastSyncedAt: Date.now(),
          updatedAt: (nostrVault as any).updatedAt || Date.now(),
          createdAt: (nostrVault as any).createdAt || Date.now()
        } as VaultData);

        vaultData = await vaultDB.getVault(params.username);
        console.log('✅ [WORKER login] Vault saved to IndexedDB');
      }

      if (!vaultData) {
        return { success: false, error: 'No vault found for this username' };
      }

      // 3. Verify password
      console.log('🔐 [WORKER login] Verifying password...');

      if (!params.password) {
        return { success: false, error: 'Password is required' };
      }

      // MIGRATION PATH: Add security fields if missing (for old accounts)
      if (!vaultData.passwordVerifier || !vaultData.passwordSalt) {
        console.warn('⚠️ [WORKER login] Account missing security fields - migrating...');

        try {
          // Generate new password salt
          const newPasswordSalt = await cryptoPrimitives.generateSalt();
          const passwordSalt = newPasswordSalt.salt || newPasswordSalt;

          // Derive key from password
          const passwordDeriveResult = await cryptoPrimitives.deriveKey({
            password: params.password,
            salt: passwordSalt
          });
          const passwordKey = passwordDeriveResult.key || passwordDeriveResult;

          // Create and encrypt verifier
          const passwordVerifier = await cryptoPrimitives.encryptData({
            data: 'NostrPass_Password_Verifier_v1',
            password: passwordKey
          });

          // Update vault data with new security fields
          vaultData.passwordVerifier = passwordVerifier;
          vaultData.passwordSalt = passwordSalt;
          vaultData.updatedAt = Date.now();

          // Save to IndexedDB
          await vaultDB.updateVaultData(params.username, vaultData);

          console.log('✅ [WORKER login] Account migrated with security fields');
        } catch (migrationError) {
          console.error('❌ [WORKER login] Migration failed:', migrationError);
          return { success: false, error: 'Failed to upgrade account security' };
        }
      }

      // Verify password with stored verifier
      try {
        console.log('🔐 [WORKER login] Deriving key from password...');
        const passwordDeriveResult = await cryptoPrimitives.deriveKey({
          password: params.password,
          salt: vaultData.passwordSalt
        });
        const passwordKey = passwordDeriveResult.key || passwordDeriveResult;

        console.log('🔐 [WORKER login] Decrypting password verifier...');
        const decrypted = await cryptoPrimitives.decryptData({
          encryptedData: vaultData.passwordVerifier,
          password: passwordKey
        });

        console.log('🔐 [WORKER login] Verifier decrypted, checking value...');
        if (decrypted !== 'NostrPass_Password_Verifier_v1') {
          console.error('❌ [WORKER login] Password verification failed');
          return { success: false, error: 'Invalid password' };
        }

        console.log('✅ [WORKER login] Password verified successfully');

        // 4. Initialize locked session with password key cached
        console.log('🔒 [WORKER login] Initializing session...');
        await sessionManager.initSession({
          username: params.username,
          publicKey: vaultData.publicKey,
          vaultData,
          passwordKey  // Cache password key for vault operations
        });

        console.log('✅ [WORKER login] Login successful');

        return {
          success: true,
          user: {
            publicKey: vaultData.publicKey,
            profile: {
              username: params.username,
              storagePublicKey: vaultData.storagePublicKey || vaultData.publicKey
            }
          }
        };
      } catch (error) {
        console.error('❌ [WORKER login] Password verification error:', error);
        return { success: false, error: 'Invalid password' };
      }
    } catch (error) {
      console.error('❌ [WORKER login] Login failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  },

  /**
   * Logout handler - orchestrates the full logout flow
   * 1. Stop Nostr subscription
   * 2. Clear in-memory session
   * 3. Clear persisted session
   * 4. Optionally delete vault data
   */
  logout: async (params: { username: string; deleteVault?: boolean }, crypto: NostrCrypto): Promise<{ success: boolean }> => {
    console.log('🚪 [WORKER logout] Starting logout for username:', params.username);

    try {
      // 1. Stop Nostr realtime subscription
      try {
        await nostrSync.stopNostrSubscription({ username: params.username });
        console.log('✅ [WORKER logout] Stopped Nostr subscription');
      } catch (error) {
        console.warn('⚠️ [WORKER logout] Failed to stop subscription:', error);
      }

      // 2. Clear in-memory session
      try {
        await sessionManager.logoutUser({ username: params.username });
        console.log('✅ [WORKER logout] Cleared in-memory session');
      } catch (error) {
        console.error('❌ [WORKER logout] Failed to clear session:', error);
      }

      // 3. Clear persisted session data
      try {
        await sessionManager.clearSession({ username: params.username });
        console.log('✅ [WORKER logout] Cleared persisted session');
      } catch (error) {
        console.error('❌ [WORKER logout] Failed to clear persisted session:', error);
      }

      // 4. Optionally delete vault data
      if (params.deleteVault) {
        try {
          await sessionManager.deleteVault({ username: params.username });
          console.log('🗑️ [WORKER logout] Deleted vault data');
        } catch (error) {
          console.error('❌ [WORKER logout] Failed to delete vault:', error);
        }
      }

      console.log('✅ [WORKER logout] Logout completed');
      return { success: true };
    } catch (error) {
      console.error('❌ [WORKER logout] Logout failed:', error);
      return { success: false };
    }
  },

  /**
   * Sign a Nostr event using the current session keys for a specific identity
   * Checks permissions before signing
   */
  signEventWithSession: async (params: {
    username: string;
    event: any;
    identityIndex: number;
    origin?: string
  }): Promise<{ event: any }> => {
    const session = activeSessions.get(params.username);
    if (!session || !session.isUnlocked || isSessionExpired(session)) {
      throw new Error('Session expired or locked');
    }

    // CHECK PERMISSIONS BEFORE SIGNING
    if (params.origin) {
      const permCheck = await sessionManager.checkPermission({
        username: params.username,
        origin: params.origin,
        action: 'signEvent',
        eventKind: params.event?.kind,
        identityIndex: params.identityIndex
      });
      console.error('[WORKER] signEventWithSession permission check:', {
        origin: params.origin,
        eventKind: params.event?.kind,
        level: permCheck.level,
        allowed: permCheck.allowed
      });
      if (permCheck.level === 'DENY') {
        console.error('[WORKER] ❌ Permission DENIED for signEventWithSession');
        throw new Error('Permission explicitly denied for signEvent');
      }
      if (!permCheck.allowed) {
        throw new Error('Permission not granted for signEvent');
      }
    }

    // Resolve private key for identity
    let privateKey: string | undefined = undefined;
    let publicKey: string | undefined = undefined;
    if (params.identityIndex === 0 && session.privateKey) {
      privateKey = session.privateKey;
      publicKey = crypto.getPublicKey(privateKey);
    } else if (session.xpriv) {
      const derived = crypto.deriveKeypairFromXpriv(session.xpriv, params.identityIndex);
      privateKey = derived.privateKey;
      publicKey = derived.publicKey;
    }

    if (!privateKey) throw new Error('No session key available for signing');

    // Prepare event
    const evt = { ...params.event };
    if (!evt.created_at) evt.created_at = Math.floor(Date.now() / 1000);
    if (!evt.kind) evt.kind = 1;
    if (!evt.tags) evt.tags = [];
    if (!evt.pubkey) evt.pubkey = publicKey!;

    // Sign
    const signed = crypto.signEvent(evt, String(privateKey));
    if (signed instanceof Map) {
      return {
        event: {
          id: signed.get('id') || evt.id,
          kind: signed.get('kind') || evt.kind,
          content: signed.get('content') || evt.content,
          tags: signed.get('tags') || evt.tags,
          created_at: signed.get('created_at') || evt.created_at,
          pubkey: signed.get('pubkey') || evt.pubkey,
          sig: signed.get('sig') || ''
        }
      };
    }
    return { event: signed };
  },

  /**
   * Sign arbitrary data using session keys for a specific identity
   * Checks permissions before signing
   */
  signMessageWithSession: async (params: {
    username: string;
    message: string;
    identityIndex: number;
    origin?: string
  }): Promise<{ signature: string }> => {
    const session = activeSessions.get(params.username);
    if (!session || !session.isUnlocked || isSessionExpired(session)) {
      throw new Error('Session expired or locked');
    }

    // CHECK PERMISSIONS BEFORE SIGNING
    if (params.origin) {
      const permCheck = await sessionManager.checkPermission({
        username: params.username,
        origin: params.origin,
        action: 'signData',
        identityIndex: params.identityIndex
      });
      console.error('[WORKER] signMessageWithSession permission check:', {
        origin: params.origin,
        level: permCheck.level,
        allowed: permCheck.allowed
      });
      if (permCheck.level === 'DENY') {
        console.error('[WORKER] ❌ Permission DENIED for signMessageWithSession');
        throw new Error('Permission explicitly denied for signData');
      }
      if (!permCheck.allowed) {
        throw new Error('Permission not granted for signData');
      }
    }

    let privateKey: string | undefined = undefined;
    if (params.identityIndex === 0 && session.privateKey) {
      privateKey = session.privateKey;
    } else if (session.xpriv) {
      const derived = crypto.deriveKeypairFromXpriv(session.xpriv, params.identityIndex);
      privateKey = derived.privateKey;
    }
    if (!privateKey) throw new Error('No session key available for signing');

    const signature = crypto.signMessage(params.message, privateKey);
    return { signature };
  },

  /**
   * Encrypt with session key for a specific identity (NIP-04)
   * Checks permissions before encrypting
   */
  encryptWithSession: async (params: {
    username: string;
    plaintext: string;
    recipientPubkey: string;
    identityIndex: number;
    origin?: string
  }, handlers: any): Promise<string> => {
    const session = activeSessions.get(params.username);
    if (!session || !session.isUnlocked || isSessionExpired(session)) {
      throw new Error('Session expired or locked');
    }

    // CHECK PERMISSIONS BEFORE ENCRYPTING
    if (params.origin) {
      const permCheck = await sessionManager.checkPermission({
        username: params.username,
        origin: params.origin,
        action: 'nip04',
        identityIndex: params.identityIndex
      });
      console.error('[WORKER] encryptWithSession permission check:', {
        origin: params.origin,
        level: permCheck.level,
        allowed: permCheck.allowed
      });
      if (permCheck.level === 'DENY') {
        console.error('[WORKER] ❌ Permission DENIED for encryptWithSession');
        throw new Error('Permission explicitly denied for NIP-04 encryption');
      }
      if (!permCheck.allowed) {
        throw new Error('Permission not granted for NIP-04 encryption');
      }
    }

    let privateKey: string | undefined = undefined;
    if (params.identityIndex === 0 && session.privateKey) {
      privateKey = session.privateKey;
    } else if (session.xpriv) {
      const derived = await handlers.deriveKeypairFromXpriv({ xpriv: session.xpriv, index: params.identityIndex });
      privateKey = derived.privateKey;
    }
    if (!privateKey) throw new Error('No session key available for encryption');

    // Use nostr-tools NIP-04 (spec-compliant)
    return nip04EncryptJS(privateKey, params.recipientPubkey, params.plaintext);
  },

  /**
   * Decrypt with session key for a specific identity (NIP-04)
   * Checks permissions before decrypting
   */
  decryptWithSession: async (params: {
    username: string;
    ciphertext: string;
    senderPubkey: string;
    identityIndex: number;
    origin?: string
  }, handlers: any): Promise<string> => {
    const session = activeSessions.get(params.username);
    if (!session || !session.isUnlocked || isSessionExpired(session)) {
      throw new Error('Session expired or locked');
    }

    // CHECK PERMISSIONS BEFORE DECRYPTING
    if (params.origin) {
      const permCheck = await sessionManager.checkPermission({
        username: params.username,
        origin: params.origin,
        action: 'nip04',
        identityIndex: params.identityIndex
      });
      console.error('[WORKER] decryptWithSession permission check:', {
        origin: params.origin,
        level: permCheck.level,
        allowed: permCheck.allowed
      });
      if (permCheck.level === 'DENY') {
        console.error('[WORKER] ❌ Permission DENIED for decryptWithSession');
        throw new Error('Permission explicitly denied for NIP-04 decryption');
      }
      if (!permCheck.allowed) {
        throw new Error('Permission not granted for NIP-04 decryption');
      }
    }

    let privateKey: string | undefined = undefined;
    if (params.identityIndex === 0 && session.privateKey) {
      privateKey = session.privateKey;
    } else if (session.xpriv) {
      const derived = await handlers.deriveKeypairFromXpriv({ xpriv: session.xpriv, index: params.identityIndex });
      privateKey = derived.privateKey;
    }
    if (!privateKey) throw new Error('No session key available for decryption');

    // Use nostr-tools NIP-04 (spec-compliant)
    return nip04DecryptJS(privateKey, params.senderPubkey, params.ciphertext);
  },

  /**
   * Derive identity keypair using xpriv from the current session
   * Requires unlocked session with xpriv
   */
  deriveIdentityFromSession: async (params: { username: string; index: number }, handlers: any): Promise<{ publicKey: string; path: string }> => {
    const session = activeSessions.get(params.username);
    if (!session || !session.xpriv) {
      throw new Error('No xpriv in session - please unlock with PIN first');
    }

    const xpriv = session.xpriv;

    // Use existing derive helper
    const derived = await handlers.deriveKeypairFromXpriv({ xpriv, index: params.index });

    let publicKey: string;
    let path: string;

    if (derived instanceof Map) {
      publicKey = derived.get('publicKey');
      path = derived.get('path') || `m/44'/1237'/0'/0/${params.index}`;
    } else {
      publicKey = derived.publicKey;
      path = derived.path || `m/44'/1237'/0'/0/${params.index}`;
    }

    return { publicKey, path };
  },

  /**
   * Return PIN-encrypted xpriv and salts from the dedicated store
   * Used for PIN unlock flow
   */
  getEncryptedXpriv: async (params: { username: string }): Promise<{ encryptedXpriv: string; pinSalt: string; passwordSalt?: string } | null> => {
    const row = await vaultDB.getXpriv(params.username);
    if (!row) return null;
    return row;
  },

  /**
   * Check if session has keys loaded
   * Preflight check for crypto operations
   */
  hasKeysInSession: async (params: { username: string }): Promise<{ hasPrivateKey: boolean; hasXpriv: boolean; hasStorageKeypair: boolean }> => {
    const session = activeSessions.get(params.username);
    const hasPrivateKey = !!(session && session.privateKey);
    const hasXpriv = !!(session && session.xpriv);
    const hasStorageKeypair = !!(session && session.storagePrivateKey && session.storagePublicKey);
    return { hasPrivateKey, hasXpriv, hasStorageKeypair };
  },

  /**
   * Create a new vault with username and PIN
   * Generates xpriv, encrypts with PIN, and creates active session
   */
  createVault: async (params: CreateVaultParams): Promise<CreateVaultResult> => {
    console.log('🔐 [createVault] Starting vault creation for username:', params.username);

    // Generate the vault using singleton crypto instance
    const vault = await crypto.createVault(params.username, params.pin);
    console.log('✅ [createVault] Vault crypto generated:', {
      username: vault.username,
      publicKey: vault.publicKey.substring(0, 20) + '...'
    });

    // Generate password verifier for login authentication
    const newPasswordSalt = await cryptoPrimitives.generateSalt();
    const passwordSalt = newPasswordSalt.salt || newPasswordSalt;
    console.log('🔑 [createVault] Password salt generated');

    // Derive key from password
    const passwordDeriveResult = await cryptoPrimitives.deriveKey({
      password: params.password,
      salt: passwordSalt
    });
    const passwordKey = passwordDeriveResult.key || passwordDeriveResult;

    // Create and encrypt verifier
    const passwordVerifier = await cryptoPrimitives.encryptData({
      data: 'NostrPass_Password_Verifier_v1',
      password: passwordKey
    });

    // Create default app permissions if appDomain provided
    const appPermissions: Record<string, any> = {};
    if (params.appDomain) {
      appPermissions[params.appDomain] = {
        appDomain: params.appDomain,
        appName: params.appDomain,
        permissions: {
          getPublicKey: 'ALLOW' as PermissionLevel,
          signEvent: 'ASK_EVERYTIME' as PermissionLevel,
          nip04: 'ASK_EVERYTIME' as PermissionLevel,
          nip44: 'ASK_EVERYTIME' as PermissionLevel
        },
        createdAt: Date.now(),
        lastUsed: Date.now()
      };
    }

    // Create default identity (index 0)
    const defaultIdentity = {
      id: `identity-0-${Date.now()}`,
      index: 0,
      name: 'Main Identity',
      publicKey: vault.publicKey,
      purpose: 'default',
      appPermissions,
      createdAt: Date.now(),
      lastUsed: Date.now()
    };

    // Store encrypted vault data with default identity and password verifier
    const vaultDataToSave = {
      username: vault.username,
      publicKey: vault.publicKey,
      encryptedVault: vault.xprivEncrypted || vault.encryptedVault,
      salt: vault.salt,
      derivationPath: vault.derivationPath,
      identities: [defaultIdentity],
      passwordVerifier,
      passwordSalt,
      version: 1,
      createdAt: Date.now(),
      lastUnlocked: Date.now(),
      sessionExpiry: Date.now() + (24 * 60 * 60 * 1000),
      updatedAt: Date.now()
    };

    console.log('💾 [createVault] Saving vault to IndexedDB:', {
      username: vaultDataToSave.username,
      hasPasswordVerifier: !!vaultDataToSave.passwordVerifier,
      hasPasswordSalt: !!vaultDataToSave.passwordSalt,
      identitiesCount: vaultDataToSave.identities.length
    });

    await vaultDB.saveVault(vaultDataToSave);
    console.log('✅ [createVault] Vault saved to IndexedDB successfully');

    // Verify it was saved
    const savedVault = await vaultDB.getVault(vault.username);
    if (savedVault) {
      console.log('✅ [createVault] Vault verified in IndexedDB:', {
        username: savedVault.username,
        hasPasswordVerifier: !!savedVault.passwordVerifier,
        hasPasswordSalt: !!savedVault.passwordSalt
      });
    } else {
      console.error('❌ [createVault] Failed to verify vault in IndexedDB!');
    }

    // Create active session
    const session: ExtendedSession = {
      username: vault.username,
      publicKey: vault.publicKey,
      privateKey: vault.privateKey,
      xpriv: vault.xpriv,
      isUnlocked: true,
      unlockedAt: Date.now()
    };

    activeSessions.set(vault.username, session);
    logSessionState('create', vault.username);

    // Broadcast vault creation
    broadcastVaultUpdate(vault.username, 'VAULT_CREATED', {
      publicKey: vault.publicKey
    });

    return {
      success: true,
      user: {
        publicKey: vault.publicKey,
        profile: {
          username: vault.username,
          storagePublicKey: vault.publicKey
        }
      }
    };
  },

  /**
   * Unlock vault with PIN
   * Decrypts xpriv, validates it, derives storage keypair, and creates active session
   */
  unlockVault: async (params: UnlockVaultParams, crypto: NostrCrypto, handlers: any): Promise<UnlockVaultResult> => {
    // Get vault data from IndexedDB
    const vaultData = await vaultDB.getVault(params.username);
    if (!vaultData) {
      throw new Error('Vault not found');
    }

    console.log('[Unlock] Starting unlock', { username: params.username });
    console.log('[Unlock] Vault fields presence:', {
      hasXprivEncrypted: !!(vaultData as any).encryptedVault,
      hasSalt: !!(vaultData as any).salt
    });

    // Decrypt the vault
    ensureNotLocked(params.username);
    const decryptedResult = crypto.decryptVault(
      vaultData.encryptedVault,
      params.pin
    );

    // Handle result Map
    let decrypted: any;
    if (decryptedResult instanceof Map) {
      decrypted = {
        privateKey: decryptedResult.get('privateKey'),
        xpriv: decryptedResult.get('xpriv'),
        publicKey: decryptedResult.get('publicKey')
      };
    } else {
      decrypted = decryptedResult;
    }

    // Validate xpriv if present
    if (decrypted.xpriv) {
      const sanitized = decrypted.xpriv.trim().replace(/\s+/g, '');

      // Basic format check
      if (!/^(xprv|tprv)/.test(sanitized)) {
        throw new Error('Invalid xpriv after PIN decrypt - must start with xprv or tprv');
      }

      // Test derivation to ensure xpriv is valid
      try {
        const testDerive = await handlers.deriveKeypairFromXpriv({
          xpriv: sanitized,
          index: 0
        });

        if (!testDerive || !testDerive.publicKey) {
          throw new Error('Invalid xpriv - derivation test failed');
        }

        console.log('[Worker] xpriv validated successfully via test derivation');
      } catch (error: any) {
        console.error('[Worker] xpriv validation failed:', error);
        throw new Error(`Invalid xpriv - validation failed: ${error.message}`);
      }

      decrypted.xpriv = sanitized;
    } else {
      console.warn('[Unlock] No xpriv in decrypted payload');
    }

    // Derive storage keypair from xpriv for Nostr operations
    let storagePrivateKey: string | undefined;
    let storagePublicKey: string | undefined;

    if (decrypted.xpriv) {
      try {
        // IMPORTANT: Use STORAGE_INDEX (8907) to match account creation
        const { STORAGE_INDEX } = await import('@nostrpass/types');
        const storageKeypair = await handlers.deriveKeypairFromXpriv({ xpriv: decrypted.xpriv, index: STORAGE_INDEX });
        if (storageKeypair instanceof Map) {
          storagePrivateKey = storageKeypair.get('privateKey');
          storagePublicKey = storageKeypair.get('publicKey');
        } else {
          storagePrivateKey = storageKeypair.privateKey;
          storagePublicKey = storageKeypair.publicKey;
        }
        console.log('[Unlock] Storage keypair derived for Nostr operations with STORAGE_INDEX');
      } catch (error) {
        console.error('[Unlock] Failed to derive storage keypair:', error);
        // Continue without storage keypair - will affect Nostr sync but not local operations
      }
    }

    // Update session
    const session: ExtendedSession = {
      username: params.username,
      publicKey: vaultData.publicKey,
      privateKey: decrypted.privateKey,
      xpriv: decrypted.xpriv,
      isUnlocked: true,
      unlockedAt: Date.now(),
      // Cache storage keypair for Nostr operations (signing/encryption)
      storagePrivateKey,
      storagePublicKey
    };
    console.log('[Unlock] Session seeds:', {
      hasPrivateKey: !!session.privateKey,
      hasXpriv: !!session.xpriv,
      hasStorageKeypair: !!(storagePrivateKey && storagePublicKey)
    });

    // Store recovery data if available
    if (vaultData.recoveryQuestions && vaultData.recoveryAnswers) {
      session.recoveryQuestions = vaultData.recoveryQuestions;
      session.answers = vaultData.recoveryAnswers;
    }

    activeSessions.set(params.username, session);
    resetPinAttempts(params.username);
    logSessionState('unlock', params.username);

    // Update last unlocked time
    await vaultDB.updateLastUnlocked(params.username);

    // Broadcast unlock as SESSION_UNLOCKED for consistency with UI handlers
    broadcastVaultUpdate(params.username, 'SESSION_UNLOCKED', {
      publicKey: vaultData.publicKey
    });
    console.log('[Unlock] Unlock flow completed');

    return {
      username: params.username,
      publicKey: vaultData.publicKey,
      isUnlocked: true
    };
  },

  /**
   * Back-compat alias: unlockSession behaves like unlockVault but accepts { username, privateKey, xpriv }
   * Used for programmatic unlocking without PIN
   */
  unlockSession: async (params: { username: string; privateKey?: string; xpriv?: string }, handlers: any): Promise<{ success: boolean }> => {
    const v = await vaultDB.getVault(params.username);
    const session = activeSessions.get(params.username) || {
      username: params.username,
      publicKey: v?.publicKey || '',
      isUnlocked: false,
      unlockedAt: Date.now()
    } as ExtendedSession;

    ensureNotLocked(params.username);
    if (params.privateKey) session.privateKey = params.privateKey;
    if (params.xpriv) session.xpriv = params.xpriv;
    session.isUnlocked = !!(session.privateKey || session.xpriv);
    session.unlockedAt = Date.now();

    // Derive and cache storage keypair if available
    if (session.xpriv && !session.storagePrivateKey) {
      try {
        const { STORAGE_INDEX } = await import('@nostrpass/types');
        const derived = await handlers.deriveKeypairFromXpriv({ xpriv: session.xpriv, index: STORAGE_INDEX });
        if (derived instanceof Map) {
          session.storagePrivateKey = derived.get('privateKey');
          session.storagePublicKey = derived.get('publicKey');
        } else {
          session.storagePrivateKey = derived.privateKey;
          session.storagePublicKey = derived.publicKey;
        }
        console.log('[UnlockSession] Storage keypair derived and cached');
      } catch (e) {
        console.warn('[UnlockSession] Failed to derive storage keypair:', e);
      }
    }

    activeSessions.set(params.username, session);
    resetPinAttempts(params.username);
    logSessionState('UNLOCKED_ALIAS', params.username);

    const sessionId = `session_${params.username}_${Date.now()}`;
    await vaultDB.saveSession({
      sessionId,
      username: params.username,
      publicKey: session.publicKey!,
      isUnlocked: session.isUnlocked,
      createdAt: Date.now()
    } as any);

    broadcastVaultUpdate(params.username, 'SESSION_UNLOCKED', { username: params.username });
    return { success: true };
  },

  /**
   * Lock vault - clears sensitive data from session but keeps session entry
   * User must unlock again to perform crypto operations
   */
  lockVault: async (params: LockVaultParams): Promise<void> => {
    const session = activeSessions.get(params.username);
    if (session) {
      // Clear sensitive data
      delete session.privateKey;
      delete session.xpriv;
      delete session.storagePrivateKey;
      delete session.storagePublicKey;
      session.isUnlocked = false;

      logSessionState('lock', params.username);

      // Broadcast lock as SESSION_LOCKED for consistency with UI handlers
      broadcastVaultUpdate(params.username, 'SESSION_LOCKED', {});
    }
  },

  /**
   * Explicit logout - clears session and broadcasts to all tabs
   * Removes session from active sessions and database
   */
  logoutUser: async (params: { username: string }): Promise<{ success: boolean }> => {
    const username = params.username;

    // Clear in-memory session data
    const session = activeSessions.get(username);
    if (session) {
      delete session.privateKey;
      delete session.xpriv;
      delete session.storagePrivateKey;
      delete session.storagePublicKey;
      session.isUnlocked = false;
    }

    activeSessions.delete(username);
    logSessionState('logout', username);

    // Clear persisted session row
    try {
      await vaultDB.clearAllSessions();
    } catch {}

    // Notify other tabs
    broadcastVaultUpdate(username, 'USER_LOGGED_OUT', {});

    return { success: true };
  },

  /**
   * Clear session without full logout (used by UI for cleanup)
   * Similar to lock but clears session from database
   */
  clearSession: async (params: { username: string }): Promise<{ success: boolean }> => {
    const username = params.username;
    const session = activeSessions.get(username);

    if (session) {
      delete session.privateKey;
      delete session.xpriv;
      delete session.storagePrivateKey;
      delete session.storagePublicKey;
      session.isUnlocked = false;
    }

    try {
      await vaultDB.clearAllSessions();
    } catch {}

    broadcastVaultUpdate(username, 'SESSION_LOCKED', {});

    return { success: true };
  },

  /**
   * Get session information for a username
   * Returns session state, public key, and recovery status
   */
  getSession: async (params: GetSessionParams): Promise<GetSessionResult> => {
    const session = activeSessions.get(params.username);
    const vaultData = await vaultDB.getVault(params.username);

    if (!session && !vaultData) {
      return {
        exists: false,
        isUnlocked: false
      };
    }

    return {
      exists: true,
      isUnlocked: session?.isUnlocked || false,
      publicKey: session?.publicKey || vaultData?.publicKey,
      hasRecovery: !!(vaultData?.recoveryQuestions && vaultData?.recoveryAnswers)
    };
  },

  /**
   * Recover vault using recovery answers
   * Verifies answers, decrypts vault, and re-encrypts with new PIN
   */
  recoverVault: async (params: RecoverVaultParams, crypto: NostrCrypto): Promise<RecoverVaultResult> => {
    const vaultData = await vaultDB.getVault(params.username);
    if (!vaultData) {
      throw new Error('Vault not found');
    }

    if (!vaultData.recoveryQuestions || !vaultData.recoveryAnswers) {
      throw new Error('No recovery data found for this vault');
    }

    // Verify answers match
    const providedAnswers = params.answers.map(a => a.toLowerCase().trim());
    const storedAnswers = vaultData.recoveryAnswers.map(a => a.toLowerCase().trim());

    if (JSON.stringify(providedAnswers) !== JSON.stringify(storedAnswers)) {
      throw new Error('Recovery answers do not match');
    }

    // Generate new PIN and re-encrypt vault
    const newPin = params.newPin;

    // Decrypt with recovery
    const privateKey = crypto.recoverPrivateKey(
      vaultData.encryptedVault,
      params.answers.join('')
    );

    // Re-encrypt with new PIN
    const vault = await crypto.createVaultFromKeys(
      params.username,
      privateKey,
      newPin
    );

    // Update vault
    await vaultDB.updateVault(params.username, {
      encryptedVault: vault.encryptedVault,
      salt: vault.salt
    });

    return {
      username: params.username,
      publicKey: vaultData.publicKey
    };
  },

  /**
   * Update vault recovery questions and answers
   * Stores in database and active session
   */
  updateVaultRecovery: async (params: UpdateVaultRecoveryParams): Promise<void> => {
    // Update recovery data in database
    await vaultDB.updateVault(params.username, {
      recoveryQuestions: params.questions,
      recoveryAnswers: params.answers
    });

    // Update session if active
    const session = activeSessions.get(params.username);
    if (session) {
      session.recoveryQuestions = params.questions;
      session.answers = params.answers;
    }
  },

  /**
   * Get session status for current user
   * Returns session ID and username from persisted sessions table
   */
  getSessionStatus: async (_params?: { username?: string }): Promise<{ sessionId: string | null; username: string | null }> => {
    try {
      // Check persisted sessions table (source of truth for logged-in state)
      // This gets cleared on logout, so if empty, user is logged out
      const allSessions = await vaultDB.getAllSessions();
      if (allSessions.length > 0) {
        const latest = allSessions[allSessions.length - 1];

        // Restore to activeSessions if not already there
        if (!activeSessions.has(latest.username)) {
          try {
            const vaultData = await vaultDB.getVault(latest.username);
            if (vaultData) {
              // Create a locked session (no keys in memory after refresh)
              activeSessions.set(latest.username, {
                username: latest.username,
                publicKey: vaultData.publicKey,
                isUnlocked: false,
                unlockedAt: Date.now()
              });
            }
          } catch {}
        }

        return { sessionId: latest.sessionId, username: latest.username };
      }

      // No sessions in DB = user is logged out
      // Don't check vaults or activeSessions - sessions table is source of truth
      return { sessionId: null, username: null };
    } catch (error) {
      console.error('[Worker] Error in getSessionStatus:', error);
      return { sessionId: null, username: null };
    }
  },

  /**
   * Refresh session activity timestamp
   * Broadcasts session refresh to all tabs
   */
  refreshSession: async (params: { username: string }): Promise<{ success: boolean }> => {
    const session = activeSessions.get(params.username);
    if (session) {
      // Update session activity timestamp
      session.unlockedAt = Date.now();

      // Broadcast session refresh
      broadcastVaultUpdate(params.username, 'SESSION_REFRESH', {
        username: params.username,
        publicKey: session.publicKey,
        isUnlocked: session.isUnlocked
      });
    }

    return { success: true };
  },

  /**
   * Check permission for an operation
   * Returns permission level, whether allowed, and if prompt is needed
   */
  checkPermission: async (params: {
    username: string;
    origin: string;
    action: 'signEvent' | 'signData' | 'getPublicKey' | 'nip04' | 'getRelays';
    eventKind?: number;
    identityIndex?: number
  }): Promise<{ allowed: boolean; level: PermissionLevel; needsPrompt: boolean; sessionGranted?: boolean }> => {
    const { username, origin, action, eventKind } = params;

    const vault = await vaultDB.getVault(username);
    if (!vault || !vault.identities || vault.identities.length === 0) {
      return { allowed: false, level: 'ASK_EVERYTIME', needsPrompt: true };
    }

    const identityIndex = Math.max(0, Math.min(
      (params.identityIndex ?? (vault as any).activeIdentityByApp?.[origin] ?? 0),
      (vault.identities.length - 1)
    ));
    const identity = vault.identities[identityIndex] as any;
    const appPerms = identity?.appPermissions?.[origin];

    if (!appPerms) {
      return { allowed: false, level: 'ASK_EVERYTIME', needsPrompt: true };
    }

    const resolveLevel = (level?: PermissionLevel): PermissionLevel => {
      if (level === 'ALLOW' || level === 'DENY') return level;
      return 'ASK_EVERYTIME';
    };

    const determineCategoryLevel = (kind?: number): PermissionLevel => {
      const kindNumber = kind !== undefined ? Number(kind) : undefined;
      if (kindNumber !== undefined && !Number.isNaN(kindNumber) && appPerms.kinds) {
        const explicit = appPerms.kinds[String(kindNumber)] ?? appPerms.kinds[kindNumber];
        if (explicit) {
          return resolveLevel(explicit as PermissionLevel);
        }
      }

      if (kindNumber !== undefined && !Number.isNaN(kindNumber)) {
        const entries = Object.entries(PERMISSION_KINDS) as Array<[keyof typeof PERMISSION_KINDS, readonly number[]]>;
        for (const [category, kinds] of entries) {
          if (kinds.includes(kindNumber)) {
            const level = appPerms.permissions?.[category] as PermissionLevel | undefined;
            if (level) {
              return resolveLevel(level);
            }
          }
        }
      }

      return 'ASK_EVERYTIME';
    };

    let level: PermissionLevel = 'ASK_EVERYTIME';

    switch (action) {
      case 'getPublicKey':
        level = resolveLevel(appPerms.getPublicKey as PermissionLevel | undefined);
        break;
      case 'signData':
        // Check nested permissions.signData FIRST (more specific), then fall back to root level
        const nestedSignData = appPerms.permissions?.signData as PermissionLevel | undefined;
        const rootSignData = appPerms.signData as PermissionLevel | undefined;
        console.error('[WORKER] signData permission lookup:', {
          origin,
          identityIndex,
          nestedPath: nestedSignData,
          rootPath: rootSignData,
          fullAppPerms: JSON.stringify(appPerms, null, 2)
        });
        level = resolveLevel(nestedSignData ?? rootSignData);
        console.error('[WORKER] Resolved signData level:', level);
        break;
      case 'nip04':
        // Check nested permissions.messaging FIRST (more specific), then fall back to root level
        level = resolveLevel(
          (appPerms.permissions?.messaging as PermissionLevel | undefined) ??
          (appPerms.nip04 as PermissionLevel | undefined)
        );
        break;
      case 'getRelays':
        // Check nested permissions.financial FIRST (more specific), then fall back to root level
        level = resolveLevel(
          (appPerms.permissions?.financial as PermissionLevel | undefined) ??
          (appPerms.getRelays as PermissionLevel | undefined)
        );
        break;
      case 'signEvent':
        {
          const normalizedKind = eventKind !== undefined ? Number(eventKind) : undefined;
          level = determineCategoryLevel(
            normalizedKind !== undefined && !Number.isNaN(normalizedKind) ? normalizedKind : undefined
          );
        }
        break;
      default:
        level = 'ASK_EVERYTIME';
    }

    const allowed = level === 'ALLOW';
    return {
      allowed,
      level,
      needsPrompt: level === 'ASK_EVERYTIME',
      sessionGranted: false
    };
  },

  /**
   * Get app permissions for a specific origin using the active identity for that app
   * Returns full permission object or null if not found
   */
  getAppPermissions: async (params: { username: string; origin: string; identityIndex?: number }): Promise<any | null> => {
    const vault = await vaultDB.getVault(params.username);
    if (!vault || !vault.identities || vault.identities.length === 0) return null;

    const identityIndex = Math.max(0, Math.min(
      (params.identityIndex ?? (vault as any).activeIdentityByApp?.[params.origin] ?? 0),
      (vault.identities.length - 1)
    ));
    const identity = vault.identities[identityIndex] as any;
    const appPerms = (identity.appPermissions || {})[params.origin];

    return appPerms || null;
  },

  /**
   * Save/update app permissions scoped to origin on the active identity for that app
   * Merges with existing permissions and broadcasts update
   */
  saveAppPermissions: async (params: {
    username: string;
    origin: string;
    permissions: any;
    appName?: string;
    identityIndex?: number
  }): Promise<{ success: boolean }> => {
    const { username, origin, permissions, appName } = params;

    // Get current vault data
    const vault = await vaultDB.getVault(username);
    if (!vault) {
      throw new Error('Vault not found');
    }

    // Ensure identities array exists
    const updatedVault = { ...vault } as any;
    updatedVault.identities = Array.isArray(updatedVault.identities) ? [...updatedVault.identities] : [];
    if (updatedVault.identities.length === 0) {
      updatedVault.identities.push({ appPermissions: {} });
    }

    // Determine the active identity for this app (fallback to 0)
    const identityIndex = Math.max(0, Math.min(
      (params.identityIndex ?? updatedVault.activeIdentityByApp?.[origin] ?? 0),
      (updatedVault.identities.length - 1)
    ));
    const identity = { ...updatedVault.identities[identityIndex] };
    identity.appPermissions = { ...(identity.appPermissions || {}) };

    const existing = identity.appPermissions[origin] || {
      appId: origin,
      appName: appName || origin,
      grantedAt: Date.now(),
      lastUsedAt: Date.now(),
      permissions: {
        social: 'ASK_EVERYTIME',
        messaging: 'ASK_EVERYTIME',
        signData: 'ASK_EVERYTIME',
        financial: 'ASK_EVERYTIME',
      },
      getPublicKey: 'ALLOW',
    };

    // Merge top-level and nested permission categories
    const basePermissions = {
      social: (existing.permissions && existing.permissions.social) || 'ASK_EVERYTIME',
      messaging: (existing.permissions && existing.permissions.messaging) || 'ASK_EVERYTIME',
      signData: (existing.permissions && existing.permissions.signData) || 'ASK_EVERYTIME',
      financial: (existing.permissions && existing.permissions.financial) || 'ASK_EVERYTIME',
    };

    if (permissions.permissions) {
      Object.assign(basePermissions, permissions.permissions);
    }
    if (permissions.social) basePermissions.social = permissions.social;
    if (permissions.messaging) basePermissions.messaging = permissions.messaging;
    if (permissions.signData) basePermissions.signData = permissions.signData;
    if (permissions.financial) basePermissions.financial = permissions.financial;
    if (permissions.nip04) basePermissions.messaging = permissions.nip04;
    if (permissions.getRelays) basePermissions.financial = permissions.getRelays;

    const mergedKinds = {
      ...(existing.kinds || {}),
      ...(permissions.kinds || {}),
    };

    // Build clean permission object without legacy root-level fields
    const merged = {
      appId: existing.appId || origin,
      appName: appName || existing.appName || origin,
      grantedAt: existing.grantedAt || Date.now(),
      lastUsedAt: Date.now(),
      getPublicKey: permissions.getPublicKey ?? existing.getPublicKey ?? 'ASK_EVERYTIME',
      kinds: Object.keys(mergedKinds).length > 0 ? mergedKinds : existing.kinds,
      permissions: basePermissions,
      // Note: Legacy root-level fields (signData, nip04, getRelays) removed
      // All permission checks now use the nested permissions object
    };

    identity.appPermissions[origin] = merged;
    updatedVault.identities[identityIndex] = identity;
    updatedVault.updatedAt = Date.now();

    // Persist
    await vaultDB.saveVault(updatedVault);

    // Broadcast the update
    broadcastVaultUpdate(username, 'PERMISSIONS_UPDATED', {
      origin,
      permissions: merged
    });

    return { success: true };
  },

  /**
   * Check if vault exists for username
   * Simple existence check without loading vault data
   */
  checkVaultExists: async (params: CheckVaultExistsParams): Promise<CheckVaultExistsResult> => {
    const vaultData = await vaultDB.getVault(params.username);
    return { exists: !!vaultData };
  },

  /**
   * Delete vault and all associated data
   * Removes from active sessions, database, and broadcasts deletion
   */
  deleteVault: async (params: DeleteVaultParams): Promise<DeleteVaultResult> => {
    // Remove from active sessions
    activeSessions.delete(params.username);
    logSessionState('delete', params.username);

    // Delete from database (vaults, xprivs, sessions)
    await vaultDB.deleteVault(params.username);

    // Broadcast deletion
    broadcastVaultUpdate(params.username, 'VAULT_DELETED', {});

    return { success: true };
  },
};
