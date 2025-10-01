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
const DB_VERSION = 2; // Keep at version 2 to avoid downgrade error

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
      };
    });
  }

  async saveVault(vaultData: VaultData): Promise<void> {
    if (!this.db) await this.init();
    
    const startTime = Date.now();
    const dataSize = JSON.stringify(vaultData).length;
    
    console.log('💾 Saving vault to IndexedDB:', {
      username: vaultData.username,
      dataSize: `${(dataSize / 1024).toFixed(2)} KB`,
      identitiesCount: vaultData.identities?.length || 0,
      hasXprivEncrypted: !!(vaultData as any).xprivEncrypted,
      xprivEncryptedLength: (vaultData as any).xprivEncrypted?.length,
      hasPasswordSalt: !!(vaultData as any).passwordSalt,
      allKeys: Object.keys(vaultData)
    });
    
    const run = (): Promise<void> => new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['vaults'], 'readwrite');
        const store = transaction.objectStore('vaults');
        const request = store.put(vaultData);

        request.onsuccess = () => {
          console.log(`💾 Vault saved successfully in ${Date.now() - startTime}ms`);
          resolve();
        };
        request.onerror = () => {
          console.error('💾 Failed to save vault:', request.error);
          reject(request.error);
        };
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
          const result = request.result || null;
          if (result) {
            console.log('📤 Retrieved vault from IndexedDB:', {
              username: result.username,
              hasXprivEncrypted: !!(result as any).xprivEncrypted,
              xprivEncryptedLength: (result as any).xprivEncrypted?.length,
              hasPasswordSalt: !!(result as any).passwordSalt,
              identitiesCount: result.identities?.length || 0,
              identities: result.identities,
              allKeys: Object.keys(result)
            });
          } else {
            console.log('❌ No vault found in IndexedDB for username:', username);
          }
          resolve(result);
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

  async getXpriv(username: string): Promise<{ encryptedXpriv: string; pinSalt: string; passwordSalt?: string } | null> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['xprivs'], 'readonly');
      const store = tx.objectStore('xprivs');
      const request = store.get(username);
      request.onsuccess = () => {
        const row = request.result;
        if (!row) return resolve(null);
        resolve({ encryptedXpriv: row.encryptedXpriv, pinSalt: row.pinSalt, passwordSalt: row.passwordSalt });
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const vaultDB = new VaultDB();