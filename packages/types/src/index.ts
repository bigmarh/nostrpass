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
  xprivEncrypted: string; // PIN-encrypted xpriv
  salt: string; // Salt for PIN encryption
  activeIdentityByApp?: Record<string, number | null>;
  passwordVerifier?: string; // Encrypted password verifier
  passwordSalt?: string; // Salt for password derivation
  recovery?: {
    questions: string[];
    xprivRecovery: string; // xpriv encrypted with recovery key
    salt: string;
    version: number;
  };
  version: number;
  updatedAt: number;
  createdAt?: number;
}

export interface RecoveryData {
  questions: string[];
  xprivRecovery: string;
  salt: string;
  version: number;
}

