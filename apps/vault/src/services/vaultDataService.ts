import { getCryptoWorker } from './cryptoWorkerSingleton';
import type { VaultData } from '../workers/db';
import type { Identity } from '@nostrpass/types';

export interface VaultDataOptions {
  forceRefresh?: boolean;
}

export interface UpdateVaultDataOptions {
  syncToNostr?: boolean;
  updateTimestamp?: boolean;
}

export class VaultDataService {
  private static instance: VaultDataService;
  private cache = new Map<string, { data: VaultData; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): VaultDataService {
    if (!VaultDataService.instance) {
      VaultDataService.instance = new VaultDataService();
    }
    return VaultDataService.instance;
  }

  /**
   * Get vault data for a user with optional caching
   */
  async getVaultData(username: string, options: VaultDataOptions = {}): Promise<VaultData | null> {
    const { forceRefresh = false } = options;
    
    // Check cache first (unless force refresh is requested)
    if (!forceRefresh) {
      const cached = this.cache.get(username);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.data;
      }
    }

    const cryptoWorker = getCryptoWorker();
    if (!cryptoWorker) {
      throw new Error('Crypto worker not ready');
    }

    try {
      const vaultData = await cryptoWorker.getVaultData({ username });
      
      if (vaultData) {
        // Cache the result
        this.cache.set(username, { data: vaultData, timestamp: Date.now() });
      }
      
      return vaultData;
    } catch (error) {
      console.error('Failed to get vault data:', error);
      throw new Error(`Failed to load vault data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update vault data for a user
   */
  async updateVaultData(
    username: string, 
    updates: Partial<VaultData> | VaultData | ((current: VaultData) => Partial<VaultData>),
    options: UpdateVaultDataOptions = {}
  ): Promise<void> {
    const { syncToNostr = false, updateTimestamp = true } = options;
    
    const cryptoWorker = getCryptoWorker();
    if (!cryptoWorker) {
      throw new Error('Crypto worker not ready');
    }

    try {
      let updatedData: VaultData;

      // Handle different types of updates
      if (typeof updates === 'function') {
        // Function-based update (old approach)
        const currentData = await this.getVaultData(username, { forceRefresh: true });
        if (!currentData) {
          throw new Error('Vault data not found');
        }
        updatedData = {
          ...currentData,
          ...updates(currentData),
          ...(updateTimestamp ? { updatedAt: Date.now() } : {})
        };
      } else if (updates && typeof updates === 'object' && 'username' in updates) {
        // Complete VaultData object (new approach from hook)
        updatedData = {
          ...updates,
          ...(updateTimestamp ? { updatedAt: Date.now() } : {})
        } as VaultData;
      } else {
        // Partial update object
        const currentData = await this.getVaultData(username, { forceRefresh: true });
        if (!currentData) {
          throw new Error('Vault data not found');
        }
        updatedData = {
          ...currentData,
          ...updates,
          ...(updateTimestamp ? { updatedAt: Date.now() } : {})
        };
      }

      // Update in crypto worker
      await cryptoWorker.updateVaultData({ username, vaultData: updatedData });

      // Update cache
      this.cache.set(username, { data: updatedData, timestamp: Date.now() });

      // Sync to Nostr if requested
      if (syncToNostr) {
        await this.syncToNostr(username);
      }
    } catch (error) {
      console.error('Failed to update vault data:', error);
      throw new Error(`Failed to update vault data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific identity from vault data
   */
  async getIdentity(username: string, identityIndex: number): Promise<Identity | null> {
    const vaultData = await this.getVaultData(username);
    if (!vaultData?.identities) return null;
    
    return vaultData.identities[identityIndex] || null;
  }

  /**
   * Get the current active identity
   */
  async getCurrentIdentity(username: string): Promise<{ identity: Identity; index: number } | null> {
    const vaultData = await this.getVaultData(username);
    if (!vaultData?.identities) return null;

    const index = vaultData.currentIdentityIndex ?? 0;
    const identity = vaultData.identities[index];
    
    if (!identity) return null;
    
    return { identity, index };
  }

  /**
   * Update a specific identity
   */
  async updateIdentity(
    username: string, 
    identityIndex: number, 
    updates: Partial<Identity>
  ): Promise<void> {
    await this.updateVaultData(username, (current) => {
      const updatedIdentities = [...(current.identities || [])];
      updatedIdentities[identityIndex] = {
        ...updatedIdentities[identityIndex],
        ...updates
      };
      return { identities: updatedIdentities };
    });
  }

  /**
   * Switch to a different identity
   */
  async switchIdentity(username: string, newIdentityIndex: number): Promise<void> {
    await this.updateVaultData(username, { currentIdentityIndex: newIdentityIndex });
  }

  /**
   * Add a new identity
   */
  async addIdentity(username: string, identity: Identity): Promise<void> {
    await this.updateVaultData(username, (current) => {
      const updatedIdentities = [...(current.identities || []), identity];
      return { identities: updatedIdentities };
    });
  }

  /**
   * Remove an identity
   */
  async removeIdentity(username: string, identityIndex: number): Promise<void> {
    await this.updateVaultData(username, (current) => {
      const updatedIdentities = [...(current.identities || [])];
      updatedIdentities.splice(identityIndex, 1);
      
      // Adjust current identity index if needed
      let currentIndex = current.currentIdentityIndex ?? 0;
      if (identityIndex <= currentIndex && currentIndex > 0) {
        currentIndex--;
      }
      
      return { 
        identities: updatedIdentities,
        currentIdentityIndex: currentIndex
      };
    });
  }

  /**
   * Sync vault data to Nostr
   */
  async syncToNostr(username: string): Promise<void> {
    const cryptoWorker = getCryptoWorker();
    if (!cryptoWorker) {
      throw new Error('Crypto worker not ready');
    }

    try {
      console.log('🔄 Starting Nostr sync for user:', username);
      
      // Create vault event
      const vaultEvent = await cryptoWorker.saveVaultToNostr({ username });
      console.log('✅ Vault event created:', vaultEvent.event.id);
      
      // Get relays and publish
      const { publishEvent } = await import('@nostrpass/nostrHelpers');
      const { getRelays } = await import('../providers/EnvironmentProvider');
      const relays = getRelays();
      console.log('📡 Publishing to relays:', relays);
      
      const publishedRelays = await publishEvent(vaultEvent.event, relays);
      console.log('✅ Vault synced to Nostr successfully:', publishedRelays);
    } catch (error) {
      console.error('❌ Failed to sync vault to Nostr:', error);
      throw new Error(`Failed to sync to Nostr: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current session status from worker
   */
  async getSessionStatus(): Promise<{ sessionId: string | null; username: string | null }> {
    const cryptoWorker = getCryptoWorker();
    if (!cryptoWorker) {
      return { sessionId: null, username: null };
    }

    try {
      return await cryptoWorker.getSessionStatus();
    } catch (error) {
      console.error('Failed to get session status:', error);
      return { sessionId: null, username: null };
    }
  }

  /**
   * Get vault data from Nostr
   */
  async getVaultFromNostr(username: string): Promise<{ vaultData: any; eventId: string; timestamp: number } | null> {
    const cryptoWorker = getCryptoWorker();
    if (!cryptoWorker) {
      throw new Error('Crypto worker not ready');
    }

    try {
      console.log('🔄 Getting vault from Nostr for user:', username);
      const result = await cryptoWorker.getVaultFromNostr({ username });
      console.log('✅ Vault retrieved from Nostr:', result ? `event ${result.eventId}` : 'not found');
      return result;
    } catch (error) {
      console.error('❌ Failed to get vault from Nostr:', error);
      throw new Error(`Failed to get vault from Nostr: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear cache for a specific user or all users
   */
  clearCache(username?: string): void {
    if (username) {
      this.cache.delete(username);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics (useful for debugging)
   */
  getCacheStats(): { size: number; entries: Array<{ username: string; age: number }> } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([username, { timestamp }]) => ({
      username,
      age: now - timestamp
    }));

    return {
      size: this.cache.size,
      entries
    };
  }

  /**
   * Check if vault data is cached and fresh
   */
  isCached(username: string): boolean {
    const cached = this.cache.get(username);
    return cached ? (Date.now() - cached.timestamp < this.CACHE_DURATION) : false;
  }

  /**
   * Check permissions for an operation (delegates to worker)
   */
  async checkPermission(
    username: string,
    origin: string,
    action: 'signEvent' | 'signData' | 'getPublicKey' | 'nip04' | 'getRelays',
    eventKind?: number
  ): Promise<{ allowed: boolean; level: string; needsPrompt: boolean }> {
    const cryptoWorker = getCryptoWorker();
    if (!cryptoWorker) {
      throw new Error('Crypto worker not ready');
    }

    return cryptoWorker.checkPermission({ username, origin, action, eventKind });
  }

  /**
   * Grant session permission (delegates to worker)
   */
  async grantSessionPermission(
    username: string,
    origin: string,
    action: 'signEvent' | 'signData',
    eventKind?: number,
    sessionDurationMinutes: number = 60
  ): Promise<void> {
    const cryptoWorker = getCryptoWorker();
    if (!cryptoWorker) {
      throw new Error('Crypto worker not ready');
    }

    await cryptoWorker.grantSessionPermission({ 
      username, 
      origin, 
      action, 
      eventKind, 
      sessionDurationMinutes 
    });
  }

  /**
   * Get app permissions (delegates to worker)
   */
  async getAppPermissions(username: string, origin: string): Promise<any> {
    const cryptoWorker = getCryptoWorker();
    if (!cryptoWorker) {
      throw new Error('Crypto worker not ready');
    }

    return cryptoWorker.getAppPermissions({ username, origin });
  }

  /**
   * Save app permissions (delegates to worker)
   */
  async saveAppPermissions(
    username: string,
    origin: string,
    permissions: any,
    appName?: string
  ): Promise<void> {
    const cryptoWorker = getCryptoWorker();
    if (!cryptoWorker) {
      throw new Error('Crypto worker not ready');
    }

    await cryptoWorker.saveAppPermissions({ username, origin, permissions, appName });
  }
}

// Export singleton instance
export const vaultDataService = VaultDataService.getInstance(); 