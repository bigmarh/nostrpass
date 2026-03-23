/**
 * AuthMigrations Module
 *
 * Handles migration of legacy vault accounts to the current security model.
 * This module specifically manages the upgrade of old accounts that lack
 * passwordVerifier and passwordSalt fields required for secure authentication.
 *
 * @module AuthMigrations
 */

import type { VaultData } from '@nostrpass/nostrHelpers';

/**
 * Interface for crypto worker methods used in migrations.
 * This represents a subset of the worker client API.
 */
interface CryptoWorker {
  generateSalt(): Promise<Map<string, string> | { salt: string } | string>;
  deriveKey(params: { password: string; salt?: string }): Promise<Map<string, string> | { key: string; salt: string }>;
  encryptData(params: { data: string; password: string }): Promise<string>;
  updateVaultData(params: { username: string; vaultData: any }): Promise<void>;
}

/**
 * Result of a migration attempt
 */
export interface MigrationResult {
  success: boolean;
  error?: string;
  details?: {
    passwordSalt?: string;
    passwordVerifier?: string;
    updatedAt?: number;
  };
}

/**
 * Checks if a vault requires security field migration.
 *
 * Legacy accounts created before the security update lack passwordVerifier
 * and passwordSalt fields. This function identifies such accounts.
 *
 * @param vaultData - The vault data to check
 * @returns True if migration is needed, false otherwise
 *
 * @example
 * ```typescript
 * const vault = await cryptoWorker.getVaultData({ username: 'alice' });
 * if (needsMigration(vault)) {
 *   console.log('Account needs security upgrade');
 * }
 * ```
 */
export function needsMigration(vaultData: VaultData | null): boolean {
  if (!vaultData) {
    return false;
  }

  // Check if security fields are missing
  const hasPasswordVerifier = !!(vaultData as any).passwordVerifier;
  const hasPasswordSalt = !!(vaultData as any).passwordSalt;

  return !hasPasswordVerifier || !hasPasswordSalt;
}

/**
 * Migrates a legacy vault account to include required security fields.
 *
 * This function performs the following operations:
 * 1. Generates a new cryptographic salt for password key derivation
 * 2. Derives an encryption key from the user's password using Argon2id
 * 3. Creates an encrypted verifier string for password validation
 * 4. Updates the vault data with new security fields
 * 5. Preserves all existing vault data during migration
 *
 * The migration is idempotent and safe - it only adds missing fields
 * without modifying existing vault contents. The vault will sync to
 * Nostr after the user unlocks with their PIN.
 *
 * @param cryptoWorker - The crypto worker instance for cryptographic operations
 * @param vaultData - The vault data to migrate
 * @param username - The username of the account being migrated
 * @param password - The user's password (required for creating verifier)
 * @returns A promise resolving to the migration result
 *
 * @throws {Error} If crypto worker is not available
 * @throws {Error} If password is missing or empty
 * @throws {Error} If salt generation fails
 * @throws {Error} If key derivation fails
 * @throws {Error} If verifier encryption fails
 * @throws {Error} If vault update fails
 *
 * @example
 * ```typescript
 * const result = await migrateAccountSecurity(
 *   cryptoWorker,
 *   vaultData,
 *   'alice',
 *   'user-password-123'
 * );
 *
 * if (result.success) {
 *   console.log('Migration successful:', result.details);
 * } else {
 *   console.error('Migration failed:', result.error);
 * }
 * ```
 */
