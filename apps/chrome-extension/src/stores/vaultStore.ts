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
import { sanitizeDomain } from '@nostrpass/nostrHelpers';

// Reactive signals - main vault data
const [vaultData, setVaultData] = createSignal<VaultData | null>(null);
const [isLoading, setIsLoading] = createSignal(false);
const [currentStorageKey, setCurrentStorageKey] = createSignal<string | null>(null);

// Active identity per app (per-browser, stored in localStorage)
// Key: sanitized app key (e.g., "localhost-4000"), Value: identity index
const [activeIdentityByApp, setActiveIdentityByApp] = createSignal<Record<string, number>>({});

// Derived signals for fine-grained reactivity
const identities = createMemo(() => vaultData()?.identities || []);
const vaultVersion = createMemo(() => vaultData()?.version || 0);
const vaultUpdatedAt = createMemo(() => vaultData()?.updatedAt || 0);

/**
 * Get the active identity index for an app (reactive)
 */
export function getActiveIdentityIndex(appOrigin: string): number {
  const appKey = normalizeAppKey(appOrigin);
  const allActive = activeIdentityByApp();
  const index = allActive[appKey] ?? 0;
  console.log('🏪 [VaultStore] getActiveIdentityIndex:', {
    appOrigin,
    appKey,
    index,
    allActiveKeys: Object.keys(allActive),
    storageKey: currentStorageKey()?.slice(0, 12) + '...'
  });
  return index;
}

/**
 * Get the storage key (for external consumers that need it)
 */
export function getStorageKey(): string | null {
  return currentStorageKey();
}

/**
 * Set the active identity for an app
 * Updates localStorage, reactive signal, and notifies embassy
 *
 * @param appOrigin - The app origin (will be normalized/sanitized)
 * @param index - The identity index to set as active
 * @param fallbackStorageKey - Optional fallback storage key if store isn't initialized yet
 */
export async function setActiveIdentityIndex(appOrigin: string, index: number, fallbackStorageKey?: string) {
  let storageKey = currentStorageKey();

  // If store isn't initialized, use fallback storage key
  if (!storageKey && fallbackStorageKey) {
    console.log('🏪 [VaultStore] Store not initialized, using fallback storage key');
    storageKey = fallbackStorageKey;
  }

  if (!storageKey) {
    console.warn('[VaultStore] Cannot set active identity - no storage key');
    return;
  }

  if (!Number.isInteger(index) || index < 0) {
    console.warn('[VaultStore] Invalid identity index:', index);
    return;
  }

  const appKey = normalizeAppKey(appOrigin);
  const identityCount = vaultData()?.identities?.length ?? 0;
  if (identityCount > 0 && index >= identityCount) {
    console.warn('[VaultStore] Identity index out of range:', { index, identityCount });
    return;
  }

  console.log('🏪 [VaultStore] Setting active identity:', { appKey, index, storageKey });

  // 1. Persist to localStorage (single source of truth)
  const key = `nostrpass:activeIdentity:${storageKey}:${appKey}`;
  localStorage.setItem(key, String(index));

  // 2. Update reactive signal (for vault UI reactivity)
  setActiveIdentityByApp(prev => ({ ...prev, [appKey]: index }));

  // 3. Notify embassy via postMessage (cross-origin communication)
  try {
    const { getMessenger } = await import('../providers/MessengerProvider');
    const messenger = getMessenger();
    if (messenger) {
      messenger.send('IDENTITY_SWITCHED', {
        identityIndex: index,
        appOrigin: appKey,
        storageKey,
        timestamp: Date.now()
      });
      console.log('🏪 [VaultStore] Sent IDENTITY_SWITCHED to embassy:', { appKey, index });
    }
  } catch (error) {
    // Non-critical - embassy will get correct state on next AUTH_STATUS call
    console.warn('[VaultStore] Failed to notify embassy of identity switch:', error);
  }
}

/**
 * Clear the active identity for an app
 */
export function clearActiveIdentityIndex(appOrigin: string) {
  const storageKey = currentStorageKey();
  if (!storageKey) return;

  const appKey = normalizeAppKey(appOrigin);
  const key = `nostrpass:activeIdentity:${storageKey}:${appKey}`;
  localStorage.removeItem(key);

  setActiveIdentityByApp(prev => {
    const next = { ...prev };
    delete next[appKey];
    return next;
  });
}

/**
 * Load active identities from localStorage for a user
 */
function loadActiveIdentities(storageKey: string) {
  const prefix = `nostrpass:activeIdentity:${storageKey}:`;
  const entries: Record<string, number> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      const appOrigin = key.slice(prefix.length);
      const value = localStorage.getItem(key);
      if (value !== null) {
        const parsed = parseInt(value, 10);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          entries[appOrigin] = parsed;
        }
      }
    }
  }

  console.log('🏪 [VaultStore] Loaded active identities from localStorage:', entries);
  setActiveIdentityByApp(entries);
}

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

async function notifyEmbassyVaultUpdate(updateUsername: string, timestamp?: number) {
  try {
    const { getMessenger } = await import('../providers/MessengerProvider');
    const messenger = getMessenger();
    if (messenger) {
      const displayUsername = vaultData()?.username;
      if (!displayUsername) {
        return;
      }
      messenger.send('VAULT_DATA_UPDATED', {
        username: displayUsername,
        timestamp: timestamp ?? Date.now()
      });
    }
  } catch (error) {
    console.error('[VaultStore] Failed to notify embassy of vault update:', error);
  }
}

