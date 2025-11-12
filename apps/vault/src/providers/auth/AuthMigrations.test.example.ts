/**
 * Example usage of AuthMigrations module
 * This file demonstrates how to use the migration functions
 */

import { needsMigration, migrateAccountSecurity, attemptMigration, validateMigration } from './AuthMigrations';
import type { VaultData } from '@nostrpass/nostrHelpers';

// Example 1: Check if migration is needed
async function checkMigrationExample() {
  const vaultData: VaultData = {
    username: 'alice',
    publicKey: 'abc123',
    xprivEncrypted: 'encrypted_xpriv',
    salt: 'some_salt',
    identities: [],
    updatedAt: Date.now(),
    version: 1
    // Note: No passwordVerifier or passwordSalt
  };

  if (needsMigration(vaultData)) {
    console.log('Migration is needed for this vault');
  }
}

// Example 2: Perform migration manually
async function performMigrationExample(cryptoWorker: any, vaultData: VaultData) {
  const result = await migrateAccountSecurity(
    cryptoWorker,
    vaultData,
    'alice',
    'user-password-123'
  );

  if (result.success) {
    console.log('Migration successful!');
    console.log('New salt:', result.details?.passwordSalt);
    console.log('New verifier:', result.details?.passwordVerifier);
  } else {
    console.error('Migration failed:', result.error);
  }
}

// Example 3: Attempt migration with automatic detection
async function attemptMigrationExample(cryptoWorker: any, vaultData: VaultData) {
  const result = await attemptMigration(
    cryptoWorker,
    vaultData,
    'alice',
    'user-password-123'
  );

  if (result === null) {
    console.log('No migration needed');
  } else if (result.success) {
    console.log('Migration successful');
  } else {
    console.error('Migration failed:', result.error);
  }
}

// Example 4: Validate migration
async function validateMigrationExample(vaultData: VaultData) {
  const isValid = validateMigration(vaultData);
  
  if (isValid) {
    console.log('Vault has valid security fields');
  } else {
    console.error('Vault is missing security fields');
  }
}

export {
  checkMigrationExample,
  performMigrationExample,
  attemptMigrationExample,
  validateMigrationExample
};
