/**
 * Vault Operations Module
 *
 * This module handles all database CRUD operations for vault data.
 * It provides handlers for:
 * - Getting vault data from the database
 * - Saving new vaults
 * - Updating existing vault data
 * - Checking if a vault exists
 * - Deleting vaults
 * - Clearing all data
 *
 * All operations are atomic and include proper broadcasting of changes
 * to keep all tabs synchronized.
 */

import { vaultDB, type VaultData } from './db';
import {
  CheckVaultExistsParams,
  CheckVaultExistsResult,
  DeleteVaultParams,
  DeleteVaultResult,
} from '@nostrpass/types';
import { ensureCryptoReady } from './crypto-primitives';
import { broadcastVaultUpdate } from './shared';
import { nostrSync } from './nostr-sync';

/**
 * Type for the activeSessions map
 * Used by deleteVault to clear sessions
 */
type ActiveSessionsMap = Map<string, any>;

/**
 * Reference to activeSessions from session-manager
 * Set via setActiveSessions to avoid circular dependency
 */
let activeSessions: ActiveSessionsMap | null = null;

/**
 * Logging function reference from session-manager
 * Set via setLogSessionState to avoid circular dependency
 */
let logSessionState: ((action: string, username: string) => void) | null = null;

/**
 * Set the active sessions map reference
 * Called by session-manager during initialization
 */
export function setActiveSessions(sessions: ActiveSessionsMap): void {
  activeSessions = sessions;
}

/**
 * Set the session logging function
 * Called by session-manager during initialization
 */
export function setLogSessionState(logger: (action: string, username: string) => void): void {
  logSessionState = logger;
}

/**
 * Get vault data from the database
 *
 * @param params - Object containing username
 * @returns The vault data or null if not found
 */
async function getVaultData(params: { username: string; includeEncryptedVault?: boolean }): Promise<VaultData | null> {
  try {
    console.log('📥 [getVaultData] ===== REQUEST START =====');
    console.log('📥 [getVaultData] Full params object:', JSON.stringify(params));
    console.log('📥 [getVaultData] username:', params.username);
    console.log('📥 [getVaultData] includeEncryptedVault value:', params.includeEncryptedVault);
    console.log('📥 [getVaultData] includeEncryptedVault type:', typeof params.includeEncryptedVault);
    console.log('📥 [getVaultData] Has property "includeEncryptedVault":', 'includeEncryptedVault' in params);

    console.log('🔄 [getVaultData] Ensuring crypto ready...');
    await ensureCryptoReady();
    console.log('✅ [getVaultData] Crypto ready');

    // Get vault data from database
    console.log('🗄️ [getVaultData] Querying IndexedDB...');
    const vaultData = await vaultDB.getVault(params.username);
    console.log('✅ [getVaultData] IndexedDB query complete, found:', !!vaultData);

    if (!vaultData) {
      console.log('❌ [getVaultData] No vault found for username:', params.username);
      return null;
    }

    console.log('📤 [getVaultData] Retrieved vault data:', {
      username: vaultData.username,
      hasPasswordVerifier: !!(vaultData as any).passwordVerifier,
      hasPasswordSalt: !!(vaultData as any).passwordSalt,
      hasXprivEncrypted: !!vaultData.xprivEncrypted,
      hasRecovery: !!(vaultData as any).recovery,
      identitiesCount: vaultData.identities?.length || 0,
      identities: vaultData.identities
    });

    // Security: Only include sensitive fields when explicitly requested
    const result: any = {
      username: vaultData.username,
      publicKey: vaultData.publicKey,
      salt: vaultData.salt,
      passwordSalt: (vaultData as any).passwordSalt,
      passwordVerifier: (vaultData as any).passwordVerifier,
      identities: vaultData.identities || [],
      storagePublicKey: vaultData.publicKey,
      // NOTE: activeIdentityByApp removed - now stored in localStorage per-browser
      recovery: (vaultData as any).recovery,
      lastSyncedAt: vaultData.lastSyncedAt,
      updatedAt: vaultData.updatedAt || vaultData.lastUnlocked,
      createdAt: vaultData.createdAt,
      version: (vaultData as any).version || 1
    };

    // Only include xprivEncrypted when explicitly requested (for unlock operations)
    if (params.includeEncryptedVault) {
      if (vaultData.xprivEncrypted) {
        result.xprivEncrypted = vaultData.xprivEncrypted;
      } else {
        // Fallback to xprivs store
        console.warn('⚠️ [getVaultData] No xprivEncrypted in main vault, checking xprivs store...');
        try {
          const xprivData = await vaultDB.getXpriv(params.username);
          if (xprivData?.xprivEncrypted) {
            result.xprivEncrypted = xprivData.xprivEncrypted;
            result.salt = xprivData.salt;
            console.log('✅ [getVaultData] Recovered xprivEncrypted from xprivs store');
          } else {
            console.error('❌ [getVaultData] No xprivEncrypted found in either store!');
          }
        } catch (err) {
          console.error('❌ [getVaultData] Error checking xprivs store:', err);
        }
      }
    }

    console.log('📤 [getVaultData] Returning result with xprivEncrypted:', !!result.xprivEncrypted);
    return result;
  } catch (error) {
    console.error('❌ [getVaultData] Error:', error);
    throw error;
  }
}

