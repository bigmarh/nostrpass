import { createSignal, createEffect, createMemo, onMount } from 'solid-js';
import { useAuth } from '../providers';
import { vaultDataService } from '../services/vaultDataService';
import type { VaultData } from '../workers/db';
import type { Identity } from '@nostrpass/types';

export interface UseVaultDataOptions {
  autoLoad?: boolean;
  forceRefresh?: boolean;
}

export function useVaultData(options: UseVaultDataOptions = {}) {
  const { autoLoad = true, forceRefresh = false } = options;
  const { user } = useAuth();
  
  const [vaultData, setVaultData] = createSignal<VaultData | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const username = createMemo(() => user()?.profile?.username);

  const loadVaultData = async (force = false) => {
    const currentUsername = username();
    if (!currentUsername) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔄 Loading vault data for:', currentUsername, 'force:', force || forceRefresh);
      const data = await vaultDataService.getVaultData(currentUsername, { 
        forceRefresh: force || forceRefresh 
      });
      console.log('📋 Loaded vault data:', JSON.stringify({
        identities: data?.identities?.map(id => ({
          nickname: id.nickname,
          appPermissions: id.appPermissions ? Object.keys(id.appPermissions) : []
        }))
      }, null, 2));
      setVaultData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load vault data';
      setError(errorMessage);
      console.error('useVaultData: Failed to load vault data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateVaultData = async (
    updates: Partial<VaultData> | ((current: VaultData) => Partial<VaultData>),
    options: { syncToNostr?: boolean; updateTimestamp?: boolean } = {}
  ) => {
    // Enable Nostr sync by default for vault updates
    const finalOptions = { syncToNostr: true, ...options };
    const currentUsername = username();
    if (!currentUsername) throw new Error('No user logged in');

    setIsLoading(true);
    setError(null);

    try {
      // Get current vault data for the update
      const currentData = vaultData();
      if (!currentData) {
        throw new Error('No current vault data available');
      }

      // Apply updates to get the new data
      const updatedData: VaultData = {
        ...currentData,
        ...(typeof updates === 'function' ? updates(currentData) : updates),
        ...(options.updateTimestamp !== false ? { updatedAt: Date.now() } : {})
      };

      // Update in the vault data service
      await vaultDataService.updateVaultData(currentUsername, updatedData, finalOptions);
      
      // Directly update the signal with the new data
      setVaultData(updatedData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update vault data';
      setError(errorMessage);
      console.error('useVaultData: Failed to update vault data:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentIdentity = createMemo(() => {
    const data = vaultData();
    if (!data?.identities) return null;

    const index = data.currentIdentityIndex ?? 0;
    return data.identities[index] || null;
  });

  const getIdentity = (index: number): Identity | null => {
    const data = vaultData();
    if (!data?.identities) return null;
    return data.identities[index] || null;
  };

  const switchIdentity = async (newIndex: number) => {
    const currentUsername = username();
    if (!currentUsername) throw new Error('No user logged in');

    try {
      // Identity switching should be local to this tab only
      // Update the local vault data signal without broadcasting
      const currentData = vaultData();
      if (!currentData) {
        throw new Error('No current vault data available');
      }

      // Update only the currentIdentityIndex locally
      const updatedData: VaultData = {
        ...currentData,
        currentIdentityIndex: newIndex
      };

      // Update the signal directly without going through the service
      setVaultData(updatedData);
      
      console.log(`🔄 Switched to identity ${newIndex} (local only)`);
    } catch (err) {
      console.error('useVaultData: Failed to switch identity:', err);
      throw err;
    }
  };

  const updateIdentity = async (index: number, updates: Partial<Identity>) => {
    const currentUsername = username();
    if (!currentUsername) throw new Error('No user logged in');

    try {
      await vaultDataService.updateIdentity(currentUsername, index, updates);
      await loadVaultData(true);
    } catch (err) {
      console.error('useVaultData: Failed to update identity:', err);
      throw err;
    }
  };

  const addIdentity = async (identity: Identity) => {
    const currentUsername = username();
    if (!currentUsername) throw new Error('No user logged in');

    try {
      await vaultDataService.addIdentity(currentUsername, identity);
      await loadVaultData(true);
    } catch (err) {
      console.error('useVaultData: Failed to add identity:', err);
      throw err;
    }
  };

  const removeIdentity = async (index: number) => {
    const currentUsername = username();
    if (!currentUsername) throw new Error('No user logged in');

    try {
      await vaultDataService.removeIdentity(currentUsername, index);
      await loadVaultData(true);
    } catch (err) {
      console.error('useVaultData: Failed to remove identity:', err);
      throw err;
    }
  };

  const syncToNostr = async () => {
    const currentUsername = username();
    if (!currentUsername) throw new Error('No user logged in');

    try {
      await vaultDataService.syncToNostr(currentUsername);
    } catch (err) {
      console.error('useVaultData: Failed to sync to Nostr:', err);
      throw err;
    }
  };

  const getVaultFromNostr = async () => {
    const currentUsername = username();
    if (!currentUsername) throw new Error('No user logged in');

    try {
      return await vaultDataService.getVaultFromNostr(currentUsername);
    } catch (err) {
      console.error('useVaultData: Failed to get vault from Nostr:', err);
      throw err;
    }
  };

  const clearCache = () => {
    const currentUsername = username();
    if (currentUsername) {
      vaultDataService.clearCache(currentUsername);
    }
  };

  // Auto-load vault data when user changes
  createEffect(() => {
    if (autoLoad && username()) {
      loadVaultData();
    }
  });

  // Listen for vault data refresh events from other tabs and Nostr
  onMount(() => {
    console.log('🔧 Setting up vault data refresh listener');
    
    const handleVaultDataRefresh = (event: CustomEvent) => {
      console.log('📡 Vault data refresh event received:', event.detail);
      const { username: eventUsername, source } = event.detail;
      const currentUsername = username();
      
      console.log('🔍 Comparing usernames:', { eventUsername, currentUsername, source });
      
      if (currentUsername === eventUsername) {
        console.log(`🔄 Refreshing vault data due to ${source || 'broadcast'} from another tab`);
        loadVaultData(true); // Force refresh
      } else {
        console.log('❌ Username mismatch, not refreshing');
      }
    };

    window.addEventListener('vault-data-refresh', handleVaultDataRefresh as EventListener);
    console.log('✅ Vault data refresh listener set up');
    
    // Fallback: More frequent refresh for incognito tabs (where BroadcastChannel doesn't work)
    // Check every 5 seconds if we're in an incognito context
    let periodicRefreshInterval: ReturnType<typeof setInterval> | undefined;
    
    // Detect if we're in incognito mode (BroadcastChannel isolation)
    const testBroadcastChannel = () => {
      try {
        const bc = new BroadcastChannel('nostrpass-test');
        bc.postMessage({ test: true });
        bc.close();
        return true;
      } catch (e) {
        return false;
      }
    };
    
    if (!testBroadcastChannel()) {
      console.log('🔍 [useVaultData] Incognito mode detected - setting up frequent refresh');
      periodicRefreshInterval = setInterval(() => {
        const currentUsername = username();
        if (currentUsername) {
          console.log('🔄 [useVaultData] Periodic refresh for incognito tab');
          loadVaultData(true);
        }
      }, 5000); // Check every 5 seconds for incognito tabs
    }
    
    return () => {
      window.removeEventListener('vault-data-refresh', handleVaultDataRefresh as EventListener);
      if (periodicRefreshInterval) {
        clearInterval(periodicRefreshInterval);
      }
      console.log('🧹 Vault data refresh listener cleaned up');
    };
  });

  // Set up Nostr subscription for real-time updates
  createEffect(() => {
    const currentUsername = username();
    if (!currentUsername) return;

    // Get user data for subscription
    const currentUser = user();
    if (!currentUser?.profile?.storagePublicKey) {
      console.log('⚠️ [useVaultData] No storage public key available for subscription');
      return;
    }

    // We need the password key for decryption, but it's not available in the hook
    // The subscription will be set up in the AuthProvider after login
    console.log('🔔 [useVaultData] Ready for Nostr subscription setup');
  });

  return {
    // Data
    vaultData,
    currentIdentity: getCurrentIdentity,
    isLoading,
    error,
    
    // Actions
    loadVaultData,
    updateVaultData,
    getIdentity,
    switchIdentity,
    updateIdentity,
    addIdentity,
    removeIdentity,
    syncToNostr,
    getVaultFromNostr,
    clearCache,
    
    // Utilities
    username
  };
} 