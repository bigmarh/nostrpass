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
import { ensureCryptoReady } from './crypto-primitives';

// Local type definitions for vault operations
interface CheckVaultExistsParams {
  username?: string;
  storagePublicKey?: string;
}

interface CheckVaultExistsResult {
  exists: boolean;
  storagePublicKey?: string;
}

interface DeleteVaultParams {
  username?: string;
  storagePublicKey?: string;
}

interface DeleteVaultResult {
  success: boolean;
  error?: string;
}
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
 * @param params - Object containing storagePublicKey (preferred) or username (legacy fallback)
 * @returns The vault data or null if not found
 */
async function getVaultData(params: { storagePublicKey?: string; username?: string; includeEncryptedVault?: boolean }): Promise<VaultData | null> {
  try {
    console.log('📥 [getVaultData] ===== REQUEST START =====');
    console.log('📥 [getVaultData] Full params object:', JSON.stringify(params));
    console.log('📥 [getVaultData] storagePublicKey:', params.storagePublicKey);
    console.log('📥 [getVaultData] username (legacy):', params.username);
    console.log('📥 [getVaultData] includeEncryptedVault value:', params.includeEncryptedVault);

    console.log('🔄 [getVaultData] Ensuring crypto ready...');
    await ensureCryptoReady();
    console.log('✅ [getVaultData] Crypto ready');

    // Determine lookup key - prefer storagePublicKey, fallback to username for backward compatibility
    const lookupKey = params.storagePublicKey || params.username;
    if (!lookupKey) {
      console.log('❌ [getVaultData] No storagePublicKey or username provided');
      return null;
    }

    // Get vault data from database (keyed by storagePublicKey)
    console.log('🗄️ [getVaultData] Querying IndexedDB with key:', lookupKey.slice(0, 12) + '...');
    let vaultData = await vaultDB.getVault(lookupKey);

    // Fallback: If not found and we have a username, try legacy username lookup
    if (!vaultData && params.username && !params.storagePublicKey) {
      console.log('🔄 [getVaultData] Trying legacy username lookup...');
      vaultData = await vaultDB.getVaultByUsername(params.username);
    }

    console.log('✅ [getVaultData] IndexedDB query complete, found:', !!vaultData);

    if (!vaultData) {
      console.log('❌ [getVaultData] No vault found for key:', lookupKey.slice(0, 12) + '...');
      return null;
    }

    console.log('📤 [getVaultData] Retrieved vault data:', {
      username: vaultData.username,
      hasPasswordVerifier: !!(vaultData as any).passwordVerifier,
      hasPasswordSalt: !!(vaultData as any).passwordSalt,
      hasXprivEncrypted: !!vaultData.xprivEncrypted,
      hasRecovery: !!(vaultData as any).recovery,
      identitiesCount: vaultData.identities?.length || 0,
      identities: vaultData.identities,
      linkedAuthProviders: (vaultData as any).linkedAuthProviders
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
      // SECURITY: activeIdentityByApp maps app → publicKey (source of truth for active identity)
      activeIdentityByApp: (vaultData as any).activeIdentityByApp || {},
      recovery: (vaultData as any).recovery,
      lastSyncedAt: vaultData.lastSyncedAt,
      updatedAt: vaultData.updatedAt || vaultData.lastUnlocked,
      createdAt: vaultData.createdAt,
      version: (vaultData as any).version || 1,
      // Linked auth providers (e.g., Google accounts linked to username vaults)
      linkedAuthProviders: (vaultData as any).linkedAuthProviders || []
    };

    // Only include xprivEncrypted when explicitly requested (for unlock operations)
    if (params.includeEncryptedVault) {
      if (vaultData.xprivEncrypted) {
        result.xprivEncrypted = vaultData.xprivEncrypted;
      } else {
        // Fallback to xprivs store
        console.warn('⚠️ [getVaultData] No xprivEncrypted in main vault, checking xprivs store...');
        try {
          const xprivData = await vaultDB.getXpriv(lookupKey);
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
 * @param params - Vault data to save (storagePublicKey is the primary key)
 */
async function saveVault(params: {
  storagePublicKey: string; // Primary key - the vault identifier
  username: string; // Display name (for UI)
  publicKey: string; // Same as storagePublicKey (alias)
  xprivEncrypted: string;
  salt: string;
  identities?: any[];
  passwordVerifier?: string;
  passwordSalt?: string;
  recovery?: any;
  lastSyncedAt?: number;
  updatedAt?: number;
  createdAt?: number;
}): Promise<void> {
  await ensureCryptoReady();

  const vaultData: VaultData = {
    storagePublicKey: params.storagePublicKey, // Primary key
    username: params.username, // Display name
    publicKey: params.publicKey,
    xprivEncrypted: params.xprivEncrypted,
    salt: params.salt,
    identities: params.identities || [],
    passwordSalt: params.passwordSalt,
    recovery: params.recovery,
    lastSyncedAt: params.lastSyncedAt || Date.now(),
    updatedAt: params.updatedAt || Date.now(),
    createdAt: params.createdAt || Date.now(),
    lastUnlocked: Date.now(),
    version: 1
  };

  // Persist to vaults store (keyed by storagePublicKey)
  await vaultDB.saveVault(vaultData);

  // Mirror to xprivs store if present
  try {
    if (params.xprivEncrypted && params.salt) {
      await vaultDB.saveXpriv(params.storagePublicKey, params.xprivEncrypted, params.salt, params.passwordSalt);
    }
  } catch (err) {
    console.error('Failed to mirror to xprivs store:', err);
  }

  console.log('✅ Vault saved to IndexedDB with storagePublicKey:', params.storagePublicKey.slice(0, 12) + '...');
}

/**
 * Update vault data atomically and broadcast change
 *
 * @param params - Object containing storagePublicKey (preferred) or username (legacy), vaultData, and optional flags
 */
async function updateVaultData(params: {
  storagePublicKey?: string;
  username?: string; // Legacy fallback
  vaultData: any;
  skipVersionIncrement?: boolean;
  options?: { syncToNostr?: boolean };
}): Promise<void> {
  await ensureCryptoReady();

  // Determine lookup key - prefer storagePublicKey
  const lookupKey = params.storagePublicKey || params.vaultData?.storagePublicKey || params.username;
  if (!lookupKey) {
    console.error('❌ [updateVaultData] No storagePublicKey or username provided');
    throw new Error('No storagePublicKey or username provided');
  }

  const toSave = { ...params.vaultData };

  // Ensure storagePublicKey is set in the data
  if (!toSave.storagePublicKey) {
    toSave.storagePublicKey = lookupKey;
  }

  // CRITICAL: Preserve xprivEncrypted if missing in incoming data
  // This prevents data loss when worker operations update vault without including xprivEncrypted
  if (!toSave.xprivEncrypted) {
    console.warn('⚠️ [updateVaultData] xprivEncrypted missing in incoming data, attempting to preserve from database...');
    const existing = await vaultDB.getVault(lookupKey);
    if (existing?.xprivEncrypted) {
      toSave.xprivEncrypted = existing.xprivEncrypted;
      toSave.salt = existing.salt; // Preserve salt too
      console.log('✅ [updateVaultData] Preserved xprivEncrypted and salt from database');
    } else {
      // Try xprivs store as fallback
      console.warn('⚠️ [updateVaultData] No xprivEncrypted in main vault, checking xprivs store...');
      const xprivData = await vaultDB.getXpriv(lookupKey);
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
    storagePublicKey: lookupKey.slice(0, 12) + '...',
    username: toSave.username,
    version: toSave.version,
    identitiesCount: toSave.identities?.length || 0,
    hasXprivEncrypted: !!toSave.xprivEncrypted,
    xprivEncryptedLength: toSave.xprivEncrypted?.length,
    updatedAt: toSave.updatedAt ? new Date(toSave.updatedAt).toISOString() : 'N/A',
    syncToNostr: params.options?.syncToNostr
  });

  // Persist (keyed by storagePublicKey)
  await vaultDB.saveVault(toSave);
  // Mirror to xprivs store if present
  try {
    const enc = toSave.xprivEncrypted;
    const pinSalt = toSave.salt;
    if (enc && pinSalt) {
      await vaultDB.saveXpriv(lookupKey, enc, pinSalt, toSave.passwordSalt);
    }
  } catch {}
  // Broadcast (use storagePublicKey as identifier)
  broadcastVaultUpdate(lookupKey, 'VAULT_DATA_UPDATED', { storagePublicKey: lookupKey, username: toSave.username });

  // Sync to Nostr if requested
  console.log('🔍 [updateVaultData] Checking sync options:', {
    hasOptions: !!params.options,
    syncToNostr: params.options?.syncToNostr,
    willSync: !!params.options?.syncToNostr
  });

  if (params.options?.syncToNostr) {
    try {
      console.log('📡 [updateVaultData] Syncing to Nostr...');
      await nostrSync.saveVaultToNostr({ storagePublicKey: lookupKey, username: toSave.username });
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
 * @param params - Object containing storagePublicKey (preferred) or username (legacy)
 * @returns Object with exists boolean
 */
async function checkVaultExists(params: { storagePublicKey?: string; username?: string }): Promise<CheckVaultExistsResult> {
  await ensureCryptoReady();

  const lookupKey = params.storagePublicKey || params.username;
  if (!lookupKey) {
    return { exists: false };
  }

  let vaultData = await vaultDB.getVault(lookupKey);

  // Fallback: Try legacy username lookup if not found
  if (!vaultData && params.username && !params.storagePublicKey) {
    vaultData = await vaultDB.getVaultByUsername(params.username);
  }

  return { exists: !!vaultData };
}

/**
 * Delete a vault from the database
 * Also clears the active session if present
 *
 * @param params - Object containing storagePublicKey (preferred) or username (legacy)
 * @returns Object with success boolean
 */
async function deleteVault(params: { storagePublicKey?: string; username?: string }): Promise<DeleteVaultResult> {
  await ensureCryptoReady();

  const lookupKey = params.storagePublicKey || params.username;
  if (!lookupKey) {
    console.error('❌ [deleteVault] No storagePublicKey or username provided');
    return { success: false };
  }

  // Remove from active sessions
  if (activeSessions) {
    activeSessions.delete(lookupKey);
    if (logSessionState) {
      logSessionState('delete', lookupKey);
    }
  }

  // Delete from database (vaults, xprivs, sessions) - keyed by storagePublicKey
  await vaultDB.deleteVault(lookupKey);

  // Broadcast deletion
  broadcastVaultUpdate(lookupKey, 'VAULT_DELETED', {});

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
