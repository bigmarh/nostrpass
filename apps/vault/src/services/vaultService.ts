import { type NostrVaultData } from '@nostrpass/nostrHelpers';
import type { CryptoWorkerMethods } from '../workers/crypto.worker';
import { 
  handleVaultError,
  VaultNotFoundError,
  VaultLockedError,
  InvalidPasswordError,
  InvalidPinError,
  WorkerError
} from '../utils/vaultErrors';

export interface VaultInitParams {
  username: string;
  password: string;
  pin?: string;
}

export interface VaultUnlockParams {
  username: string;
  password: string;
  pin?: string;
}

export interface VaultSaveParams {
  vaultData: NostrVaultData;
  userPrivateKey: string;
  userPublicKey: string;
  relays: string[];
}

export interface VaultRetrieveParams {
  userPublicKey: string;
  userPrivateKey: string;
  relays: string[];
}

export class VaultService {
  constructor(public readonly workerClient: CryptoWorkerMethods) {}

  /**
   * Initialize a new vault with master password
   */
  async initializeVault(params: VaultInitParams): Promise<{
    vaultData: NostrVaultData;
    publicKey: string;
    privateKey: string;
  }> {
    try {
    // Generate master xpriv
    const { xpriv } = await this.workerClient.generateXpriv();
    
    // Derive master keypair (index 0)
    const masterKeypair = await this.workerClient.deriveKeypairFromXpriv({
      xpriv,
      index: 0
    });

    // Derive key from password for encryption
    const { key: encryptionKey, salt } = await this.workerClient.deriveKey({
      password: params.password
    });

    // Encrypt the xpriv with the derived key
    const encryptedXpriv = await this.workerClient.encryptData({
      data: xpriv,
      password: encryptionKey
    });

    // Handle PIN if provided
    let pinSalt: string | undefined;
    let pinHash: string | undefined;
    
    if (params.pin) {
      const pinDerived = await this.workerClient.deriveKey({
        password: params.pin
      });
      pinSalt = pinDerived.salt;
      pinHash = pinDerived.key;
    }

    // Create initial vault data
    const vaultData: NostrVaultData = {
      version: 1,
      encryptedXpriv,
      salt,
      pinSalt,
      pinHash,
      identities: [{
        index: 0,
        publicKey: masterKeypair.publicKey,
        name: 'Master',
        createdAt: Date.now()
      }],
      currentIdentityIndex: 0,
      hasPin: !!params.pin,
      updatedAt: Date.now(),
      username: params.username
    };

    // Create session in worker (convert NostrVaultData to VaultData)
    await this.workerClient.createSession({
      username: params.username,
      publicKey: masterKeypair.publicKey,
      privateKey: masterKeypair.privateKey,
      vaultData: {
        username: vaultData.username!,
        publicKey: masterKeypair.publicKey,
        encryptedXpriv: vaultData.encryptedXpriv,
        salt: vaultData.salt,
        pinSalt: vaultData.pinSalt,
        pinHash: vaultData.pinHash,
        identities: vaultData.identities,
        currentIdentityIndex: vaultData.currentIdentityIndex,
        hasPin: vaultData.hasPin,
        updatedAt: vaultData.updatedAt
      },
      sessionTimeout: 60 // 60 minutes
    });

    return {
      vaultData,
      publicKey: masterKeypair.publicKey,
      privateKey: masterKeypair.privateKey
    };
    } catch (error) {
      throw handleVaultError(error);
    }
  }

  /**
   * Unlock an existing vault
   */
  async unlockVault(params: VaultUnlockParams): Promise<{
    publicKey: string;
    privateKey: string;
    vaultData: NostrVaultData | null;
  }> {
    try {
    // Get vault data from worker storage
    const vaultData = await this.workerClient.getVaultData({
      username: params.username
    });

    if (!vaultData) {
      throw new VaultNotFoundError(params.username);
    }

    // Verify PIN if required
    if (vaultData.hasPin && params.pin) {
      const pinDerived = await this.workerClient.deriveKey({
        password: params.pin,
        salt: vaultData.pinSalt
      });
      
      if (pinDerived.key !== vaultData.pinHash) {
        throw new InvalidPinError();
      }
    }

    // Derive decryption key from password
    const { key: decryptionKey } = await this.workerClient.deriveKey({
      password: params.password,
      salt: vaultData.salt
    });

    // Decrypt xpriv
    const xpriv = await this.workerClient.decryptData({
      encryptedData: vaultData.encryptedXpriv,
      password: decryptionKey
    });

    // Derive current identity keypair
    const currentIdentity = vaultData.identities[vaultData.currentIdentityIndex];
    const keypair = await this.workerClient.deriveKeypairFromXpriv({
      xpriv,
      index: vaultData.currentIdentityIndex
    });

    // Unlock session in worker
    await this.workerClient.unlockSession({
      username: params.username,
      privateKey: keypair.privateKey
    });

    return {
      publicKey: keypair.publicKey,
      privateKey: keypair.privateKey,
      vaultData
    };
    } catch (error) {
      throw handleVaultError(error);
    }
  }