export async function migrateAccountSecurity(
  cryptoWorker: CryptoWorker,
  vaultData: VaultData,
  username: string,
  password: string
): Promise<MigrationResult> {
  console.log('🔄 [MIGRATION] Starting account security migration...');
  console.log('👤 [MIGRATION] Username:', username);
  console.log('📊 [MIGRATION] Current state:', {
    hasPasswordVerifier: !!(vaultData as any).passwordVerifier,
    hasPasswordSalt: !!(vaultData as any).passwordSalt,
    version: (vaultData as any).version,
    updatedAt: (vaultData as any).updatedAt
  });

  // Validate inputs
  if (!cryptoWorker) {
    const error = 'Crypto worker not available';
    console.error('❌ [MIGRATION]', error);
    return { success: false, error };
  }

  if (!password || password.trim().length === 0) {
    const error = 'Password is required for migration';
    console.error('❌ [MIGRATION]', error);
    return { success: false, error };
  }

  if (!username || username.trim().length === 0) {
    const error = 'Username is required for migration';
    console.error('❌ [MIGRATION]', error);
    return { success: false, error };
  }

  try {
    // Step 1: Generate new password salt
    console.log('🔐 [MIGRATION] Step 1: Generating new password salt...');
    const newPasswordSalt = await cryptoWorker.generateSalt();

    let passwordSalt: string;
    if (newPasswordSalt instanceof Map) {
      passwordSalt = newPasswordSalt.get('salt') || '';
    } else if (typeof newPasswordSalt === 'string') {
      passwordSalt = newPasswordSalt;
    } else {
      passwordSalt = (newPasswordSalt as any).salt || '';
    }

    if (!passwordSalt || passwordSalt.length === 0) {
      throw new Error('Failed to generate password salt - empty result');
    }

    console.log('✅ [MIGRATION] Password salt generated:', {
      length: passwordSalt.length,
      preview: passwordSalt.substring(0, 16) + '...'
    });

    // Step 2: Derive key from password using Argon2id
    console.log('🔐 [MIGRATION] Step 2: Deriving password key with Argon2id...');
    const passwordDeriveResult = await cryptoWorker.deriveKey({
      password,
      salt: passwordSalt
    });

    let passwordKey: string;
    if (passwordDeriveResult instanceof Map) {
      passwordKey = passwordDeriveResult.get('key') || '';
    } else {
      passwordKey = (passwordDeriveResult as any).key || '';
    }

    if (!passwordKey || passwordKey.length === 0) {
      throw new Error('Failed to derive password key - empty result');
    }

    console.log('✅ [MIGRATION] Password key derived:', {
      length: passwordKey.length,
      preview: passwordKey.substring(0, 16) + '...'
    });

    // Step 3: Create and encrypt verifier string
    console.log('🔐 [MIGRATION] Step 3: Creating encrypted password verifier...');
    const VERIFIER_STRING = 'NostrPass_Password_Verifier_v1';
    const passwordVerifier = await cryptoWorker.encryptData({
      data: VERIFIER_STRING,
      password: passwordKey
    });

    if (!passwordVerifier || passwordVerifier.length === 0) {
      throw new Error('Failed to create password verifier - empty result');
    }

    console.log('✅ [MIGRATION] Password verifier created:', {
      length: passwordVerifier.length,
      preview: passwordVerifier.substring(0, 32) + '...'
    });

    // Step 4: Update vault data with new security fields
    console.log('💾 [MIGRATION] Step 4: Updating vault data...');
    const updatedAt = Date.now();

    // Preserve all existing vault data and add security fields
    (vaultData as any).passwordVerifier = passwordVerifier;
    (vaultData as any).passwordSalt = passwordSalt;
    (vaultData as any).updatedAt = updatedAt;

    // Step 5: Save to local IndexedDB
    console.log('💾 [MIGRATION] Step 5: Saving to local IndexedDB...');
    await cryptoWorker.updateVaultData({
      username,
      vaultData
    });

    console.log('✅ [MIGRATION] Vault data updated successfully');
    console.log('ℹ️ [MIGRATION] Vault will sync to Nostr after PIN unlock');

    const result: MigrationResult = {
      success: true,
      details: {
        passwordSalt,
        passwordVerifier,
        updatedAt
      }
    };

    console.log('🎉 [MIGRATION] Account migration completed successfully!');
    console.log('📊 [MIGRATION] New state:', {
      hasPasswordVerifier: true,
      hasPasswordSalt: true,
      passwordSaltLength: passwordSalt.length,
      passwordVerifierLength: passwordVerifier.length,
      updatedAt: new Date(updatedAt).toISOString()
    });

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ [MIGRATION] Account migration failed:', errorMessage);
    console.error('❌ [MIGRATION] Error details:', {
      error,
      stack: error instanceof Error ? error.stack : undefined
    });

    return {
      success: false,
      error: `Failed to upgrade account security: ${errorMessage}`
    };
  }
}

/**
 * Attempts to migrate an account if needed, with comprehensive error handling.
 * This is a convenience wrapper that combines migration detection and execution.
 *
 * @param cryptoWorker - The crypto worker instance
 * @param vaultData - The vault data to check and potentially migrate
 * @param username - The username of the account
 * @param password - The user's password
 * @returns A promise resolving to the migration result, or null if migration not needed
 *
 * @example
 * ```typescript
 * const result = await attemptMigration(cryptoWorker, vault, 'alice', 'password');
 * if (result === null) {
 *   console.log('No migration needed');
 * } else if (result.success) {
 *   console.log('Migration successful');
 * } else {
 *   console.error('Migration failed:', result.error);
 * }
 * ```
 */
export async function attemptMigration(
  cryptoWorker: CryptoWorker,
  vaultData: VaultData | null,
  username: string,
  password: string
): Promise<MigrationResult | null> {
  if (!vaultData) {
    console.log('ℹ️ [MIGRATION] No vault data provided, skipping migration check');
    return null;
  }

  if (!needsMigration(vaultData)) {
    console.log('ℹ️ [MIGRATION] Account already has security fields, no migration needed');
    return null;
  }

  console.warn('⚠️ [MIGRATION] Account is missing security fields - attempting migration...');
  return await migrateAccountSecurity(cryptoWorker, vaultData, username, password);
}

/**
 * Validates that a migrated vault has the correct security fields.
 * This is useful for testing and verification after migration.
 *
 * @param vaultData - The vault data to validate
 * @returns True if the vault has valid security fields, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = validateMigration(vaultData);
 * if (!isValid) {
 *   console.error('Migration validation failed - security fields missing');
 * }
 * ```
 */
export function validateMigration(vaultData: VaultData | null): boolean {
  if (!vaultData) {
    return false;
  }

  const hasPasswordVerifier =
    typeof (vaultData as any).passwordVerifier === 'string' &&
    (vaultData as any).passwordVerifier.length > 0;

  const hasPasswordSalt =
    typeof (vaultData as any).passwordSalt === 'string' &&
    (vaultData as any).passwordSalt.length > 0;

  return hasPasswordVerifier && hasPasswordSalt;
}
