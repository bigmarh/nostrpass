/**
 * Session State Manager
 *
 * Single source of truth for authentication state.
 * Manages complete session state in worker memory.
 *
 * Security: Uses SecureKeyStorage for sensitive key material.
 * Keys are stored as Uint8Array and securely wiped on lock/logout.
 *
 * Like the CLI tool: simple, atomic, and predictable.
 */

import type { VaultData } from './db';
import type { LoginObj } from '@nostrpass/types';
import { getLoginObj, getLoginObjByDTag, getVaultFromNostr, configureNostrPass, getNamespace } from '@nostrpass/nostrHelpers';
import { SecureKeyStorage } from './secure-key-storage';
import { checkPinLockout, recordFailedPinAttempt, recordSuccessfulPinAttempt, resetPinTracking } from './session-manager';

/**
 * Complete session state - everything in one object
 *
 * Note: Sensitive keys (xpriv, privateKey, storagePrivateKey) are stored
 * in SecureKeyStorage, not directly on this object. The string properties
 * here are getters that retrieve from secure storage.
 */
export interface CompleteSessionState {
  // Auth status
  isAuthenticated: boolean;
  isUnlocked: boolean;

  // User info
  username: string;
  displayName?: string;  // Human-readable name for UI
  publicKey: string;
  storagePublicKey: string;

  // Auth method
  authProvider?: 'username' | 'google';  // How the user logged in

  // Vault metadata
  vaultVersion: number;
  identityCount: number;

  // Session info
  sessionId: string;
  createdAt: number;
  unlockedAt: number;
  expiresAt: number;
  relays?: string[];  // Relays for Nostr operations
  environment?: string;  // Environment (production, demo, etc.)
  namespace?: string;  // Namespace for Nostr operations

  // LoginObj (cached from login, needed for unlock)
  loginObj?: LoginObj;

  // Sensitive data (only when unlocked)
  // These are retrieved from SecureKeyStorage, not stored as plain strings
  xpriv?: string;
  privateKey?: string;
  storagePrivateKey?: string;

  // Cached vault data
  vaultData?: VaultData;

  // Internal: Reference to secure key storage (not exposed in interface)
  _secureKeys?: SecureKeyStorage;
}

/**
 * Session State Manager
 *
 * Manages all session state in memory.
 * No IndexedDB synchronization needed.
 * Worker memory is the single source of truth.
 *
 * Security: Sensitive keys are stored in SecureKeyStorage instances,
 * not as plain strings. This allows secure wiping of key material.
 */
export class SessionStateManager {
  private sessions = new Map<string, CompleteSessionState>();
  private secureKeys = new Map<string, SecureKeyStorage>();
  private activeUsername: string | null = null;

  // Session timeout (30 minutes)
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000;

  /**
   * Get or create secure key storage for a username
   */
  private getSecureStorage(username: string): SecureKeyStorage {
    let storage = this.secureKeys.get(username);
    if (!storage) {
      storage = new SecureKeyStorage();
      this.secureKeys.set(username, storage);
    }
    return storage;
  }

  /**
   * Clear secure key storage for a username
   */
  private clearSecureStorage(username: string): void {
    const storage = this.secureKeys.get(username);
    if (storage) {
      storage.clearAll();
      this.secureKeys.delete(username);
    }
  }

  /**
   * Get current auth state
   * ONE call returns everything - no piecing together
   *
   * Note: Keys are retrieved from SecureKeyStorage and returned as strings
   * for API compatibility. Callers should use the keys immediately and
   * not store them in variables longer than necessary.
   */
  getAuthState(username?: string): CompleteSessionState | null {
    const targetUsername = username || this.activeUsername;

    if (!targetUsername) {
      return null;
    }

    const session = this.sessions.get(targetUsername);

    if (!session) {
      return null;
    }

    // Check if session expired
    if (Date.now() > session.expiresAt) {
      console.log('[SessionStateManager] Session expired, clearing');
      this.clearSecureStorage(targetUsername);
      this.sessions.delete(targetUsername);
      if (this.activeUsername === targetUsername) {
        this.activeUsername = null;
      }
      return null;
    }

    // Retrieve keys from secure storage for the response
    const secureStorage = this.secureKeys.get(targetUsername);
    if (secureStorage && session.isUnlocked) {
      // Populate key fields from secure storage
      session.xpriv = secureStorage.getXpriv() || undefined;
      session.privateKey = secureStorage.getPrivateKey() || undefined;
      session.storagePrivateKey = secureStorage.getStoragePrivateKey() || undefined;
    }

    return session;
  }

