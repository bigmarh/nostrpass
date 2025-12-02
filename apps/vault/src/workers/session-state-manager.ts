/**
 * Session State Manager
 *
 * Single source of truth for authentication state.
 * Manages complete session state in worker memory.
 *
 * Like the CLI tool: simple, atomic, and predictable.
 */

import type { VaultData } from './db';
import type { LoginObj } from '@nostrpass/types';
import { getLoginObj, getVaultFromNostr } from '@nostrpass/nostrHelpers';

/**
 * Complete session state - everything in one object
 */
export interface CompleteSessionState {
  // Auth status
  isAuthenticated: boolean;
  isUnlocked: boolean;

  // User info
  username: string;
  publicKey: string;
  storagePublicKey: string;

  // Vault metadata
  vaultVersion: number;
  identityCount: number;

  // Session info
  sessionId: string;
  createdAt: number;
  unlockedAt: number;
  expiresAt: number;
  relays?: string[];  // Relays for Nostr operations

  // LoginObj (cached from login, needed for unlock)
  loginObj?: LoginObj;

  // Sensitive data (only when unlocked)
  xpriv?: string;
  privateKey?: string;
  storagePrivateKey?: string;

  // Cached vault data
  vaultData?: VaultData;
}

/**
 * Session State Manager
 *
 * Manages all session state in memory.
 * No IndexedDB synchronization needed.
 * Worker memory is the single source of truth.
 */
export class SessionStateManager {
  private sessions = new Map<string, CompleteSessionState>();
  private activeUsername: string | null = null;

  // Session timeout (30 minutes)
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000;

  /**
   * Get current auth state
   * ONE call returns everything - no piecing together
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
      this.sessions.delete(targetUsername);
      if (this.activeUsername === targetUsername) {
        this.activeUsername = null;
      }
      return null;
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
  }): Promise<CompleteSessionState> {
    console.log('[SessionStateManager] Starting atomic login for:', params.username);

    const { username, password, relays, environment = 'production' } = params;

    try {
      // Step 1: Try to load LoginObj from IndexedDB cache (fast)
      const { vaultDB } = await import('./db');
      await vaultDB.init();

      let loginResult = await vaultDB.getLoginObj(username);

      if (!loginResult) {
        // Cache miss - fetch from Nostr (slow: network + PBKDF2)
        console.log('[SessionStateManager] LoginObj not cached, fetching from Nostr...');
        loginResult = await getLoginObj(username, environment, relays, password);

        if (!loginResult) {
          throw new Error('Account not found or wrong password');
        }

        // Cache the LoginObj for future logins
        await vaultDB.saveLoginObj(username, loginResult.loginObj, loginResult.passwordSalt);
        console.log('[SessionStateManager] LoginObj cached successfully');
      } else {
        console.log('[SessionStateManager] LoginObj loaded from cache (fast path)');
      }

      const { loginObj, passwordSalt } = loginResult;

      // Step 2: Store LoginObj in session for later use during unlock
      // We can't fetch VaultObj yet because it's encrypted with storage key
      // And storage key is encrypted with PIN (which we don't have until unlock)
      console.log('[SessionStateManager] LoginObj retrieved, deferring VaultObj fetch to unlock');

      // Step 3: Create authenticated (but locked) session
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const now = Date.now();

      // Create complete session state (locked - no keys yet)
      const session: CompleteSessionState = {
        isAuthenticated: true,
        isUnlocked: false,
        username,
        publicKey: '', // Will be set on unlock
        storagePublicKey: loginObj.storagePublicKey,
        vaultVersion: 0, // Will be set on unlock
        identityCount: 0, // Will be set on unlock
        sessionId,
        createdAt: now,
        unlockedAt: 0,
        expiresAt: now + this.SESSION_TIMEOUT,
        relays, // Store for later use during unlock
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
        publicKey: loginObj.storagePublicKey,
        isUnlocked: false,
        createdAt: now
      });

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
   */
  async unlock(params: {
    username: string;
    pin: string;
    cryptoPrimitives: any; // Import type
  }): Promise<CompleteSessionState> {
    console.log('[SessionStateManager] Starting atomic unlock for:', params.username);

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
      let vaultData = await vaultDB.getVault(params.username);

      if (!vaultData) {
        console.log('[SessionStateManager] VaultObj not in cache, need to fetch from Nostr first');
        console.log('[SessionStateManager] This requires storage keys - deriving from xpriv temporarily...');

        // We need to fetch the LoginObj to get the storage keypair
        // Then use that to fetch and decrypt the VaultObj from Nostr
        if (!session.loginObj) {
          // Fetch LoginObj from Nostr (should have been cached during login, but might be a restored session)
          console.log('[SessionStateManager] Fetching LoginObj from Nostr...');

          const loginResult = await getLoginObj(
            params.username,
            'production',
            session.relays || [],
            '' // We don't have password, will use what's cached
          );

          if (!loginResult || !loginResult.loginObj) {
            throw new Error('LoginObj not found - please login with password first');
          }

          session.loginObj = loginResult.loginObj;
          console.log('[SessionStateManager] LoginObj fetched successfully');
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
        console.log('[SessionStateManager] Fetching VaultObj from Nostr...');
        vaultData = await getVaultFromNostr(
          storagePublicKey,
          session.relays || [],
          storagePrivateKey
        );

        if (!vaultData) {
          throw new Error('VaultObj not found on Nostr');
        }

        // Save to IndexedDB for future unlocks
        console.log('[SessionStateManager] Saving VaultObj to IndexedDB cache...');
        await vaultDB.saveVault(vaultData);
        console.log('[SessionStateManager] VaultObj cached successfully');
      } else {
        console.log('[SessionStateManager] VaultObj loaded from cache');
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

      // Step 5: Update session atomically
      const now = Date.now();
      session.isUnlocked = true;
      session.xpriv = xpriv;
      session.privateKey = privateKey;
      session.publicKey = publicKey;
      session.storagePrivateKey = storagePrivateKey;
      session.vaultVersion = vaultData.version || 1;
      session.identityCount = vaultData.identities?.length || 0;
      session.unlockedAt = now;
      session.expiresAt = now + this.SESSION_TIMEOUT;
      session.vaultData = vaultData;

      console.log('[SessionStateManager] Unlock successful');

      return session;
    } catch (error) {
      console.error('[SessionStateManager] Unlock failed:', error);
      throw error;
    }
  }

  /**
   * Atomic logout operation
   * Clears all session state in ONE operation
   */
  async logout(username: string): Promise<void> {
    console.log('[SessionStateManager] Logging out:', username);

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

    console.log('[SessionStateManager] Logout complete - all sessions cleared');
  }

  /**
   * Lock session (clear sensitive keys but keep authenticated)
   */
  lockSession(username: string): void {
    const session = this.sessions.get(username);

    if (!session) {
      return;
    }

    console.log('[SessionStateManager] Locking session for:', username);

    // Clear sensitive data
    session.isUnlocked = false;
    session.xpriv = undefined;
    session.privateKey = undefined;
    session.storagePrivateKey = undefined;
    session.unlockedAt = 0;

    console.log('[SessionStateManager] Session locked');
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
   */
  clearAllSessions(): void {
    console.log('[SessionStateManager] Clearing all sessions');
    this.sessions.clear();
    this.activeUsername = null;
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
          publicKey: '',
          storagePublicKey: persistedSession.publicKey,
          vaultVersion: 0,
          identityCount: 0,
          sessionId,
          createdAt: now,
          unlockedAt: 0,
          expiresAt: now + this.SESSION_TIMEOUT
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