/**
 * Save a new vault to the database
 * Used when fetching from Nostr for the first time or creating a new vault
 *
 * @param params - Vault data to save
 */
async function saveVault(params: {
  username: string;
  publicKey: string;
  xprivEncrypted: string;
  salt: string;
  identities?: any[];
  // activeIdentityByApp removed - now stored in localStorage
  passwordVerifier?: string;
  passwordSalt?: string;
  recovery?: any;
  lastSyncedAt?: number;
  updatedAt?: number;
  createdAt?: number;
}): Promise<void> {
  await ensureCryptoReady();

  const vaultData = {
    username: params.username,
    publicKey: params.publicKey,
    xprivEncrypted: params.xprivEncrypted,
    encryptedVault: params.xprivEncrypted, // Redundant field for compatibility
    salt: params.salt,
    identities: params.identities || [],
    // activeIdentityByApp removed - now stored in localStorage per-browser
    passwordVerifier: params.passwordVerifier,
    passwordSalt: params.passwordSalt,
    recovery: params.recovery,
    lastSyncedAt: params.lastSyncedAt || Date.now(),
    updatedAt: params.updatedAt || Date.now(),
    createdAt: params.createdAt || Date.now(),
    lastUnlocked: Date.now()
  };

  // Persist to vaults store
  await vaultDB.saveVault(vaultData);

  // Mirror to xprivs store if present
  try {
    if (params.xprivEncrypted && params.salt) {
      await vaultDB.saveXpriv(params.username, params.xprivEncrypted, params.salt, params.passwordSalt);
    }
  } catch (err) {
    console.error('Failed to mirror to xprivs store:', err);
  }

  console.log('✅ Vault saved to IndexedDB');
}

/**
 * Update vault data atomically and broadcast change
 *
 * @param params - Object containing username, vaultData, and optional skipVersionIncrement flag
 */
