import { getCryptoWorker } from './cryptoWorkerSingleton';
import { getIdentityKeypair, getStorageKeypair, createUser } from './userService';
import type { User, UserProfile } from '@nostrpass/types';

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isVaultLocked: boolean;
  hasPinVault: boolean;
}

export class AuthService {
  private cryptoWorker = getCryptoWorker();

  async createAccount(
    username: string,
    password: string,
    pin?: string,
    recoveryQuestions?: Array<{ question: string; answer: string }>
  ) {
    // Generate master key
    const userMasterKey = await createUser();
    
    // Get storage keypair
    const { publicKey: storagePublicKey } = await getStorageKeypair(userMasterKey.xpriv);
    
    // Get first identity keypair
    const personalIdentity = { nickname: 'Personal', index: 0 };
    const { publicKey: personalPublicKey } = await getIdentityKeypair(userMasterKey.xpriv, personalIdentity);
    
    // Derive encryption key from password
    const passwordDeriveResult = await this.cryptoWorker.deriveKey({
      password,
      username
    });
    
    let encryptionKey: string;
    if (passwordDeriveResult instanceof Map) {
      encryptionKey = passwordDeriveResult.get('key');
    } else {
      encryptionKey = passwordDeriveResult.key;
    }
    
    // Build vault data
    const vaultData: any = {
      username,
      salt: passwordDeriveResult.salt || passwordDeriveResult.get('salt'),
      publicKey: personalPublicKey,
      storagePublicKey,
      hasPin: !!pin,
      updatedAt: Date.now(),
      version: 1
    };
    
    // Handle PIN if provided
    if (pin) {
      const saltBytes = new Uint8Array(16);
      crypto.getRandomValues(saltBytes);
      const pinSalt = btoa(String.fromCharCode(...saltBytes));
      
      const encoder = new TextEncoder();
      const pinData = encoder.encode(pin);
      const hash = await crypto.subtle.digest('SHA-256', pinData);
      const hashArray = new Uint8Array(hash);
      const pinHash = btoa(String.fromCharCode(...hashArray));
      
      vaultData.pinSalt = pinSalt;
      vaultData.pinHash = pinHash;
    }
    
    // Encrypt xpriv
    const xprivEncrypted = await this.cryptoWorker.encryptData({
      data: userMasterKey.xpriv,
      key: encryptionKey
    });
    vaultData.xprivEncrypted = xprivEncrypted;
    
    // Create session
    const sessionInfo = await this.cryptoWorker.createSession({
      username,
      publicKey: storagePublicKey,
      xpriv: userMasterKey.xpriv,
      vaultData,
      sessionTimeout: 60
    });
    
    return {
      user: {
        publicKey: personalPublicKey,
        privateKey: '',
        profile: {
          username,
          createdAt: Date.now()
        }
      },
      sessionInfo,
      vaultData
    };
  }

  async login(password: string, username: string, vaultData: any) {
    // Derive key from password
    const encryptDeriveResult = await this.cryptoWorker.deriveKey({
      password,
      salt: vaultData.salt
    });
    
    let encryptionKey: string;
    if (encryptDeriveResult instanceof Map) {
      encryptionKey = encryptDeriveResult.get('key');
    } else {
      encryptionKey = encryptDeriveResult.key;
    }
    
    // Decrypt the master key
    const xpriv = await this.cryptoWorker.decryptData({
      encryptedData: vaultData.xprivEncrypted,
      key: encryptionKey
    });
    
    // Get keypairs
    const { privateKey } = await getStorageKeypair(xpriv);
    const currentIdentity = vaultData.identities?.[0] || { 
      nickname: 'Personal', 
      index: 0,
      publicKey: vaultData.publicKey 
    };
    const keypair = await getIdentityKeypair(xpriv, currentIdentity);
    
    // Create session
    const sessionInfo = await this.cryptoWorker.createSession({
      username: vaultData.username || username,
      publicKey: vaultData.storagePublicKey,
      xpriv,
      vaultData,
      sessionTimeout: 60
    });
    
    return {
      user: {
        publicKey: currentIdentity.publicKey,
        privateKey: keypair.privateKey,
        profile: {
          username: vaultData.username || username,
          nickname: currentIdentity.nickname,
          createdAt: vaultData.createdAt || Date.now()
        }
      },
      sessionInfo
    };
  }

  async unlockWithPin(pin: string, vaultData: any, encryptionKey: string) {
    // Verify PIN
    const encoder = new TextEncoder();
    const pinData = encoder.encode(pin);
    const hash = await crypto.subtle.digest('SHA-256', pinData);
    const hashArray = new Uint8Array(hash);
    const pinHash = btoa(String.fromCharCode(...hashArray));
    
    if (pinHash !== vaultData.pinHash) {
      throw new Error('Invalid PIN');
    }
    
    // Decrypt with PIN
    const pinDeriveResult = await this.cryptoWorker.deriveKey({
      password: pin,
      salt: vaultData.pinSalt
    });
    
    let pinKey: string;
    if (pinDeriveResult instanceof Map) {
      pinKey = pinDeriveResult.get('key');
    } else {
      pinKey = pinDeriveResult.key;
    }
    
    const xprivEncryptedPin = await this.cryptoWorker.decryptData({
      encryptedData: vaultData.xprivEncryptedPin,
      key: pinKey
    });
    
    const xpriv = await this.cryptoWorker.decryptData({
      encryptedData: xprivEncryptedPin,
      key: encryptionKey
    });
    
    return xpriv;
  }

  async logout() {
    await this.cryptoWorker.clearSession();
    localStorage.removeItem('vault-session');
  }

  async restoreSession(sessionId: string) {
    const workerSession = await this.cryptoWorker.getSession({ 
      sessionId 
    });
    
    if (workerSession) {
      const vaultData = await this.cryptoWorker.getVaultData({ 
        username: workerSession.username 
      });
      
      if (vaultData) {
        return {
          user: {
            publicKey: vaultData.publicKey,
            privateKey: '',
            profile: {
              username: vaultData.username,
              createdAt: vaultData.createdAt || Date.now()
            }
          },
          vaultData,
          sessionInfo: workerSession
        };
      }
    }
    
    return null;
  }
}

export const authService = new AuthService();