  /**
   * Lock the vault (clear session)
   */
  async lockVault(username: string): Promise<void> {
    try {
      this.workerClient.clearSession({ username });
    } catch (error) {
      throw handleVaultError(error);
    }
  }

  /**
   * Get current session info
   */
  async getSession(username: string) {
    try {
      return await this.workerClient.getSession({ username });
    } catch (error) {
      throw handleVaultError(error);
    }
  }

  /**
   * Save vault to Nostr (uses vaultHelpers)
   */
  async saveVaultToNostr(params: VaultSaveParams) {
    // This will use the existing saveVaultToNostr from vaultHelpers
    // The actual Nostr communication happens in the main thread
    return params;
  }

  /**
   * Retrieve vault from Nostr (uses vaultHelpers)
   */
  async getVaultFromNostr(params: VaultRetrieveParams) {
    // This will use the existing getVaultFromNostr from vaultHelpers
    // The actual Nostr communication happens in the main thread
    return params;
  }

  /**
   * Generate a new identity
   */
  async generateNewIdentity(username: string, name: string): Promise<{
    index: number;
    publicKey: string;
    privateKey: string;
  }> {
    const vaultData = await this.workerClient.getVaultData({ username });
    if (!vaultData) {
      throw new VaultNotFoundError(username);
    }

    const session = await this.workerClient.getSession({ username });
    if (!session || !session.isUnlocked) {
      throw new VaultLockedError();
    }

    // Next identity index
    const nextIndex = vaultData.identities.length;

    // We need to decrypt xpriv to derive new identity
    // This requires the vault to be unlocked with access to the private key
    // For now, we'll throw an error indicating this needs to be done when vault is unlocked
    throw new Error('Generating new identity requires vault to be unlocked with password');
  }

  /**
   * Sign event with current session
   */
  async signEvent(username: string, event: any, identityIndex: number) {
    try {
      return await this.workerClient.signEventWithSession({
        username,
        event,
        identityIndex
      });
    } catch (error) {
      throw handleVaultError(error);
    }
  }

  /**
   * Sign message with current session
   */
  async signMessage(username: string, message: string, identityIndex: number) {
    try {
      return await this.workerClient.signMessageWithSession({
        username,
        message,
        identityIndex
      });
    } catch (error) {
      throw handleVaultError(error);
    }
  }

  /**
   * Encrypt with current session
   */
  async encrypt(username: string, plaintext: string, recipientPubkey: string, identityIndex: number) {
    try {
      return await this.workerClient.encryptWithSession({
        username,
        plaintext,
        recipientPubkey,
        identityIndex
      });
    } catch (error) {
      throw handleVaultError(error);
    }
  }

  /**
   * Decrypt with current session
   */
  async decrypt(username: string, ciphertext: string, senderPubkey: string, identityIndex: number) {
    try {
      return await this.workerClient.decryptWithSession({
        username,
        ciphertext,
        senderPubkey,
        identityIndex
      });
    } catch (error) {
      throw handleVaultError(error);
    }
  }

  /**
   * Backup vault (export encrypted)
   */
  async exportVault(username: string, exportPassword: string): Promise<string> {
    try {
      const vaultData = await this.workerClient.getVaultData({ username });
      if (!vaultData) {
        throw new VaultNotFoundError(username);
      }

    // Convert VaultData to NostrVaultData for export
    const exportData: NostrVaultData = {
      version: 1,
      encryptedXpriv: vaultData.encryptedXpriv,
      salt: vaultData.salt,
      pinSalt: vaultData.pinSalt,
      pinHash: vaultData.pinHash,
      identities: vaultData.identities,
      currentIdentityIndex: vaultData.currentIdentityIndex,
      hasPin: vaultData.hasPin,
      updatedAt: vaultData.updatedAt,
      username: vaultData.username
    };

    // Encrypt vault data with export password
    const encryptedExport = await this.workerClient.encryptData({
      data: JSON.stringify(exportData),
      password: exportPassword
    });

    return encryptedExport;
    } catch (error) {
      throw handleVaultError(error);
    }
  }

  /**
   * Restore vault from backup
   */
  async importVault(encryptedExport: string, exportPassword: string): Promise<NostrVaultData> {
    try {
      // Decrypt the export
      const decryptedData = await this.workerClient.decryptData({
        encryptedData: encryptedExport,
        password: exportPassword
      });

    const vaultData = JSON.parse(decryptedData) as NostrVaultData;

    // Validate vault data structure
    if (!vaultData.version || !vaultData.encryptedXpriv || !vaultData.salt) {
      throw new Error('Invalid vault backup format');
    }

    return vaultData;
    } catch (error) {
      throw handleVaultError(error);
    }
  }
}