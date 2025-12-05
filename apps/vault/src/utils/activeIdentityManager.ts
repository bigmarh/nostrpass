/**
 * Manages active identity per application origin in localStorage.
 * This is per-browser, per-tab context - NOT synced across devices.
 *
 * Storage key format: `nostrpass:activeIdentity:{username}:{appOrigin}`
 */

import { sanitizeDomain } from '@nostrpass/nostrHelpers';
import { vaultDataService } from '../services/vaultDataService';

const STORAGE_PREFIX = 'nostrpass:activeIdentity';

/**
 * Normalize origin to app key (sanitized domain)
 */
function originToAppKey(origin: string): string {
  try {
    let url: URL;
    if (origin.startsWith('http://') || origin.startsWith('https://')) {
      url = new URL(origin);
    } else {
      url = new URL(`http://${origin}`);
    }
    return sanitizeDomain(url.host);
  } catch {
    return sanitizeDomain(origin);
  }
}

/**
 * Get the active identity index for a specific app and user
 */
export function getActiveIdentity(username: string, appOrigin: string): number | null {
  const appKey = originToAppKey(appOrigin);
  const storageKey = `${STORAGE_PREFIX}:${username}:${appKey}`;

  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === null) {
      return null;
    }

    const parsed = parseInt(stored, 10);
    if (isNaN(parsed) || parsed < 0) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('[activeIdentityManager] Failed to get active identity:', error);
    return null;
  }
}

/**
 * Set the active identity index for a specific app and user
 * Validates that the identity exists and is not archived
 */
export async function setActiveIdentity(username: string, appOrigin: string, identityIndex: number): Promise<void> {
  const appKey = originToAppKey(appOrigin);
  const storageKey = `${STORAGE_PREFIX}:${username}:${appKey}`;

  try {
    if (identityIndex < 0) {
      throw new Error('Identity index must be >= 0');
    }

    // Validate that identity exists and is not archived
    const identity = await vaultDataService.getIdentity(username, identityIndex);

    if (!identity) {
      throw new Error(`Identity at index ${identityIndex} does not exist`);
    }

    if (identity.archived) {
      throw new Error(`Cannot set archived identity (index ${identityIndex}) as active`);
    }

    localStorage.setItem(storageKey, identityIndex.toString());
    console.log('[activeIdentityManager] Set active identity:', { username, appKey, identityIndex });
  } catch (error) {
    console.error('[activeIdentityManager] Failed to set active identity:', error);
    throw error;
  }
}

/**
 * Clear the active identity for a specific app and user
 */
export function clearActiveIdentity(username: string, appOrigin: string): void {
  const appKey = originToAppKey(appOrigin);
  const storageKey = `${STORAGE_PREFIX}:${username}:${appKey}`;

  try {
    localStorage.removeItem(storageKey);
    console.log('[activeIdentityManager] Cleared active identity:', { username, appKey });
  } catch (error) {
    console.error('[activeIdentityManager] Failed to clear active identity:', error);
  }
}

/**
 * Get all app origins that have active identities for a user
 */
export function getAllActiveIdentities(username: string): Record<string, number> {
  const result: Record<string, number> = {};
  const prefix = `${STORAGE_PREFIX}:${username}:`;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const appKey = key.substring(prefix.length);
        const value = localStorage.getItem(key);
        if (value !== null) {
          const parsed = parseInt(value, 10);
          if (!isNaN(parsed) && parsed >= 0) {
            result[appKey] = parsed;
          }
        }
      }
    }
  } catch (error) {
    console.error('[activeIdentityManager] Failed to get all active identities:', error);
  }

  return result;
}

/**
 * Clear all active identities for a user (useful on logout)
 */
export function clearAllActiveIdentities(username: string): void {
  const prefix = `${STORAGE_PREFIX}:${username}:`;
  const keysToRemove: string[] = [];

  try {
    // Collect keys first to avoid modifying localStorage during iteration
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    // Remove collected keys
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log('[activeIdentityManager] Cleared all active identities for user:', username);
  } catch (error) {
    console.error('[activeIdentityManager] Failed to clear all active identities:', error);
  }
}