async function updateVaultData(params: {
  username: string;
  vaultData: any;
  skipVersionIncrement?: boolean;
  options?: { syncToNostr?: boolean };
}): Promise<void> {
  await ensureCryptoReady();
  const toSave = { ...params.vaultData };

  // CRITICAL: Preserve xprivEncrypted if missing in incoming data
  // This prevents data loss when worker operations update vault without including xprivEncrypted
  if (!toSave.xprivEncrypted) {
    console.warn('⚠️ [updateVaultData] xprivEncrypted missing in incoming data, attempting to preserve from database...');
    const existing = await vaultDB.getVault(params.username);
    if (existing?.xprivEncrypted) {
      toSave.xprivEncrypted = existing.xprivEncrypted;
      toSave.salt = existing.salt; // Preserve salt too
      console.log('✅ [updateVaultData] Preserved xprivEncrypted and salt from database');
    } else {
      // Try xprivs store as fallback
      console.warn('⚠️ [updateVaultData] No xprivEncrypted in main vault, checking xprivs store...');
      const xprivData = await vaultDB.getXpriv(params.username);
      if (xprivData?.xprivEncrypted) {
        toSave.xprivEncrypted = xprivData.xprivEncrypted;
        toSave.salt = xprivData.salt;
        console.log('✅ [updateVaultData] Recovered xprivEncrypted and salt from xprivs store');
      } else {
        console.error('❌ [updateVaultData] CRITICAL: Cannot preserve xprivEncrypted - not found in either store!');
      }
    }
  }

  // Increment version for sync conflict resolution (unless explicitly skipped for Nostr downloads)
  if (!params.skipVersionIncrement) {
    toSave.version = (toSave.version || 0) + 1;
    toSave.updatedAt = Date.now();
  }

  // MIGRATION: Handle legacy encryptedVault field (will be cleaned up by db.saveVault)
  if (!toSave.xprivEncrypted && toSave.encryptedVault) {
    toSave.xprivEncrypted = toSave.encryptedVault;
  }

  console.log('💾 [updateVaultData] Saving vault with:', {
    username: toSave.username,
    version: toSave.version,
    identitiesCount: toSave.identities?.length || 0,
    hasXprivEncrypted: !!toSave.xprivEncrypted,
    xprivEncryptedLength: toSave.xprivEncrypted?.length,
    updatedAt: toSave.updatedAt ? new Date(toSave.updatedAt).toISOString() : 'N/A',
    syncToNostr: params.options?.syncToNostr
  });

  // Persist
  await vaultDB.saveVault(toSave);
  // Mirror to xprivs store if present
  try {
    const enc = toSave.xprivEncrypted;
    const pinSalt = toSave.salt;
    if (enc && pinSalt) {
      await vaultDB.saveXpriv(params.username, enc, pinSalt, toSave.passwordSalt);
    }
  } catch {}
  // Broadcast
  broadcastVaultUpdate(params.username, 'VAULT_DATA_UPDATED', { username: params.username });

  // Sync to Nostr if requested
  console.log('🔍 [updateVaultData] Checking sync options:', {
    hasOptions: !!params.options,
    syncToNostr: params.options?.syncToNostr,
    willSync: !!params.options?.syncToNostr
  });

  if (params.options?.syncToNostr) {
    try {
      console.log('📡 [updateVaultData] Syncing to Nostr...');
      await nostrSync.saveVaultToNostr({ username: params.username });
      console.log('✅ [updateVaultData] Vault synced to Nostr successfully');
    } catch (err) {
      console.warn('⚠️ [updateVaultData] Failed to sync vault to Nostr (non-critical):', err);
    }
  } else {
    console.log('⏭️ [updateVaultData] Skipping Nostr sync (syncToNostr not true)');
  }
}

/**
 * Check if a vault exists in the database
 *
 * @param params - Object containing username
 * @returns Object with exists boolean
 */
async function checkVaultExists(params: CheckVaultExistsParams): Promise<CheckVaultExistsResult> {
  await ensureCryptoReady();

  const vaultData = await vaultDB.getVault(params.username);
  return { exists: !!vaultData };
}

/**
 * Delete a vault from the database
 * Also clears the active session if present
 *
 * @param params - Object containing username
 * @returns Object with success boolean
 */
async function deleteVault(params: DeleteVaultParams): Promise<DeleteVaultResult> {
  await ensureCryptoReady();

  // Remove from active sessions
  if (activeSessions) {
    activeSessions.delete(params.username);
    if (logSessionState) {
      logSessionState('delete', params.username);
    }
  }

  // Delete from database (vaults, xprivs, sessions)
  await vaultDB.deleteVault(params.username);

  // Broadcast deletion
  broadcastVaultUpdate(params.username, 'VAULT_DELETED', {});

  return { success: true };
}

/**
 * Clear all vault data from the database and memory
 * Used for testing and reset operations
 *
 * @returns Object with success boolean
 */
async function clearAllData(): Promise<{ success: boolean }> {
  await ensureCryptoReady();

  // Clear all in-memory sessions
  if (activeSessions) {
    activeSessions.clear();
  }

  // Clear all database stores
  await vaultDB.clearAll();

  console.log('🗑️ All vault data cleared');

  return { success: true };
}

/**
 * Export all vault operation handlers as a single object
 */
export const vaultOperations = {
  getVaultData,
  saveVault,
  updateVaultData,
  checkVaultExists,
  deleteVault,
  clearAllData,
};
