import { 
  saveVaultToNostr, 
  getVaultFromNostr, 
  vaultExistsOnNostr,
  deleteVaultFromNostr,
  type NostrVaultData 
} from '@nostrpass/nostrHelpers';
import { VaultService } from './vaultService';
import { handleVaultError, NetworkError, VaultNotFoundError, SyncError } from '../utils/vaultErrors';

export interface VaultStorageConfig {
  relays: string[];
  vaultService: VaultService;
}

export class VaultStorageService {
  constructor(private config: VaultStorageConfig) {}

  /**
   * Save vault to Nostr network
   */
  async saveToNostr(
    username: string, 
    userPrivateKey: string,
    userPublicKey: string
  ): Promise<string[]> {
    try {
      // Get current vault data from worker
      const vaultData = await this.config.vaultService.workerClient.getVaultData({ username });
      
      if (!vaultData) {
        throw new VaultNotFoundError(username);
      }

      // Save to Nostr using the helper
      return await saveVaultToNostr(
        vaultData,
        userPrivateKey,
        userPublicKey,
        this.config.relays
      );
    } catch (error) {
      if (error instanceof VaultNotFoundError) {
        throw error;
      }
      throw new NetworkError('Failed to save vault to Nostr', error);
    }
  }

  /**
   * Retrieve vault from Nostr and load into worker
   */
  async retrieveFromNostr(
    userPublicKey: string,
    userPrivateKey: string
  ): Promise<NostrVaultData | null> {
    try {
      // Get vault from Nostr
      const vaultData = await getVaultFromNostr(
        userPublicKey,
        userPrivateKey,
        this.config.relays
      );

      if (!vaultData) {
        return null;
      }

      // Create session with retrieved vault data
      await this.config.vaultService.workerClient.createSession({
        username: vaultData.username || userPublicKey,
        publicKey: userPublicKey,
        privateKey: userPrivateKey,
        vaultData,
        sessionTimeout: 60
      });

      return vaultData;
    } catch (error) {
      throw new NetworkError('Failed to retrieve vault from Nostr', error);
    }
  }

  /**
   * Check if vault exists on Nostr
   */
  async checkVaultExists(userPublicKey: string): Promise<boolean> {
    try {
      return await vaultExistsOnNostr(userPublicKey, this.config.relays);
    } catch (error) {
      throw new NetworkError('Failed to check vault existence', error);
    }
  }

  /**
   * Delete vault from Nostr
   */
  async deleteFromNostr(
    userPrivateKey: string,
    userPublicKey: string
  ): Promise<void> {
    try {
      await deleteVaultFromNostr(
        userPrivateKey,
        userPublicKey,
        this.config.relays
      );
      
      // Also clear from local worker storage
      const username = await this.findUsernameByPublicKey(userPublicKey);
      if (username) {
        this.config.vaultService.lockVault(username);
      }
    } catch (error) {
      throw new NetworkError('Failed to delete vault from Nostr', error);
    }
  }

  /**
   * Sync vault between local and Nostr
   */
  async syncVault(
    username: string,
    userPrivateKey: string,
    userPublicKey: string
  ): Promise<{
    localVersion: NostrVaultData | null;
    remoteVersion: NostrVaultData | null;
    synced: boolean;
  }> {
    try {
      // Get local version
      const localVault = await this.config.vaultService.workerClient.getVaultData({ username });
      
      // Get remote version
      const remoteVault = await getVaultFromNostr(
        userPublicKey,
        userPrivateKey,
        this.config.relays
      );

      // Compare timestamps
      if (!localVault && !remoteVault) {
        return { localVersion: null, remoteVersion: null, synced: true };
      }

      if (!localVault && remoteVault) {
        // Load remote into local
        await this.config.vaultService.workerClient.createSession({
          username: remoteVault.username || username,
          publicKey: userPublicKey,
          privateKey: userPrivateKey,
          vaultData: remoteVault,
          sessionTimeout: 60
        });
        return { localVersion: remoteVault, remoteVersion: remoteVault, synced: true };
      }

      if (localVault && !remoteVault) {
        // Save local to remote
        await saveVaultToNostr(
          localVault,
          userPrivateKey,
          userPublicKey,
          this.config.relays
        );
        return { localVersion: localVault, remoteVersion: localVault, synced: true };
      }

      // Both exist - check which is newer
      if (localVault && remoteVault) {
        if (localVault.updatedAt > remoteVault.updatedAt) {
          // Local is newer - save to remote
          await saveVaultToNostr(
            localVault,
            userPrivateKey,
            userPublicKey,
            this.config.relays
          );
          return { localVersion: localVault, remoteVersion: localVault, synced: true };
        } else if (remoteVault.updatedAt > localVault.updatedAt) {
          // Remote is newer - update local
          await this.config.vaultService.workerClient.createSession({
            username: remoteVault.username || username,
            publicKey: userPublicKey,
            privateKey: userPrivateKey,
            vaultData: remoteVault,
            sessionTimeout: 60
          });
          return { localVersion: remoteVault, remoteVersion: remoteVault, synced: true };
        }
      }

      return { localVersion: localVault, remoteVersion: remoteVault, synced: true };
    } catch (error) {
      throw new SyncError('Failed to sync vault', error);
    }
  }

  /**
   * Helper to find username by public key
   */
  private async findUsernameByPublicKey(publicKey: string): Promise<string | null> {
    // This would need to be implemented based on how you store the mapping
    // For now, return the public key as username
    return publicKey;
  }
}