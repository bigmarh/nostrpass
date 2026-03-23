// IndexedDB helper for secure storage in worker context

// Import and re-export the unified VaultData type
import type { VaultData } from '@nostrpass/nostrHelpers';
export type { VaultData };

export interface UserSession {
  storagePublicKey: string; // Primary key - the vault identifier
  sessionId?: string; // Added for session tracking
  username: string; // Login identifier (Google UID for Google auth, actual username for username auth)
  displayName?: string; // Human-readable name for UI display
  publicKey: string; // Nostr public key (npub)
  privateKey?: string; // Only stored temporarily in memory
  isUnlocked: boolean;
  unlockedAt?: number;
  expiresAt?: number;
  createdAt?: number; // When the session was created
  environment?: string; // Environment used for login (production, demo, etc.)
  authProvider?: 'username' | 'google'; // How the user logged in
  identifier?: string; // The actual identifier used for login (Google UID or username)
}

const DB_NAME = 'NostrPassVault';
const DB_VERSION = 4; // Increment for storagePublicKey migration

class VaultDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        // Close connection on versionchange to avoid InvalidStateError
        try {
          this.db.onversionchange = () => {
            try { this.db?.close(); } catch {}
            this.db = null;
          };
        } catch {}
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;
        const transaction = (event.target as IDBOpenDBRequest).transaction!;

        // MIGRATION: v3 -> v4: Change vault keyPath from username to storagePublicKey
        if (oldVersion > 0 && oldVersion < 4 && db.objectStoreNames.contains('vaults')) {
          // Read all existing vaults, delete old store, create new store, re-insert
          const oldStore = transaction.objectStore('vaults');
          const getAllRequest = oldStore.getAll();

          getAllRequest.onsuccess = () => {
            const existingVaults: VaultData[] = getAllRequest.result || [];
            console.log(`[DB Migration v4] Migrating ${existingVaults.length} vaults to storagePublicKey keying`);

            // Delete old store and create new one with storagePublicKey keyPath
            db.deleteObjectStore('vaults');
            const newVaultStore = db.createObjectStore('vaults', { keyPath: 'storagePublicKey' });
            newVaultStore.createIndex('username', 'username', { unique: false }); // Keep for display lookups
            newVaultStore.createIndex('updatedAt', 'updatedAt', { unique: false });

            // Re-insert vaults with storagePublicKey as key
            for (const vault of existingVaults) {
              // Ensure storagePublicKey is set (fallback to publicKey for old vaults)
              if (!vault.storagePublicKey) {
                vault.storagePublicKey = vault.publicKey;
              }
              newVaultStore.put(vault);
            }
            console.log('[DB Migration v4] Migration complete');
          };
        } else if (!db.objectStoreNames.contains('vaults')) {
          // Fresh install: create vaults store with storagePublicKey keyPath
          const vaultStore = db.createObjectStore('vaults', { keyPath: 'storagePublicKey' });
          vaultStore.createIndex('username', 'username', { unique: false }); // For display lookups
          vaultStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Store active sessions (keyed by storagePublicKey)
        if (oldVersion > 0 && oldVersion < 4 && db.objectStoreNames.contains('sessions')) {
          // Migrate sessions to storagePublicKey keying
          const oldStore = transaction.objectStore('sessions');
          const getAllRequest = oldStore.getAll();

          getAllRequest.onsuccess = () => {
            const existingSessions: UserSession[] = getAllRequest.result || [];
            console.log(`[DB Migration v4] Migrating ${existingSessions.length} sessions`);

            db.deleteObjectStore('sessions');
            const newSessionStore = db.createObjectStore('sessions', { keyPath: 'storagePublicKey' });
            newSessionStore.createIndex('expiresAt', 'expiresAt', { unique: false });

            // Re-insert sessions with publicKey as storagePublicKey
            for (const session of existingSessions) {
              const migratedSession = {
                ...session,
                storagePublicKey: session.publicKey // Use publicKey as storagePublicKey
              };
              newSessionStore.put(migratedSession);
            }
          };
        } else if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'storagePublicKey' });
          sessionStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }

        // Store PIN-encrypted xpriv and salts (keyed by storagePublicKey)
        if (oldVersion > 0 && oldVersion < 4 && db.objectStoreNames.contains('xprivs')) {
          // For now, keep xprivs as-is since they're looked up by username during login
          // They'll naturally migrate as users log in
        } else if (!db.objectStoreNames.contains('xprivs')) {
          const xprivStore = db.createObjectStore('xprivs', { keyPath: 'storagePublicKey' });
          xprivStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Store cached LoginObjs (keyed by identifier hash)
        if (!db.objectStoreNames.contains('loginObjs')) {
          db.createObjectStore('loginObjs', { keyPath: 'cacheKey' });
        }
      };
    });
  }

  async saveVault(vaultData: VaultData): Promise<void> {
    if (!this.db) await this.init();

    const run = (): Promise<void> => new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['vaults'], 'readwrite');
        const store = transaction.objectStore('vaults');
        const request = store.put(vaultData);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (e: any) {
        reject(e);
      }
    });
    try {
      return await run();
    } catch (e: any) {
      const msg = String(e?.message || e || '')
        .toLowerCase();
      if (msg.includes('closing') || msg.includes('invalidstateerror')) {
        console.warn('[DB] Connection closing detected. Reinitializing and retrying saveVault...');
        this.db = null;
        await this.init();
        return await run();
      }
      throw e;
    }
  }

  async getVault(keyOrUsername: string): Promise<VaultData | null> {
    if (!keyOrUsername) {
      console.warn('[DB] getVault called with empty key');
      return null;
    }
    if (!this.db) await this.init();
    const run = (): Promise<VaultData | null> => new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['vaults'], 'readonly');
        const store = transaction.objectStore('vaults');
        const request = store.get(keyOrUsername);

        request.onsuccess = () => {
          resolve(request.result || null);
        };
        request.onerror = () => reject(request.error);
      } catch (e: any) {
        reject(e);
      }
    });
    try {
      let result = await run();
      // Fallback: If not found by storagePublicKey, try username index
      if (!result) {
        result = await this.getVaultByUsername(keyOrUsername);
      }
      return result;
    } catch (e: any) {
      const msg = String(e?.message || e || '').toLowerCase();
      if (msg.includes('closing') || msg.includes('invalidstateerror')) {
        console.warn('[DB] Connection closing detected. Reinitializing and retrying getVault...');
        this.db = null;
        await this.init();
        return await run();
      }
      throw e;
    }
  }

  // Legacy method for username-based lookup (for migration/backwards compatibility)
  async getVaultByUsername(username: string): Promise<VaultData | null> {
    if (!username) return null;
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['vaults'], 'readonly');
        const store = transaction.objectStore('vaults');
        const index = store.index('username');
        const request = index.get(username);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      } catch (e: any) {
        reject(e);
      }
    });
  }

  async getVaultByPublicKey(publicKey: string): Promise<VaultData | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['vaults'], 'readonly');
      const store = transaction.objectStore('vaults');
      const index = store.index('publicKey');
      const request = index.get(publicKey);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteVault(storagePublicKey: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      // Delete from both vaults and xprivs stores
      const transaction = this.db!.transaction(['vaults', 'xprivs', 'sessions'], 'readwrite');
      const vaultStore = transaction.objectStore('vaults');
      const xprivStore = transaction.objectStore('xprivs');
      const sessionStore = transaction.objectStore('sessions');

      // Delete vault data by storagePublicKey
      vaultStore.delete(storagePublicKey);
      // Delete cached xpriv by storagePublicKey
      xprivStore.delete(storagePublicKey);
      // Delete session by storagePublicKey
      sessionStore.delete(storagePublicKey);

      transaction.oncomplete = () => {
        console.log('🗑️ Deleted vault, xpriv, and session for storagePublicKey:', storagePublicKey);
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Delete only the vault record (not session or xpriv)
   * Used for migration when vault key needs to be corrected
   */
  async deleteVaultOnly(storagePublicKey: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['vaults'], 'readwrite');
      const vaultStore = transaction.objectStore('vaults');
      vaultStore.delete(storagePublicKey);

      transaction.oncomplete = () => {
        console.log('🗑️ Deleted vault record only for key:', storagePublicKey);
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getAllVaults(): Promise<VaultData[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['vaults'], 'readonly');
      const store = transaction.objectStore('vaults');
      const request = store.getAll();

      request.onsuccess = () => {
        const vaults = request.result || [];
        console.log('📤 Retrieved all vaults from IndexedDB:', vaults.length, 'vaults');
        resolve(vaults);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveSession(session: UserSession): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.put({
        ...session,
        // Normalize to undefined for no auto-expiry
        expiresAt: undefined
      } as any);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSession(storagePublicKey: string): Promise<UserSession | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.get(storagePublicKey);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllSessions(): Promise<UserSession[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async clearSession(storagePublicKey: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.delete(storagePublicKey);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearExpiredSessions(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      const index = store.index('expiresAt');
      const now = Date.now();
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllSessions(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Clear all data from all stores (for testing/reset)
  async clearAll(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['vaults', 'xprivs', 'sessions'], 'readwrite');
      
      transaction.objectStore('vaults').clear();
      transaction.objectStore('xprivs').clear();
      transaction.objectStore('sessions').clear();

      transaction.oncomplete = () => {
        console.log('🗑️ Cleared all IndexedDB data');
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // XPRIV storage helpers - keyed by storagePublicKey
  async saveXpriv(storagePublicKey: string, encryptedXpriv: string, pinSalt: string, passwordSalt?: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['xprivs'], 'readwrite');
      const store = tx.objectStore('xprivs');
      const request = store.put({
        storagePublicKey,
        encryptedXpriv,
        pinSalt,
        passwordSalt,
        updatedAt: Date.now(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getXpriv(storagePublicKey: string): Promise<{ xprivEncrypted: string; salt: string; passwordSalt?: string } | null> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['xprivs'], 'readonly');
      const store = tx.objectStore('xprivs');
      const request = store.get(storagePublicKey);
      request.onsuccess = () => {
        const row = request.result;
        if (!row) return resolve(null);
        // Map internal field names to external API
        resolve({
          xprivEncrypted: row.encryptedXpriv,
          salt: row.pinSalt,
          passwordSalt: row.passwordSalt
        });
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveLoginObj(username: string, loginObj: any, passwordSalt: string, environment: string = 'production'): Promise<void> {
    if (!this.db) await this.init();

    // Check if loginObjs store exists (might be old DB version)
    if (!this.db!.objectStoreNames.contains('loginObjs')) {
      console.warn('[DB] loginObjs store not found - database needs upgrade');
      return; // Gracefully skip caching on old DB versions
    }

    // Create composite key: hash(username)_environment
    // This matches the Nostr event identifier and handles same username in different namespaces
    const { sha256 } = await import('@noble/hashes/sha256');
    const { bytesToHex } = await import('@noble/hashes/utils');
    const encoder = new TextEncoder();
    const normalizedUsername = username.toLowerCase().trim();
    const data = encoder.encode(normalizedUsername);
    const hashBytes = sha256(data);
    const usernameHash = bytesToHex(hashBytes);
    const cacheKey = `${usernameHash}_${environment}`;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['loginObjs'], 'readwrite');
      const store = tx.objectStore('loginObjs');
      const request = store.put({
        cacheKey, // Primary key (matches store keyPath)
        loginObj,
        passwordSalt,
        cachedAt: Date.now()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getLoginObj(username: string, environment: string = 'production'): Promise<{ loginObj: any; passwordSalt: string } | null> {
    if (!this.db) await this.init();

    // Check if loginObjs store exists (might be old DB version)
    if (!this.db!.objectStoreNames.contains('loginObjs')) {
      console.warn('[DB] loginObjs store not found - returning null (cache miss)');
      return null; // Return null to trigger Nostr fetch
    }

    // Create composite key: hash(username)_environment
    const { sha256 } = await import('@noble/hashes/sha256');
    const { bytesToHex } = await import('@noble/hashes/utils');
    const encoder = new TextEncoder();
    const normalizedUsername = username.toLowerCase().trim();
    const data = encoder.encode(normalizedUsername);
    const hashBytes = sha256(data);
    const usernameHash = bytesToHex(hashBytes);
    const cacheKey = `${usernameHash}_${environment}`;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['loginObjs'], 'readonly');
      const store = tx.objectStore('loginObjs');
      const request = store.get(cacheKey);
      request.onsuccess = () => {
        const row = request.result;
        if (!row) return resolve(null);
        resolve({
          loginObj: row.loginObj,
          passwordSalt: row.passwordSalt
        });
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteLoginObj(username: string, environment: string = 'production'): Promise<void> {
    if (!this.db) await this.init();

    // Check if loginObjs store exists (might be old DB version)
    if (!this.db!.objectStoreNames.contains('loginObjs')) {
      console.warn('[DB] loginObjs store not found - cannot delete');
      return;
    }

    // Create composite key: hash(username)_environment
    const { sha256 } = await import('@noble/hashes/sha256');
    const { bytesToHex } = await import('@noble/hashes/utils');
    const encoder = new TextEncoder();
    const normalizedUsername = username.toLowerCase().trim();
    const data = encoder.encode(normalizedUsername);
    const hashBytes = sha256(data);
    const usernameHash = bytesToHex(hashBytes);
    const cacheKey = `${usernameHash}_${environment}`;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['loginObjs'], 'readwrite');
      const store = tx.objectStore('loginObjs');
      const request = store.delete(cacheKey);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const vaultDB = new VaultDB();