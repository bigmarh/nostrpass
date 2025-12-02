import { getCryptoWorker } from './cryptoWorkerSingleton';
import type { VaultData } from '../workers/db';
import type { Identity } from '@nostrpass/types';
import { SimplePool } from 'nostr-tools';
// NDK removed: worker handles realtime subscriptions via nostr-tools

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
  
  // Nostr subscription management
  private pool: SimplePool | null = null;
  private activeSubscriptions = new Map<string, { unsubscribe: any; relays: string[] }>();
  private vaultUpdateCallbacks = new Map<string, Set<(vaultData: VaultData) => void>>();

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
    // STREAMLINED: Always sync to Nostr (removed flag, always true)
    const { updateTimestamp = true } = options;

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

      // Update in crypto worker - ALWAYS syncs to Nostr (streamlined approach)
      await cryptoWorker.updateVaultData({
        username,
        vaultData: updatedData,
        options: { syncToNostr: true }  // Always true!
      });

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
    if (!vaultData?.identities || vaultData.identities.length === 0) return null;
    const identity = vaultData.identities[0];
    return { identity, index: 0 };
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
  async switchIdentity(_username: string, _newIdentityIndex: number): Promise<void> {
    // No-op: identity selection is now per-app/tab and not persisted
    return;
  }

  /**
   * Add a new identity
   */
  async addIdentity(username: string, identity: Identity): Promise<void> {
    await this.updateVaultData(username, (current) => {
      const updatedIdentities = [...(current.identities || []), identity];
      return { identities: updatedIdentities };
    }, { syncToNostr: true }); // Auto-sync when adding identity
  }

  /**
   * Remove an identity
   */
  async removeIdentity(username: string, identityIndex: number): Promise<void> {
    await this.updateVaultData(username, (current) => {
      const updatedIdentities = [...(current.identities || [])];
      updatedIdentities.splice(identityIndex, 1);
      
      return { 
        identities: updatedIdentities
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
      console.log('📤 [syncToNostr] Syncing vault data to Nostr...');
      await cryptoWorker.saveVaultToNostr({ username });
      console.log('✅ [syncToNostr] Vault data synced to Nostr successfully');
    } catch (error) {
      console.error('❌ [syncToNostr] Failed to sync vault to Nostr:', error);
      throw error;
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
   * Get LoginObj from Nostr
   */
  async getLoginObj(username: string, environment: string = 'prod'): Promise<any | null> {
    const cryptoWorker = getCryptoWorker();
    if (!cryptoWorker) {
      throw new Error('Crypto worker not ready');
    }

    try {
      console.log('🔄 Getting LoginObj from Nostr for user:', username);
      const result = await cryptoWorker.getLoginObj({ username, environment });
      console.log('✅ LoginObj retrieved from Nostr:', result ? 'found' : 'not found');
      return result?.loginObj || null;
    } catch (error) {
      console.error('❌ Failed to get LoginObj from Nostr:', error);
      throw new Error(`Failed to get LoginObj from Nostr: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get vault data from Nostr
   */
  async getVaultFromNostr(username: string): Promise<{ vaultData: any; eventId: string; timestamp: number } | null> {
    // PRE model: use author-only PRE assembly via worker instead
    console.warn('getVaultFromNostr is deprecated under PRE model.');
    return null;
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
  async getAppPermissions(username: string, origin: string, identityIndex?: number): Promise<any> {
    const cryptoWorker = getCryptoWorker();
    if (!cryptoWorker) {
      throw new Error('Crypto worker not ready');
    }

    // Clear cache to ensure we get fresh data
    this.clearCache(username);

    return cryptoWorker.getAppPermissions({ username, origin, identityIndex });
  }

  /**
   * Save app permissions (delegates to worker)
   */
  async saveAppPermissions(
    username: string,
    origin: string,
    permissions: any,
    _appName?: string,
    identityIndex?: number
  ): Promise<void> {
    const cryptoWorker = getCryptoWorker();
    if (!cryptoWorker) {
      throw new Error('Crypto worker not ready');
    }

    // Determine active identity path prior to saving
    const vaultData = await this.getVaultData(username);
    const identities = vaultData?.identities || [];
    const idx = typeof identityIndex === 'number' ? identityIndex : 0;
    const path = identities[idx]?.path || `m/44'/1237'/0'/0/${idx}`;

    // Persist permissions inside the worker/vault
    await cryptoWorker.saveAppPermissions({
      username,
      origin,
      permissions,
      appName: _appName,
      identityIndex: idx
    });

    // Publish permissions PRE via worker (best effort)
    try {
      const latestPermissions = await cryptoWorker.getAppPermissions({
        username,
        origin,
        identityIndex: idx
      });
      await (cryptoWorker as any).publishPermissions({
        username,
        path,
        appDomain: origin,
        permissions: latestPermissions || permissions || {}
      });
    } catch (e) {
      console.warn('[saveAppPermissions] Failed to publish PRE permissions (non-critical):', e);
    }
    
    // Clear cache to ensure fresh data is loaded next time
    this.clearCache(username);
  }

  // NDK subscription removed. Realtime is managed in the worker via nostr-tools.

  // Legacy handler removed

  /**
   * Get subscription status
   */
  getSubscriptionStatus(_username: string): { isSubscribed: boolean; relays: string[] } {
    return { isSubscribed: false, relays: [] };
  }

  /**
   * Cleanup all subscriptions (call on app shutdown)
   */
  cleanup(): void {
    console.log('🧹 [cleanup] Cleaning up all subscriptions...');
    
    // Unsubscribe from all active subscriptions
    for (const [username, subscription] of this.activeSubscriptions) {
      try {
        subscription.unsubscribe();
        console.log('✅ [cleanup] Unsubscribed from:', username);
      } catch (error) {
        console.error('❌ [cleanup] Failed to unsubscribe from:', username, error);
      }
    }
    
    // Clear all data
    this.activeSubscriptions.clear();
    this.vaultUpdateCallbacks.clear();
    
    // Close pool
    if (this.pool) {
      try {
        this.pool.close([]);
        this.pool = null;
        console.log('✅ [cleanup] Closed Nostr pool');
      } catch (error) {
        console.error('❌ [cleanup] Failed to close pool:', error);
      }
    }
    
    // NDK removed
  }
}

// Export singleton instance
export const vaultDataService = VaultDataService.getInstance(); 