  /**
   * Atomic login operation
   * Fetches from Nostr and creates complete session state
   */
  async login(params: {
    username: string;
    password: string;
    relays: string[];
    environment?: string;
    namespace?: string;
    identifierType?: 'username' | 'google';
    displayName?: string;
    vaultDTag?: string;  // For multi-vault Google auth: specific d-tag to fetch
    vaultPasswordSalt?: string;  // For multi-vault: password salt from vault picker
  }): Promise<CompleteSessionState> {
    console.log('[SessionStateManager] Starting atomic login for:', params.username, 'type:', params.identifierType);

    const { username, password, relays, environment = 'production', namespace, identifierType = 'username', displayName, vaultDTag, vaultPasswordSalt } = params;

    try {
      // Step 1: Try to load LoginObj from IndexedDB cache (fast)
      const { vaultDB } = await import('./db');
      await vaultDB.init();

      // Always fetch from Nostr to verify password
      // Even if we have a cached LoginObj, we need to verify the password is correct
      console.log('[SessionStateManager] Fetching from Nostr to verify password...');
      console.log('[SessionStateManager] Using identifierType:', identifierType, 'environment:', environment);

      let loginResult: { loginObj: LoginObj; passwordSalt: string } | null = null;

      // For Google auth with multi-vault: use specific d-tag if provided
      if (identifierType === 'google' && vaultDTag && vaultPasswordSalt) {
        console.log('[SessionStateManager] Using getLoginObjByDTag for multi-vault Google auth');
        console.log('[SessionStateManager] vaultDTag:', vaultDTag);
        loginResult = await getLoginObjByDTag(vaultDTag, vaultPasswordSalt, relays, password);
      } else {
        // Standard lookup by identifier
        loginResult = await getLoginObj(username, identifierType, environment, relays, password);
      }

      if (!loginResult) {
        throw new Error('Account not found or wrong password');
      }

      // DEBUG: Log the full LoginObj structure
      console.log('[SessionStateManager] ========== LOGIN OBJ DEBUG ==========');
      console.log('[SessionStateManager] LoginObj keys:', Object.keys(loginResult.loginObj));
      console.log('[SessionStateManager] LoginObj.storagePublicKey:', loginResult.loginObj.storagePublicKey);
      console.log('[SessionStateManager] LoginObj.passwordSalt:', loginResult.loginObj.passwordSalt);
      console.log('[SessionStateManager] LoginObj.pinSalt exists:', !!loginResult.loginObj.pinSalt);
      console.log('[SessionStateManager] LoginObj.storageKeypairEncrypted exists:', !!loginResult.loginObj.storageKeypairEncrypted);
      console.log('[SessionStateManager] Result passwordSalt:', loginResult.passwordSalt);
      console.log('[SessionStateManager] =====================================');

      // Cache the LoginObj for future logins (after successful password verification)
      // Include environment in cache key to handle same username in different namespaces
      await vaultDB.saveLoginObj(username, loginResult.loginObj, loginResult.passwordSalt, environment);
      console.log('[SessionStateManager] Password verified, LoginObj cached successfully');

      const { loginObj, passwordSalt } = loginResult;

      // Ensure passwordSalt is on the loginObj (for older accounts it may only be in event tags)
      if (!loginObj.passwordSalt && passwordSalt) {
        loginObj.passwordSalt = passwordSalt;
        console.log('[SessionStateManager] Added passwordSalt to loginObj from event tags');
      }

      // Step 2: Store LoginObj in session for later use during unlock
      // We can't fetch VaultObj yet because it's encrypted with storage key
      // And storage key is encrypted with PIN (which we don't have until unlock)
      console.log('[SessionStateManager] LoginObj retrieved, deferring VaultObj fetch to unlock');

      // Step 3: Create authenticated (but locked) session
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const now = Date.now();

      // Use provided displayName or fall back to username
      const effectiveDisplayName = displayName || username;

      // Create complete session state (locked - no keys yet)
      const session: CompleteSessionState = {
        isAuthenticated: true,
        isUnlocked: false,
        username,
        displayName: effectiveDisplayName,
        publicKey: '', // Will be set on unlock
        storagePublicKey: loginObj.storagePublicKey,
        authProvider: identifierType === 'google' ? 'google' : 'username', // Track auth method
        vaultVersion: 0, // Will be set on unlock
        identityCount: 0, // Will be set on unlock
        sessionId,
        createdAt: now,
        unlockedAt: 0,
        expiresAt: now + this.SESSION_TIMEOUT,
        relays, // Store for later use during unlock
        environment, // Store for use during unlock
        namespace, // Store for use during unlock
        loginObj // Store for decrypting storage keys during unlock
      };

      // Store complete state in ONE place
      this.sessions.set(username, session);
      this.activeUsername = username;

      // Persist login state to IndexedDB (without sensitive keys)
      await vaultDB.init();
      await vaultDB.saveSession({
        sessionId,
        username,
        displayName: effectiveDisplayName,
        storagePublicKey: loginObj.storagePublicKey,
        publicKey: '', // Will be set on unlock when we decrypt the vault
        isUnlocked: false,
        createdAt: now,
        environment, // Store environment for use during unlock
        authProvider: identifierType === 'google' ? 'google' : 'username' // Track auth method
      });

      // SECURITY: Reset PIN tracking after successful password login
      // This clears totalFailures, allowing fresh PIN attempts
      resetPinTracking(username);

      console.log('[SessionStateManager] Login successful, session created and persisted:', sessionId);

      return session;
    } catch (error) {
      console.error('[SessionStateManager] Login failed:', error);
      throw error;
    }
  }

