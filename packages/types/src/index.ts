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
export interface LoginObj {
  storagePublicKey: string;
  username: string;
  createdAt: number;
  version: number;
  passwordSalt: string;  // Salt for deriving password key (needed for decryption)
}

export interface VaultObj {
  username: string;
  identities: any[];
  xprivEncrypted: string; // PIN-encrypted only
  xprivRecovery: string;  // Recovery-encrypted
  recovery?: {
    questions: string[];
    salt: string;
    version: number;
  };
  salt: string;
  version: number;
  updatedAt: number;
}

export interface RecoveryData {
  questions: string[];
  xprivRecovery: string;
  salt: string;
  version: number;
}

