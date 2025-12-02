// IndexedDB helper for secure storage in worker context

// Import and re-export the unified VaultData type
import type { VaultData } from '@nostrpass/nostrHelpers';
export type { VaultData };

export interface UserSession {
  sessionId?: string; // Added for session tracking
  username: string;
  publicKey: string;
  privateKey?: string; // Only stored temporarily in memory
  isUnlocked: boolean;
  unlockedAt?: number;
  expiresAt?: number;
  createdAt?: number; // When the session was created
}

const DB_NAME = 'NostrPassVault';
const DB_VERSION = 3; // Increment for loginObjs store

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

        // Store vault data
        if (!db.objectStoreNames.contains('vaults')) {
          const vaultStore = db.createObjectStore('vaults', { keyPath: 'username' });
          vaultStore.createIndex('publicKey', 'publicKey', { unique: true });
          vaultStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Store active sessions (temporary)
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'username' });
          sessionStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }

        // Store PIN-encrypted xpriv and salts separately for deterministic unlocks
        if (!db.objectStoreNames.contains('xprivs')) {
          const xprivStore = db.createObjectStore('xprivs', { keyPath: 'username' });
          xprivStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Store cached LoginObjs to avoid Nostr fetch + PBKDF2 on every login
        if (!db.objectStoreNames.contains('loginObjs')) {
          db.createObjectStore('loginObjs', { keyPath: 'username' });
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

  async getVault(username: string): Promise<VaultData | null> {
    if (!this.db) await this.init();
    const run = (): Promise<VaultData | null> => new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['vaults'], 'readonly');
        const store = transaction.objectStore('vaults');
        const request = store.get(username);

        request.onsuccess = () => {
          resolve(request.result || null);
        };
        request.onerror = () => reject(request.error);
      } catch (e: any) {
        reject(e);
      }
    });
    try {
      return await run();
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

  async deleteVault(username: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      // Delete from both vaults and xprivs stores
      const transaction = this.db!.transaction(['vaults', 'xprivs', 'sessions'], 'readwrite');
      const vaultStore = transaction.objectStore('vaults');
      const xprivStore = transaction.objectStore('xprivs');
      const sessionStore = transaction.objectStore('sessions');
      
      // Delete vault data
      vaultStore.delete(username);
      // Delete cached xpriv
      xprivStore.delete(username);
      // Delete session
      sessionStore.delete(username);

      transaction.oncomplete = () => {
        console.log('🗑️ Deleted vault, xpriv, and session for:', username);
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

  async getSession(username: string): Promise<UserSession | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.get(username);

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

  async clearSession(username: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.delete(username);

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

  // XPRIV storage helpers
  async saveXpriv(username: string, encryptedXpriv: string, pinSalt: string, passwordSalt?: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['xprivs'], 'readwrite');
      const store = tx.objectStore('xprivs');
      const request = store.put({
        username,
        encryptedXpriv,
        pinSalt,
        passwordSalt,
        updatedAt: Date.now(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getXpriv(username: string): Promise<{ xprivEncrypted: string; salt: string; passwordSalt?: string } | null> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['xprivs'], 'readonly');
      const store = tx.objectStore('xprivs');
      const request = store.get(username);
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

  async saveLoginObj(username: string, loginObj: any, passwordSalt: string): Promise<void> {
    if (!this.db) await this.init();

    // Check if loginObjs store exists (might be old DB version)
    if (!this.db!.objectStoreNames.contains('loginObjs')) {
      console.warn('[DB] loginObjs store not found - database needs upgrade');
      return; // Gracefully skip caching on old DB versions
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['loginObjs'], 'readwrite');
      const store = tx.objectStore('loginObjs');
      const request = store.put({
        username,
        loginObj,
        passwordSalt,
        cachedAt: Date.now()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getLoginObj(username: string): Promise<{ loginObj: any; passwordSalt: string } | null> {
    if (!this.db) await this.init();

    // Check if loginObjs store exists (might be old DB version)
    if (!this.db!.objectStoreNames.contains('loginObjs')) {
      console.warn('[DB] loginObjs store not found - returning null (cache miss)');
      return null; // Return null to trigger Nostr fetch
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['loginObjs'], 'readonly');
      const store = tx.objectStore('loginObjs');
      const request = store.get(username);
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
}

export const vaultDB = new VaultDB();