function normalizeAppKey(origin: string): string {
  try {
    return sanitizeDomain(new URL(origin).host || origin);
  } catch {
    return sanitizeDomain(origin);
  }
}

function migrateActiveIdentityKeys(oldKey: string, newKey: string) {
  if (!oldKey || !newKey || oldKey === newKey) {
    return;
  }

  const oldPrefix = `nostrpass:activeIdentity:${oldKey}:`;
  const newPrefix = `nostrpass:activeIdentity:${newKey}:`;
  const keysToMove: Array<{ oldKey: string; newKey: string }> = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(oldPrefix)) {
      const appKey = key.slice(oldPrefix.length);
      keysToMove.push({
        oldKey: key,
        newKey: `${newPrefix}${appKey}`
      });
    }
  }

  keysToMove.forEach(({ oldKey: sourceKey, newKey: targetKey }) => {
    const value = localStorage.getItem(sourceKey);
    if (value !== null && localStorage.getItem(targetKey) === null) {
      localStorage.setItem(targetKey, value);
    }
    localStorage.removeItem(sourceKey);
  });
}

/**
 * Initialize the vault store for a specific user
 * Sets up BroadcastChannel listener and loads initial data
 *
 * @param storageKey - The vault lookup key (storagePublicKey preferred, username as fallback)
 *                     For Google login, this MUST be storagePublicKey, not the Google UID
 */
export function initVaultStore(storageKey: string) {
  console.log('🏪 [VaultStore] Initializing for storage key:', storageKey);

  setCurrentStorageKey(storageKey);

  // Load active identities from localStorage
  loadActiveIdentities(storageKey);

  // Load initial vault data
  loadVaultData(storageKey);

  // Set up BroadcastChannel listener if not already set up
  if (!vaultUpdateChannel) {
    vaultUpdateChannel = new BroadcastChannel('nostrpass-vault');

    vaultUpdateChannel.onmessage = async (event) => {
      // Worker broadcasts: { type: 'VAULT_BROADCAST', data: { broadcastType: 'VAULT_DATA_UPDATED', username, storagePublicKey, ... } }
      if (event.data.type === 'VAULT_BROADCAST') {
        const { broadcastType, username, storagePublicKey } = event.data.data || {};
        // Use storagePublicKey if available (critical for Google login), fall back to username
        const broadcastKey = storagePublicKey || username;
        const broadcastReceived = performance.now();
        if (!isValidBroadcast(broadcastType, broadcastKey)) {
          console.warn('[VaultStore] Ignoring invalid vault broadcast:', event.data.data);
          return;
        }

        console.log('🏪 [VaultStore] Received vault broadcast:', {
          broadcastType,
          currentStorageKey: currentStorageKey(),
          broadcastKey,
          timestamp: broadcastReceived
        });

        // Reload on any vault data change for current user
        if (broadcastKey === currentStorageKey() &&
            (broadcastType === 'VAULT_DATA_UPDATED' ||
             broadcastType === 'SESSION_UNLOCKED' ||
             broadcastType === 'VAULT_CREATED')) {
          console.log('🏪 [VaultStore] Reloading vault data after:', broadcastType);
          const reloadStart = performance.now();
          await loadVaultData(broadcastKey);
          const reloadEnd = performance.now();
          console.log('⏱️ [VaultStore] Reload took:', (reloadEnd - reloadStart).toFixed(2), 'ms');
          if (broadcastType === 'VAULT_DATA_UPDATED') {
            await notifyEmbassyVaultUpdate(broadcastKey, event.data.data?.timestamp);
          }
        }
      }
    };

    console.log('🏪 [VaultStore] BroadcastChannel listener set up');
  }
}

function isValidBroadcast(broadcastType: unknown, broadcastKey: unknown): boolean {
  if (typeof broadcastType !== 'string' || typeof broadcastKey !== 'string') {
    return false;
  }

  const allowedTypes = new Set(['VAULT_DATA_UPDATED', 'SESSION_UNLOCKED', 'VAULT_CREATED']);
  return allowedTypes.has(broadcastType);
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

    if (data?.storagePublicKey && data.storagePublicKey !== currentStorageKey()) {
      const previousKey = currentStorageKey();
      setCurrentStorageKey(data.storagePublicKey);
      migrateActiveIdentityKeys(previousKey || storageKey, data.storagePublicKey);
      loadActiveIdentities(data.storagePublicKey);
    }

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
  const storageKey = currentStorageKey();
  if (!storageKey) return;

  console.log('🏪 [VaultStore] Force reloading vault data');
  await loadVaultData(storageKey);
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
  const storageKey = currentStorageKey();
  if (!storageKey) {
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
      storageKey,
      identitiesCount: updatedData.identities?.length,
      version: updatedData.version
    });

    // Save via worker - ALWAYS syncs to Nostr
    // This ensures every vault change is persisted across devices
    // IMPORTANT: Pass storagePublicKey explicitly to avoid confusion with display name
    await worker.updateVaultData({
      storagePublicKey: storageKey,
      username: storageKey,
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
  setCurrentStorageKey(null);

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
    username: currentStorageKey,
    storageKey: currentStorageKey,

    // Derived signals for fine-grained reactivity
    identities,
    vaultVersion,
    vaultUpdatedAt,

    // Active identity (per-app, per-browser)
    activeIdentityByApp,
    getActiveIdentityIndex,
    setActiveIdentityIndex,
    clearActiveIdentityIndex,

    // Factory for app-specific permissions
    createAppPermissions,

    // Actions
    reload: reloadVaultData,
    update: updateVaultData,
  };
}
