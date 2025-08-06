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
      };
    });
  }

  async saveVault(vaultData: VaultData): Promise<void> {
    if (!this.db) await this.init();
    
    console.log('💾 Saving vault to IndexedDB:', {
      username: vaultData.username,
      hasXprivEncryptedForPin: !!vaultData.xprivEncryptedForPin,
      xprivEncryptedForPinLength: vaultData.xprivEncryptedForPin?.length
    });
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['vaults'], 'readwrite');
      const store = transaction.objectStore('vaults');
      const request = store.put(vaultData);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getVault(username: string): Promise<VaultData | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['vaults'], 'readonly');
      const store = transaction.objectStore('vaults');
      const request = store.get(username);

      request.onsuccess = () => {
        const result = request.result || null;
        if (result) {
          console.log('📤 Retrieved vault from IndexedDB:', {
            username: result.username,
            hasXprivEncryptedForPin: !!result.xprivEncryptedForPin,
            xprivEncryptedForPinLength: result.xprivEncryptedForPin?.length
          });
        }
        resolve(result);
      };
      request.onerror = () => reject(request.error);
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

  async saveSession(session: UserSession): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.put(session);

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
}

export const vaultDB = new VaultDB();