  /**
   * Atomic unlock operation
   * Decrypts keys and updates session state
   * Includes PIN brute force protection
   */
  async unlock(params: {
    username: string;
    pin: string;
    cryptoPrimitives: any; // Import type
  }): Promise<CompleteSessionState> {
    console.log('[SessionStateManager] Starting atomic unlock for:', params.username);

    // SECURITY: Check PIN lockout status before attempting unlock
    const lockoutStatus = checkPinLockout(params.username);
    if (lockoutStatus.isLocked) {
      const remainingSeconds = Math.ceil(lockoutStatus.remainingMs / 1000);
      const error = new Error(`Too many failed attempts. Please wait ${remainingSeconds} seconds before trying again.`);
      (error as any).code = 'PIN_LOCKED';
      (error as any).remainingMs = lockoutStatus.remainingMs;
      (error as any).requiresPassword = lockoutStatus.requiresPassword;
      throw error;
    }

    if (lockoutStatus.requiresPassword) {
      const error = new Error('Too many failed PIN attempts. Please re-enter your password to continue.');
      (error as any).code = 'REQUIRE_PASSWORD';
      throw error;
    }

    const session = this.sessions.get(params.username);

    if (!session) {
      throw new Error('Not logged in - please login first');
    }

    if (session.isUnlocked) {
      console.log('[SessionStateManager] Already unlocked');
      return session;
    }

    try {
      // Step 1: Load VaultObj from IndexedDB cache (fast, local-first)
      console.log('[SessionStateManager] Loading VaultObj from IndexedDB cache...');
      const { vaultDB } = await import('./db');
      await vaultDB.init();

      // For Google login, we need to get the storagePublicKey from LoginObj first
      // because the vault is keyed by storagePublicKey, not by username/Google UID
      let storagePublicKeyForLookup = session.storagePublicKey;

      // Load LoginObj early if not already in session (needed for storagePublicKey lookup)
      if (!session.loginObj) {
        console.log('[SessionStateManager] Loading LoginObj from IndexedDB cache...');
        const environment = session.environment || 'production';
        console.log('[SessionStateManager] Using environment:', environment);
        const cachedLogin = await vaultDB.getLoginObj(params.username, environment);
        if (cachedLogin?.loginObj) {
          session.loginObj = cachedLogin.loginObj;
          storagePublicKeyForLookup = cachedLogin.loginObj.storagePublicKey;
          console.log('[SessionStateManager] LoginObj loaded from cache, storagePublicKey:', storagePublicKeyForLookup?.slice(0, 12) + '...');
        }
      } else if (session.loginObj.storagePublicKey) {
        storagePublicKeyForLookup = session.loginObj.storagePublicKey;
      }

      // Try to get vault by storagePublicKey first (primary), then by username (fallback)
      let vaultData = storagePublicKeyForLookup
        ? await vaultDB.getVault(storagePublicKeyForLookup)
        : null;

      if (!vaultData) {
        // Fallback to username lookup
        vaultData = await vaultDB.getVault(params.username);
      }

      console.log('[SessionStateManager] Vault lookup result:', {
        foundByStoragePublicKey: !!vaultData && !!storagePublicKeyForLookup,
        foundByUsername: !!vaultData && !storagePublicKeyForLookup,
        vaultUsername: vaultData?.username
      });

      if (!vaultData) {
        console.log('[SessionStateManager] VaultObj not in cache, need to fetch from Nostr first');
        console.log('[SessionStateManager] This requires storage keys - deriving from xpriv temporarily...');

        // We need the LoginObj to get the storage keypair
        if (!session.loginObj) {
          throw new Error('LoginObj not found in cache - please login with password first');
        }

        // Decrypt storage keypair with PIN
        console.log('[SessionStateManager] Decrypting storage keypair with PIN...');
        const storageKeypairJson = await params.cryptoPrimitives.decryptDataWithSalt({
          encryptedData: session.loginObj.storageKeypairEncrypted,
          password: params.pin,
          salt: session.loginObj.pinSalt
        });

        const storageKeypair = JSON.parse(storageKeypairJson);
        const storagePrivateKey = storageKeypair.privateKey;
        const storagePublicKey = storageKeypair.publicKey;

        // Fetch VaultObj from Nostr
        // Configure environment before query to ensure correct d-tag matching
        const environment = session.environment || 'production';
        const namespace = session.namespace || getNamespace();
        console.log('[SessionStateManager] Fetching VaultObj from Nostr...', { environment, namespace });
        configureNostrPass({ environment, namespace });

        vaultData = await getVaultFromNostr(
          storagePublicKey,
          session.relays || [],
          storagePrivateKey
        );

        if (!vaultData) {
          throw new Error('VaultObj not found on Nostr');
        }

        // Add storagePublicKey for IndexedDB keyPath (not stored in encrypted vault)
        vaultData.storagePublicKey = storagePublicKey;

        // Save to IndexedDB for future unlocks
        console.log('[SessionStateManager] Saving VaultObj to IndexedDB cache...');
        await vaultDB.saveVault(vaultData);
        console.log('[SessionStateManager] VaultObj cached successfully');
      } else {
        console.log('[SessionStateManager] VaultObj loaded from cache');
      }

      // ALWAYS load LoginObj into session (needed for linkGoogleAccount and other operations)
      // Even if vaultData was cached, we still need loginObj for password verification
      if (!session.loginObj) {
        console.log('[SessionStateManager] Loading LoginObj into session...');
        const environment = session.environment || 'production';
        const cachedLogin = await vaultDB.getLoginObj(params.username, environment);
        if (cachedLogin?.loginObj) {
          session.loginObj = cachedLogin.loginObj;
          console.log('[SessionStateManager] LoginObj loaded into session');
        } else {
          console.warn('[SessionStateManager] LoginObj not found in cache - some features may not work');
        }
      }

      // Step 2: Decrypt xpriv with PIN
      console.log('[SessionStateManager] Decrypting xpriv with PIN...');

      if (!vaultData.xprivEncrypted || !vaultData.salt) {
        throw new Error('xpriv not found in vault data');
      }

      const xpriv = await params.cryptoPrimitives.decryptDataWithSalt({
        encryptedData: vaultData.xprivEncrypted,
        password: params.pin,
        salt: vaultData.salt
      });

      console.log('[SessionStateManager] xpriv decrypted successfully');

      // Step 3: Derive main keypair (index 0)
      const mainKeypair = await params.cryptoPrimitives.deriveKeypairFromXpriv({
        xpriv,
        index: 0
      });
      const privateKey = mainKeypair.privateKey || mainKeypair.get?.('privateKey');
      const publicKey = mainKeypair.publicKey || mainKeypair.get?.('publicKey');

      // Step 4: Derive storage keypair (index 1337)
      const STORAGE_INDEX = 1337;
      const storageKeypair = await params.cryptoPrimitives.deriveKeypairFromXpriv({
        xpriv,
        index: STORAGE_INDEX
      });
      const storagePrivateKey = storageKeypair.privateKey || storageKeypair.get?.('privateKey');
      const storagePublicKey = storageKeypair.publicKey || storageKeypair.get?.('publicKey');

      console.log('[SessionStateManager] Keypairs derived from xpriv');

      // Step 5: Store sensitive keys in SecureKeyStorage (not as plain strings)
      const secureStorage = this.getSecureStorage(params.username);
      secureStorage.setKeys({
        xpriv,
        privateKey,
        storagePrivateKey
      });
      console.log('[SessionStateManager] Keys stored in SecureKeyStorage');

      // Step 5.5: Decrypt BYOK identity keys
      const byokIdentities = vaultData.identities?.filter((id: any) => id.isImported && id.encryptedNsec) || [];
      if (byokIdentities.length > 0) {
        console.log(`[SessionStateManager] Decrypting ${byokIdentities.length} BYOK identity keys...`);
        for (const identity of byokIdentities) {
          try {
            const byokPrivateKey = await params.cryptoPrimitives.decryptNsecFromBYOK({
              encryptedNsec: identity.encryptedNsec,
              pin: params.pin,
              salt: vaultData.salt
            });
            secureStorage.setBYOKKey(identity.publicKey, byokPrivateKey);
            console.log(`[SessionStateManager] BYOK key decrypted for identity: ${identity.nickname || identity.publicKey.slice(0, 8)}`);
          } catch (error) {
            // Log error but don't fail the whole unlock - other identities may still work
            console.error(`[SessionStateManager] Failed to decrypt BYOK key for ${identity.publicKey.slice(0, 8)}:`, error);
          }
        }
        console.log('[SessionStateManager] BYOK keys decrypted');
      }

      // Step 6: Update session atomically (without storing keys as strings)
      const now = Date.now();
      session.isUnlocked = true;
      session.publicKey = publicKey;
      session.vaultVersion = vaultData.version || 1;
      session.identityCount = vaultData.identities?.length || 0;
      session.unlockedAt = now;
      session.expiresAt = now + this.SESSION_TIMEOUT;
      session.vaultData = vaultData;
      session._secureKeys = secureStorage;

      // Populate key fields for API compatibility (retrieved from secure storage)
      session.xpriv = secureStorage.getXpriv() || undefined;
      session.privateKey = secureStorage.getPrivateKey() || undefined;
      session.storagePrivateKey = secureStorage.getStoragePrivateKey() || undefined;

      // SECURITY: Record successful PIN attempt (resets attempt counter)
      recordSuccessfulPinAttempt(params.username);

      console.log('[SessionStateManager] Unlock successful');

      return session;
    } catch (error) {
      // SECURITY: Record failed attempt and check for lockout
      // Check if this was a decryption failure (wrong PIN)
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Decryption failed') || errorMessage.includes('invalid')) {
        const attemptResult = recordFailedPinAttempt(params.username);

        if (attemptResult.isLocked) {
          const remainingSeconds = Math.ceil(attemptResult.remainingMs / 1000);
          const lockedError = new Error(`Too many failed attempts. Please wait ${remainingSeconds} seconds.`);
          (lockedError as any).code = 'PIN_LOCKED';
          (lockedError as any).remainingMs = attemptResult.remainingMs;
          (lockedError as any).attemptsRemaining = 0;
          throw lockedError;
        }

        const pinError = new Error(`Invalid PIN. ${attemptResult.attemptsRemaining} attempts remaining.`);
        (pinError as any).code = 'INVALID_PIN';
        (pinError as any).attemptsRemaining = attemptResult.attemptsRemaining;
        (pinError as any).backoffMs = attemptResult.backoffMs;
        throw pinError;
      }

      console.error('[SessionStateManager] Unlock failed:', error);
      throw error;
    }
  }

  /**
   * Atomic logout operation
   * Clears all session state in ONE operation
   * Securely wipes all key material from memory
   */
  async logout(username: string): Promise<void> {
    console.log('[SessionStateManager] Logging out:', username);

    // SECURITY: Clear all secure key storage first (wipes key material)
    for (const [user, storage] of this.secureKeys.entries()) {
      console.log('[SessionStateManager] Securely wiping keys for:', user);
      storage.clearAll();
    }
    this.secureKeys.clear();

    // Clear ALL sessions from memory (logout should clear everything)
    this.sessions.clear();
    this.activeUsername = null;

    // Clear ALL persisted sessions from IndexedDB
    // This prevents other tabs from restoring the session
    try {
      const { vaultDB } = await import('./db');
      await vaultDB.init();
      await vaultDB.clearAllSessions();
      console.log('[SessionStateManager] All persisted sessions cleared');
    } catch (error) {
      console.error('[SessionStateManager] Failed to clear persisted sessions:', error);
    }

    console.log('[SessionStateManager] Logout complete - all sessions and keys cleared');
  }

  /**
   * Lock session (clear sensitive keys but keep authenticated)
   * Securely wipes key material from memory
   */
  lockSession(username: string): void {
    const session = this.sessions.get(username);

    if (!session) {
      return;
    }

    console.log('[SessionStateManager] Locking session for:', username);

    // SECURITY: Securely wipe keys from SecureKeyStorage
    this.clearSecureStorage(username);

    // Clear sensitive data references on session object
    session.isUnlocked = false;
    session.xpriv = undefined;
    session.privateKey = undefined;
    session.storagePrivateKey = undefined;
    session._secureKeys = undefined;
    session.unlockedAt = 0;

    console.log('[SessionStateManager] Session locked, keys securely wiped');
  }

  /**
   * Update vault metadata after changes
   */
  updateVaultMetadata(username: string, updates: {
    vaultVersion?: number;
    identityCount?: number;
    vaultData?: VaultData;
  }): void {
    const session = this.sessions.get(username);

    if (!session) {
      console.warn('[SessionStateManager] Cannot update metadata - no session');
      return;
    }

    if (updates.vaultVersion !== undefined) {
      session.vaultVersion = updates.vaultVersion;
    }
    if (updates.identityCount !== undefined) {
      session.identityCount = updates.identityCount;
    }
    if (updates.vaultData !== undefined) {
      session.vaultData = updates.vaultData;
    }

    console.log('[SessionStateManager] Metadata updated:', {
      vaultVersion: session.vaultVersion,
      identityCount: session.identityCount
    });
  }

  /**
   * Check if session exists and is valid
   */
  hasValidSession(username?: string): boolean {
    const state = this.getAuthState(username);
    return state !== null && state.isAuthenticated;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): string[] {
    const now = Date.now();
    const active: string[] = [];

    for (const [username, session] of this.sessions.entries()) {
      if (now <= session.expiresAt) {
        active.push(username);
      } else {
        // Clean up expired sessions
        this.sessions.delete(username);
        if (this.activeUsername === username) {
          this.activeUsername = null;
        }
      }
    }

    return active;
  }

  /**
   * Clear all sessions (for logout all)
   * Securely wipes all key material from memory
   */
  clearAllSessions(): void {
    console.log('[SessionStateManager] Clearing all sessions');

    // SECURITY: Securely wipe all keys first
    for (const [username, storage] of this.secureKeys.entries()) {
      console.log('[SessionStateManager] Securely wiping keys for:', username);
      storage.clearAll();
    }
    this.secureKeys.clear();

    this.sessions.clear();
    this.activeUsername = null;

    console.log('[SessionStateManager] All sessions cleared, keys securely wiped');
  }

  /**
   * Restore login state from IndexedDB
   * Called during worker initialization
   */
  async restoreFromDB(): Promise<void> {
    try {
      const { vaultDB } = await import('./db');
      await vaultDB.init();

      // Get all sessions and restore the most recent one
      const sessions = await vaultDB.getAllSessions();

      if (sessions && sessions.length > 0) {
        // Sort by createdAt descending and get the most recent
        const persistedSession = sessions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];

        console.log('[SessionStateManager] Restoring session from IndexedDB:', persistedSession.username);

        // Create a locked session (no keys, needs unlock)
        // We need to fetch the LoginObj again to be able to unlock later
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const now = Date.now();

        const session: CompleteSessionState = {
          isAuthenticated: true,
          isUnlocked: false,
          username: persistedSession.username,
          displayName: persistedSession.displayName || persistedSession.username, // Restore displayName
          publicKey: persistedSession.publicKey || '', // Nostr public key (set after unlock)
          storagePublicKey: persistedSession.storagePublicKey, // Vault identifier (from IndexedDB)
          authProvider: persistedSession.authProvider || 'username', // Restore auth method (username or google)
          vaultVersion: 0,
          identityCount: 0,
          sessionId,
          createdAt: now,
          unlockedAt: 0,
          expiresAt: now + this.SESSION_TIMEOUT,
          environment: persistedSession.environment || 'production' // Restore environment for unlock
        };

        this.sessions.set(persistedSession.username, session);
        this.activeUsername = persistedSession.username;

        console.log('[SessionStateManager] Session restored, user needs to unlock with PIN');
      } else {
        console.log('[SessionStateManager] No persisted session found');
      }
    } catch (error) {
      console.error('[SessionStateManager] Failed to restore session from DB:', error);
    }
  }
}

// Singleton instance
let instance: SessionStateManager | null = null;

export function getSessionStateManager(): SessionStateManager {
  if (!instance) {
    instance = new SessionStateManager();
  }
  return instance;
}
