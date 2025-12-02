/**
 * @nostrpass/types
 * Types for nostrpass application
 */

export * from './nostrTypes';
export * from './userTypes';
export * from './identityTypes';
export * from './permissionHelpers';
export * from './constants';
export * from './messages';
export * from './worker';

// New event types for the updated auth flow
// NOTE: LoginObj is PASSWORD-ENCRYPTED when stored on Nostr
// The fields below represent the DECRYPTED content inside
export interface LoginObj {
  storagePublicKey: string; // Public key for finding VaultObj on Nostr
  storageKeypairEncrypted: string; // Storage keypair (private+public) encrypted with PIN
  username: string;
  createdAt: number;
  version: number;
  passwordSalt: string;  // Salt for deriving password key (for LoginObj decryption)
  pinSalt: string; // Salt for PIN-based key derivation (for storage keypair and xpriv)
}

// NOTE: VaultObj is STORAGE-KEY-ENCRYPTED when stored on Nostr
// The fields below represent the DECRYPTED content inside
export interface VaultObj {
  username: string;
  identities: any[];
  xprivEncrypted: string; // Master xpriv encrypted with PIN (for signing operations)
  salt: string; // Salt for PIN-based key derivation (same as pinSalt in LoginObj)
  activeIdentityByApp?: Record<string, number | null>;
  appPermissions?: Record<string, any>; // App-specific permissions
  recovery?: {
    questions: string[];
    xprivRecovery: string; // xpriv encrypted with recovery answers
    salt: string;
    version: number;
  };
  version: number;
  updatedAt: number;
  createdAt?: number;
  // Password salt (optional, for migration/verification)
  passwordSalt?: string;
}

export interface RecoveryData {
  questions: string[];
  xprivRecovery: string;
  salt: string;
  version: number;
}

