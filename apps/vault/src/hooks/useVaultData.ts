import { createSignal, createEffect, createMemo, onMount, onCleanup } from 'solid-js';
import { useAuth } from '../providers';
import { vaultDataService } from '../services/vaultDataService';
import type { VaultData } from '../workers/db';
import type { Identity } from '@nostrpass/types';
import { useVaultStore, initVaultStore } from '../stores/vaultStore';

export interface UseVaultDataOptions {
  autoLoad?: boolean;
  forceRefresh?: boolean;
}

export function useVaultData(options: UseVaultDataOptions = {}) {
  const { autoLoad = true, forceRefresh = false } = options;
  const { user } = useAuth();

  // Use the global vault store instead of local state
  const store = useVaultStore();

  const [error, setError] = createSignal<string | null>(null);

  const username = createMemo(() => user()?.profile?.username);

  // Initialize store when username becomes available
  createEffect(() => {
    const currentUsername = username();
    if (currentUsername && autoLoad) {
      console.log('🔄 [useVaultData] Initializing vault store for:', currentUsername);
      initVaultStore(currentUsername);
    }
  });

  const loadVaultData = async (force = false) => {
    console.log('🔄 [useVaultData] loadVaultData called, delegating to store.reload()');
    setError(null);
    try {
      await store.reload();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load vault data';
      setError(errorMessage);
      console.error('useVaultData: Failed to load vault data:', err);
    }
  };

  const updateVaultData = async (
    updates: Partial<VaultData> | ((current: VaultData) => Partial<VaultData>),
    options: { updateTimestamp?: boolean } = {}
  ) => {
    console.log('[useVaultData] 🚀 updateVaultData called, delegating to store.update() - auto-syncing to Nostr');
    setError(null);

    try {
      await store.update(updates, options);

      // Notify parent window about vault data update (for embassy integration)
      try {
        const currentUsername = username();
        const { getMessenger } = await import('../providers/MessengerProvider');
        const messenger = getMessenger();

        if (messenger && currentUsername) {
          messenger.send('VAULT_DATA_UPDATED', {
            username: currentUsername,
            timestamp: Date.now()
          });
          console.log('[useVaultData] ✅ VAULT_DATA_UPDATED message sent to embassy');
        }
      } catch (err) {
        console.error('[useVaultData] ❌ Failed to notify parent of vault data update:', err);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update vault data';
      setError(errorMessage);
      console.error('useVaultData: Failed to update vault data:', err);
      throw err;
    }
  };

  const getCurrentIdentity = createMemo(() => {
    const data = store.vaultData();
    if (!data?.identities) return null;

    const index = data.currentIdentityIndex ?? 0;
    return data.identities[index] || null;
  });

  const getIdentity = (index: number): Identity | null => {
    const data = store.vaultData();
    if (!data?.identities) return null;
    return data.identities[index] || null;
  };

  const switchIdentity = async (newIndex: number) => {
    const currentUsername = username();
    if (!currentUsername) throw new Error('No user logged in');

    try {
      // Identity switching should be local to this tab only
      // Update the local vault data signal without broadcasting
      const currentData = store.vaultData();
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
    // Data - use store signals
    vaultData: store.vaultData,
    currentIdentity: getCurrentIdentity,
    isLoading: store.isLoading,
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