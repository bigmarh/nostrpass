/**
 * Reactive Vault Store
 *
 * Single source of truth for vault data across the entire app.
 * Listens to worker updates via BroadcastChannel and propagates to all components.
 *
 * Architecture:
 * - Worker sends VAULT_DATA_UPDATED via BroadcastChannel
 * - Store listens and fetches latest data from worker
 * - All components consume reactive signals from this store
 * - Updates propagate automatically via SolidJS reactivity
 */

import { createSignal, createEffect, onCleanup } from 'solid-js';
import type { VaultData } from '../workers/db';
import { getCryptoWorker } from '../services/cryptoWorkerSingleton';

// Reactive signals
const [vaultData, setVaultData] = createSignal<VaultData | null>(null);
const [isLoading, setIsLoading] = createSignal(false);
const [currentUsername, setCurrentUsername] = createSignal<string | null>(null);

// BroadcastChannel for worker updates
let vaultUpdateChannel: BroadcastChannel | null = null;

/**
 * Initialize the vault store for a specific user
 * Sets up BroadcastChannel listener and loads initial data
 */
export function initVaultStore(username: string) {
  console.log('🏪 [VaultStore] Initializing for user:', username);

  setCurrentUsername(username);

  // Load initial vault data
  loadVaultData(username);

  // Set up BroadcastChannel listener if not already set up
  if (!vaultUpdateChannel) {
    vaultUpdateChannel = new BroadcastChannel('nostrpass-vault');

    vaultUpdateChannel.onmessage = async (event) => {
      // Worker broadcasts: { type: 'VAULT_BROADCAST', data: { broadcastType: 'VAULT_DATA_UPDATED', username, ... } }
      if (event.data.type === 'VAULT_BROADCAST') {
        const { broadcastType, username: updateUsername } = event.data.data || {};

        console.log('🏪 [VaultStore] Received vault broadcast:', {
          broadcastType,
          currentUser: currentUsername(),
          updateUser: updateUsername
        });

        // Reload on any vault data change for current user
        if (updateUsername === currentUsername() &&
            (broadcastType === 'VAULT_DATA_UPDATED' ||
             broadcastType === 'SESSION_UNLOCKED' ||
             broadcastType === 'VAULT_CREATED')) {
          console.log('🏪 [VaultStore] Reloading vault data after:', broadcastType);
          await loadVaultData(updateUsername);
        }
      }
    };

    console.log('🏪 [VaultStore] BroadcastChannel listener set up');
  }
}

/**
 * Load vault data from worker
 */
async function loadVaultData(username: string) {
  if (!username) return;

  setIsLoading(true);

  try {
    const worker = getCryptoWorker();
    if (!worker) {
      console.warn('🏪 [VaultStore] No worker available');
      return;
    }

    const data = await worker.getVaultData({ username });

    console.log('🏪 [VaultStore] Loaded vault data:', {
      username,
      identitiesCount: data?.identities?.length || 0,
      version: data?.version || 0
    });

    setVaultData(data);
  } catch (err) {
    console.error('🏪 [VaultStore] Failed to load vault data:', err);
    setVaultData(null);
  } finally {
    setIsLoading(false);
  }
}

/**
 * Force reload vault data
 */
export async function reloadVaultData() {
  const username = currentUsername();
  if (!username) return;

  console.log('🏪 [VaultStore] Force reloading vault data');
  await loadVaultData(username);
}

/**
 * Update vault data (saves to worker and triggers broadcast)
 */
export async function updateVaultData(
  updates: Partial<VaultData> | ((current: VaultData) => Partial<VaultData>),
  options: { syncToNostr?: boolean; updateTimestamp?: boolean } = {}
) {
  const username = currentUsername();
  if (!username) {
    throw new Error('No user logged in');
  }

  const current = vaultData();
  if (!current) {
    throw new Error('No current vault data');
  }

  setIsLoading(true);

  try {
    const worker = getCryptoWorker();
    if (!worker) {
      throw new Error('No worker available');
    }

    // Apply updates
    const updatedData: VaultData = {
      ...current,
      ...(typeof updates === 'function' ? updates(current) : updates),
      ...(options.updateTimestamp !== false ? { updatedAt: Date.now() } : {})
    };

    console.log('🏪 [VaultStore] Updating vault data:', {
      username,
      options,
      identitiesCount: updatedData.identities?.length
    });

    // Save via worker (worker will broadcast VAULT_DATA_UPDATED)
    await worker.updateVaultData({
      username,
      vaultData: updatedData,
      options: { syncToNostr: options.syncToNostr ?? true }
    });

    // Optimistically update local state (broadcast will confirm)
    setVaultData(updatedData);

    console.log('🏪 [VaultStore] Vault data updated successfully');
  } catch (err) {
    console.error('🏪 [VaultStore] Failed to update vault data:', err);
    throw err;
  } finally {
    setIsLoading(false);
  }
}

/**
 * Clean up store (call on logout)
 */
export function cleanupVaultStore() {
  console.log('🏪 [VaultStore] Cleaning up');

  setVaultData(null);
  setCurrentUsername(null);

  if (vaultUpdateChannel) {
    vaultUpdateChannel.close();
    vaultUpdateChannel = null;
  }
}

/**
 * Export reactive signals for components to consume
 */
export function useVaultStore() {
  return {
    vaultData,
    isLoading,
    username: currentUsername,

    // Actions
    reload: reloadVaultData,
    update: updateVaultData,
  };
}
