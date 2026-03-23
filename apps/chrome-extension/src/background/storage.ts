/**
 * Chrome Storage wrapper
 *
 * Provides typed access to chrome.storage.local and chrome.storage.session
 */

import { STORAGE_KEYS } from '@/shared/constants';
import type {
  VaultData,
  SessionData,
  PendingRequest,
  AppPermissions,
} from '@/shared/types';

// Settings interface
interface ExtensionSettings {
  theme: 'light' | 'dark' | 'auto';
  autoLockMinutes: number;
}

/**
 * Get vault data from persistent storage
 */
export async function getVaultData(): Promise<VaultData | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.VAULT_DATA);
  return result[STORAGE_KEYS.VAULT_DATA] || null;
}

/**
 * Save vault data to persistent storage
 */
export async function setVaultData(data: VaultData): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.VAULT_DATA]: data });
}

/**
 * Check if vault exists
 */
export async function hasVault(): Promise<boolean> {
  const vaultData = await getVaultData();
  return vaultData !== null;
}

/**
 * Delete vault data
 */
export async function deleteVaultData(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.VAULT_DATA);
}

/**
 * Get session data (unlocked state, derived keys)
 */
export async function getSessionData(): Promise<SessionData | null> {
  const result = await chrome.storage.session.get(STORAGE_KEYS.SESSION);
  return result[STORAGE_KEYS.SESSION] || null;
}

/**
 * Save session data
 */
export async function setSessionData(data: SessionData): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEYS.SESSION]: data });
}

/**
 * Clear session data (lock vault)
 */
export async function clearSessionData(): Promise<void> {
  await chrome.storage.session.remove(STORAGE_KEYS.SESSION);
}

/**
 * Get pending permission request
 */
export async function getPendingRequest(): Promise<PendingRequest | null> {
  const result = await chrome.storage.session.get(STORAGE_KEYS.PENDING_REQUEST);
  return result[STORAGE_KEYS.PENDING_REQUEST] || null;
}

/**
 * Save pending permission request
 */
export async function setPendingRequest(
  request: PendingRequest | null
): Promise<void> {
  if (request) {
    await chrome.storage.session.set({
      [STORAGE_KEYS.PENDING_REQUEST]: request,
    });
  } else {
    await chrome.storage.session.remove(STORAGE_KEYS.PENDING_REQUEST);
  }
}

/**
 * Get extension settings
 */
export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return (
    result[STORAGE_KEYS.SETTINGS] || {
      theme: 'auto',
      autoLockMinutes: 5,
    }
  );
}

/**
 * Save extension settings
 */
export async function setSettings(
  settings: Partial<ExtensionSettings>
): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({
    [STORAGE_KEYS.SETTINGS]: { ...current, ...settings },
  });
}

/**
 * Get app permissions for a specific origin
 */
export async function getAppPermissions(
  origin: string,
  identityIndex: number = 0
): Promise<AppPermissions | null> {
  const vaultData = await getVaultData();
  if (!vaultData) return null;

  const identity = vaultData.identities[identityIndex];
  if (!identity) return null;

  return identity.appPermissions?.[origin] || null;
}

/**
 * Save app permissions for a specific origin
 */
export async function setAppPermissions(
  origin: string,
  permissions: AppPermissions,
  identityIndex: number = 0
): Promise<void> {
  const vaultData = await getVaultData();
  if (!vaultData) throw new Error('No vault data');

  const identity = vaultData.identities[identityIndex];
  if (!identity) throw new Error('Invalid identity index');

  if (!identity.appPermissions) {
    identity.appPermissions = {};
  }

  identity.appPermissions[origin] = {
    ...permissions,
    lastUsedAt: Date.now(),
  };

  await setVaultData(vaultData);
}
