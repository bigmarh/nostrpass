import { getCryptoWorker } from './cryptoWorkerSingleton';
import type { VaultData } from '../workers/db';
import type { Identity } from '@nostrpass/types';
import { SimplePool, NostrEvent } from 'nostr-tools';
import NDK from '@nostr-dev-kit/ndk';

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
  private ndk: NDK | null = null;
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
    });
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
    console.log('🔄 [syncToNostr] Called for user:', username);
    const cryptoWorker = getCryptoWorker();
    console.log('🔄 [syncToNostr] Crypto worker status:', !!cryptoWorker);
    if (!cryptoWorker) {
      console.error('❌ [syncToNostr] Crypto worker not ready');
      throw new Error('Crypto worker not ready');
    }

    try {
      console.log('🔄 [syncToNostr] Starting Nostr sync for user:', username);
      
      // Create vault event
      const vaultEvent = await cryptoWorker.saveVaultToNostr({ username });
      console.log('✅ Vault event created:', vaultEvent.event.id);
      
      // Get relays - prefer user's custom relays if set
      const { publishEvent } = await import('@nostrpass/nostrHelpers');
      const { getRelays } = await import('../providers/EnvironmentProvider');
      const vaultData = await this.getVaultData(username);
      const relays = vaultData?.customRelays && vaultData.customRelays.length > 0 
        ? vaultData.customRelays 
        : getRelays();
      console.log('📡 Publishing to relays:', relays, vaultData?.customRelays ? '(custom)' : '(default)');
      
      // For background syncs, don't use worker for PoW (keeps worker free for user operations)
      // PoW runs in main thread, but it's OK since this is already a background operation
      const publishedRelays = await publishEvent(vaultEvent.event, relays);
      console.log('✅ Vault synced to Nostr successfully:', publishedRelays);
      
      // Broadcast vault update to other tabs
      try {
        const refreshEvent = new CustomEvent('vault-data-refresh', { 
          detail: { username, timestamp: Date.now() } 
        });
        window.dispatchEvent(refreshEvent);
        console.log('📡 [syncToNostr] Broadcasted vault update to other tabs');
      } catch (broadcastError) {
        console.warn('⚠️ [syncToNostr] Failed to broadcast vault update:', broadcastError);
      }
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
    appName?: string,
    identityIndex?: number
  ): Promise<void> {
    const cryptoWorker = getCryptoWorker();
    if (!cryptoWorker) {
      throw new Error('Crypto worker not ready');
    }

    // Determine active identity path
    const vaultData = await this.getVaultData(username);
    const identities = vaultData?.identities || [];
    const idx = typeof identityIndex === 'number' ? identityIndex : 0;
    const path = identities[idx]?.path || `m/44'/1237'/0'/0/${idx}`;

    // Publish permissions PRE via worker
    try {
      await (cryptoWorker as any).publishPermissions({
        username,
        path,
        appDomain: origin,
        appPermissions: permissions?.allowed || []
      });
    } catch (e) {
      console.warn('[saveAppPermissions] Failed to publish PRE permissions (non-critical):', e);
    }
    
    // Clear cache to ensure fresh data is loaded next time
    this.clearCache(username);
  }

  /**
   * Subscribe to real-time vault updates via Nostr using NDK
   */
  async subscribeToVaultUpdates(
    username: string,
    storagePublicKey: string,
    storagePrivateKey: string,
    onUpdate: (vaultData: VaultData) => void
  ): Promise<void> {
    console.log('🔔 [subscribeToVaultUpdates] Setting up NDK subscription for:', username);
    
    // Initialize NDK if needed
    if (!this.ndk) {
      const { getRelays } = await import('../providers/EnvironmentProvider');
      const relays = getRelays();
      
      this.ndk = new NDK({
        explicitRelayUrls: relays,
        enableOutboxModel: false
      });
      
      await this.ndk.connect();
      console.log('🔔 [subscribeToVaultUpdates] NDK connected to relays:', relays);
    }

    // Get relays
    const { getRelays } = await import('../providers/EnvironmentProvider');
    const { getEnvironment } = await import('@nostrpass/nostrHelpers');
    const vaultData = await this.getVaultData(username);
    const relays = vaultData?.customRelays && vaultData.customRelays.length > 0 
      ? vaultData.customRelays 
      : getRelays();

    // Store callback
    if (!this.vaultUpdateCallbacks.has(username)) {
      this.vaultUpdateCallbacks.set(username, new Set());
    }
    this.vaultUpdateCallbacks.get(username)!.add(onUpdate);

    // If already subscribed, just add the callback
    if (this.activeSubscriptions.has(username)) {
      console.log('🔔 [subscribeToVaultUpdates] Already subscribed, adding callback');
      return;
    }

    // Set up Nostr filter for vault events
    const env = getEnvironment();
    const expectedDTag = `nostrpass.com_vault_${storagePublicKey}_${env}`;
    
    const filter = {
      kinds: [30078], // NIP-78 arbitrary custom app data
      authors: [storagePublicKey],
      '#d': [expectedDTag],
      // Listen to both initial (password-encrypted) and sync (nip04) vault events
      '#encryption': ['nip04', 'password-aes']
    };

    console.log('🔔 [subscribeToVaultUpdates] NDK Filter:', {
      expectedDTag,
      storagePublicKey: storagePublicKey.slice(0, 16),
      relays: relays.length
    });

    // Subscribe to vault updates using NDK
    const subscription = this.ndk.subscribe(filter, {
      closeOnEose: false, // Keep subscription open for real-time updates
      groupable: false
    });

    subscription.on('event', (event: any) => {
      console.log('🔔 [subscribeToVaultUpdates] Received vault event via NDK:', {
        id: event.id.slice(0, 8),
        created_at: new Date(event.created_at * 1000).toISOString(),
        author: event.pubkey.slice(0, 16)
      });

      // Convert NDK event to NostrEvent format for compatibility
      const nostrEvent: NostrEvent = {
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at,
        kind: event.kind,
        tags: event.tags,
        content: event.content,
        sig: event.sig
      };

      // Decrypt and process the vault update
      this.handleVaultUpdateEvent(nostrEvent, username, storagePublicKey, storagePrivateKey, relays);
    });

    // Store subscription info
    this.activeSubscriptions.set(username, { unsubscribe: () => subscription.stop(), relays });
    console.log('✅ [subscribeToVaultUpdates] NDK subscription active for:', username);
  }

  /**
   * Unsubscribe from vault updates
   */
  async unsubscribeFromVaultUpdates(username: string): Promise<void> {
    console.log('🔕 [unsubscribeFromVaultUpdates] Unsubscribing:', username);
    
    const subscription = this.activeSubscriptions.get(username);
    if (subscription) {
      subscription.unsubscribe();
      this.activeSubscriptions.delete(username);
      console.log('✅ [unsubscribeFromVaultUpdates] Unsubscribed from:', username);
    }

    // Clear callbacks
    this.vaultUpdateCallbacks.delete(username);
  }

  /**
   * Handle incoming vault update event
   */
  private async handleVaultUpdateEvent(
    event: NostrEvent,
    username: string,
    storagePublicKey: string,
    storagePrivateKey: string,
    _relays: string[]
  ): Promise<void> {
    try {
      console.log('🔔 [handleVaultUpdateEvent] Processing vault update...');
      
      // Decrypt the vault data using storagePrivateKey (NIP-04)
      const { decrypt } = await import('nostr-tools/nip04');
      const decryptedContent = await decrypt(storagePrivateKey, storagePublicKey, event.content);
      const vaultData = JSON.parse(decryptedContent) as VaultData;
      
      console.log('✅ [handleVaultUpdateEvent] Decrypted vault update:', {
        identities: vaultData.identities?.length || 0,
        updatedAt: new Date(vaultData.updatedAt || 0).toISOString()
      });

      // Update local cache
      this.cache.set(username, { data: vaultData, timestamp: Date.now() });

      // Update crypto worker
      const cryptoWorker = getCryptoWorker();
      if (cryptoWorker) {
        await cryptoWorker.updateVaultData({ username, vaultData });
      }

      // Notify all callbacks
      const callbacks = this.vaultUpdateCallbacks.get(username);
      if (callbacks) {
        callbacks.forEach(callback => {
          try {
            callback(vaultData);
          } catch (error) {
            console.error('❌ [handleVaultUpdateEvent] Callback error:', error);
          }
        });
      }

      // Also broadcast to other tabs (redundant but ensures compatibility)
      try {
        const refreshEvent = new CustomEvent('vault-data-refresh', { 
          detail: { username, timestamp: Date.now(), source: 'nostr' } 
        });
        window.dispatchEvent(refreshEvent);
        console.log('📡 [handleVaultUpdateEvent] Broadcasted to other tabs');
      } catch (broadcastError) {
        console.warn('⚠️ [handleVaultUpdateEvent] Failed to broadcast:', broadcastError);
      }

    } catch (error) {
      console.error('❌ [handleVaultUpdateEvent] Failed to process vault update:', error);
    }
  }

  /**
   * Get subscription status
   */
  getSubscriptionStatus(username: string): { isSubscribed: boolean; relays: string[] } {
    const subscription = this.activeSubscriptions.get(username);
    return {
      isSubscribed: !!subscription,
      relays: subscription?.relays || []
    };
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
    
    // Close NDK
    if (this.ndk) {
      try {
        // NDK doesn't have a destroy method, just clear the reference
        this.ndk = null;
        console.log('✅ [cleanup] Cleared NDK reference');
      } catch (error) {
        console.error('❌ [cleanup] Failed to clear NDK:', error);
      }
    }
  }
}

// Export singleton instance
export const vaultDataService = VaultDataService.getInstance(); 