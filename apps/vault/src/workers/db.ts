// IndexedDB helper for secure storage in worker context

// Import and re-export the unified VaultData type
import type { VaultData } from '@nostrpass/nostrHelpers';
export type { VaultData };

export interface UserSession {
  username: string;
  publicKey: string;
  privateKey?: string; // Only stored temporarily in memory
  isUnlocked: boolean;
  unlockedAt?: number;
  expiresAt?: number;
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
      identitiesCount: vaultData.identities?.length || 0
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
              username: result.username
            });
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
      const transaction = this.db!.transaction(['vaults'], 'readwrite');
      const store = transaction.objectStore('vaults');
      const request = store.delete(username);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
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