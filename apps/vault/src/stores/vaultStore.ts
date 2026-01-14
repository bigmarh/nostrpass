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

import { createSignal, createEffect, onCleanup, createMemo } from 'solid-js';
import type { VaultData } from '../workers/db';
import { getCryptoWorker } from '../services/cryptoWorkerSingleton';
import type { AppPermissions } from '@nostrpass/types';

// Reactive signals - main vault data
const [vaultData, setVaultData] = createSignal<VaultData | null>(null);
const [isLoading, setIsLoading] = createSignal(false);
const [currentUsername, setCurrentUsername] = createSignal<string | null>(null);

// Derived signals for fine-grained reactivity
// These automatically update when vaultData changes, triggering reactivity in components
const identities = createMemo(() => vaultData()?.identities || []);
const vaultVersion = createMemo(() => vaultData()?.version || 0);
const vaultUpdatedAt = createMemo(() => vaultData()?.updatedAt || 0);

// NOTE: activeIdentityByApp has been removed from vaultData
// Active identity is now managed per-browser in localStorage via activeIdentityManager
// This prevents cross-device/tab conflicts where different browsers should
// be able to have different active identities for the same app

/**
 * Get permissions for a specific app and identity
 * Returns a reactive signal that updates when permissions change
 */
function createAppPermissions(appId: () => string | undefined, identityIndex: () => number | undefined) {
  return createMemo(() => {
    const vault = vaultData();
    const app = appId();
    const idx = identityIndex();

    if (!vault || !app || idx === undefined) return null;

    const identity = vault.identities?.[idx];
    return identity?.appPermissions?.[app] || null;
  });
}

// BroadcastChannel for worker updates
let vaultUpdateChannel: BroadcastChannel | null = null;

/**
 * Initialize the vault store for a specific user
 * Sets up BroadcastChannel listener and loads initial data
 *
 * @param storageKey - The vault lookup key (storagePublicKey preferred, username as fallback)
 *                     For Google login, this MUST be storagePublicKey, not the Google UID
 */
export function initVaultStore(storageKey: string) {
  console.log('🏪 [VaultStore] Initializing for user:', storageKey);

  setCurrentUsername(storageKey);

  // Load initial vault data
  loadVaultData(storageKey);

  // Set up BroadcastChannel listener if not already set up
  if (!vaultUpdateChannel) {
    vaultUpdateChannel = new BroadcastChannel('nostrpass-vault');

    vaultUpdateChannel.onmessage = async (event) => {
      // Worker broadcasts: { type: 'VAULT_BROADCAST', data: { broadcastType: 'VAULT_DATA_UPDATED', username, ... } }
      if (event.data.type === 'VAULT_BROADCAST') {
        const { broadcastType, username: updateUsername } = event.data.data || {};
        const broadcastReceived = performance.now();

        console.log('🏪 [VaultStore] Received vault broadcast:', {
          broadcastType,
          currentUser: currentUsername(),
          updateUser: updateUsername,
          timestamp: broadcastReceived
        });

        // Reload on any vault data change for current user
        if (updateUsername === currentUsername() &&
            (broadcastType === 'VAULT_DATA_UPDATED' ||
             broadcastType === 'SESSION_UNLOCKED' ||
             broadcastType === 'VAULT_CREATED')) {
          console.log('🏪 [VaultStore] Reloading vault data after:', broadcastType);
          const reloadStart = performance.now();
          await loadVaultData(updateUsername);
          const reloadEnd = performance.now();
          console.log('⏱️ [VaultStore] Reload took:', (reloadEnd - reloadStart).toFixed(2), 'ms');
        }
      }
    };

    console.log('🏪 [VaultStore] BroadcastChannel listener set up');
  }
}

/**
 * Load vault data from worker
 *
 * @param storageKey - The vault lookup key (storagePublicKey preferred, username as fallback)
 */
async function loadVaultData(storageKey: string) {
  if (!storageKey) return;

  setIsLoading(true);

  try {
    const worker = getCryptoWorker();
    if (!worker) {
      console.warn('🏪 [VaultStore] No worker available');
      return;
    }

    const data = await worker.getVaultData({ username: storageKey });

    // Log permissions to debug real-time updates
    const firstIdentity = data?.identities?.[0];
    const appPerms = firstIdentity?.appPermissions || {};
    const appIds = Object.keys(appPerms);

    console.log('🏪 [VaultStore] Loaded vault data:', {
      username: storageKey,
      identitiesCount: data?.identities?.length || 0,
      version: data?.version || 0,
      updatedAt: data?.updatedAt,
      firstIdentityApps: appIds,
      permissionsPreview: appIds.length > 0 ? appPerms[appIds[0]]?.permissions : null
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
 * ALWAYS syncs to Nostr - this is the streamlined approach
 *
 * This function is the SINGLE SOURCE OF TRUTH for all vault updates.
 * Every vault change MUST go through here to ensure:
 * 1. IndexedDB persistence
 * 2. Nostr relay sync
 * 3. BroadcastChannel notification to other tabs
 * 4. UI reactivity via SolidJS signals
 */
export async function updateVaultData(
  updates: Partial<VaultData> | ((current: VaultData) => Partial<VaultData>),
  options: { updateTimestamp?: boolean } = {}
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

    console.log('🏪 [VaultStore] Updating vault data (auto-sync enabled):', {
      username,
      identitiesCount: updatedData.identities?.length,
      version: updatedData.version
    });

    // Save via worker - ALWAYS syncs to Nostr
    // This ensures every vault change is persisted across devices
    await worker.updateVaultData({
      username,
      vaultData: updatedData,
      options: { syncToNostr: true }  // Always true - streamlined approach
    });

    // Optimistically update local state (broadcast will confirm)
    setVaultData(updatedData);

    console.log('✅ [VaultStore] Vault updated and synced to Nostr');
  } catch (err) {
    console.error('❌ [VaultStore] Failed to update vault data:', err);
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
    // Full vault data (for backwards compatibility)
    vaultData,
    isLoading,
    username: currentUsername,

    // Derived signals for fine-grained reactivity
    identities,
    vaultVersion,
    vaultUpdatedAt,

    // Factory for app-specific permissions
    createAppPermissions,

    // Actions
    reload: reloadVaultData,
    update: updateVaultData,
  };
}
