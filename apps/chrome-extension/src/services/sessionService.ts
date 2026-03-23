import { getCryptoWorker } from './cryptoWorkerSingleton';
import type { NostrEvent } from '@nostrpass/types';

export class SessionService {
  private cryptoWorker = getCryptoWorker();

  async signEvent(username: string, event: NostrEvent, identityIndex: number) {
    const result = await this.cryptoWorker.signEventWithSession({
      username,
      event,
      identityIndex
    });
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    return result.signedEvent;
  }

  async signMessage(username: string, message: string, identityIndex: number) {
    const result = await this.cryptoWorker.signMessageWithSession({
      username,
      message,
      identityIndex
    });
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    return result.signature;
  }

  async encrypt(username: string, plaintext: string, pubkey: string, identityIndex: number) {
    const encrypted = await this.cryptoWorker.encryptWithSession({
      username,
      plaintext,
      pubkey,
      identityIndex
    });
    
    if (encrypted.error) {
      throw new Error(encrypted.error);
    }
    
    return encrypted.ciphertext;
  }

  async decrypt(username: string, ciphertext: string, pubkey: string, identityIndex: number) {
    const decrypted = await this.cryptoWorker.decryptWithSession({
      username,
      ciphertext,
      pubkey,
      identityIndex
    });
    
    if (decrypted.error) {
      throw new Error(decrypted.error);
    }
    
    return decrypted.plaintext;
  }

  async getVaultData(username: string) {
    return this.cryptoWorker.getVaultData({ username });
  }

  async updateVaultData(username: string, updates: any) {
    return this.cryptoWorker.updateVaultData({
      username,
      updates
    });
  }

  async saveSession(sessionId: string, username: string) {
    const sessionData = {
      sessionId,
      username,
      timestamp: Date.now()
    };
    localStorage.setItem('vault-session', JSON.stringify(sessionData));
  }

  async getStoredSession() {
    const savedSession = localStorage.getItem('vault-session');
    if (!savedSession) return null;
    
    try {
      return JSON.parse(savedSession);
    } catch {
      return null;
    }
  }

  async clearSession() {
    await this.cryptoWorker.clearSession();
    localStorage.removeItem('vault-session');
  }
}

export const sessionService = new SessionService();