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

// Auth provider type for login methods
export type AuthProvider = 'username' | 'google';

// Identifier type for Nostr lookups
export type IdentifierType = 'username' | 'google';

// New event types for the updated auth flow
// NOTE: LoginObj is PASSWORD-ENCRYPTED when stored on Nostr
// The fields below represent the DECRYPTED content inside
export interface LoginObj {
  storagePublicKey: string; // Public key for finding VaultObj on Nostr
  storageKeypairEncrypted: string; // Storage keypair (private+public) encrypted with PIN
  username: string; // Display name (username or Google email/name)
  createdAt: number;
  version: number;
  passwordSalt: string;  // Salt for deriving password key (for LoginObj decryption)
  pinSalt: string; // Salt for PIN-based key derivation (for storage keypair and xpriv)
  // Auth provider info (optional for backward compatibility with existing accounts)
  authProvider?: AuthProvider; // 'username' or 'google'
  googleUid?: string; // Google UID (only set when authProvider is 'google')
  vaultUsername?: string; // Original username for VaultObj lookup (for linked accounts)
}

// NOTE: VaultObj is STORAGE-KEY-ENCRYPTED when stored on Nostr
// The fields below represent the DECRYPTED content inside
export interface VaultObj {
  username: string;
  identities: any[];
  xprivEncrypted: string; // Master xpriv encrypted with PIN (for signing operations)
  salt: string; // Salt for PIN-based key derivation (same as pinSalt in LoginObj)
  // Changed from index (number) to publicKey (string) for stability across identity reordering/deletion
  activeIdentityByApp?: Record<string, string | null>;
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
  // Linked authentication providers (e.g., Google linked to username account)
  linkedAuthProviders?: Array<{
    provider: AuthProvider;
    linkedAt: number;
    displayName?: string;
  }>;
}

export interface RecoveryData {
  questions: string[];
  xprivRecovery: string;
  salt: string;
  version: number;
}

