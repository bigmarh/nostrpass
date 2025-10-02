/**
 * User data types for encrypted storage on Nostr
 */

/**
 * Core user profile stored encrypted on Nostr
 */
export interface UserProfile {
  /** User's chosen username (without environment suffix) */
  username: string;
  
  /** Display name (optional) */
  displayName?: string;
  
  /** Profile picture URL (optional) */
  avatarUrl?: string;
  
  /** User's preferred language */
  language?: string;
  
  /** Account creation timestamp */
  createdAt: number;
  
  /** Last update timestamp */
  updatedAt: number;
  
  /** User preferences */
  preferences: UserPreferences;
  
  /** Security settings */
  security: SecuritySettings;
  
  /** Storage public key for vault operations */
  storagePublicKey?: string;
}

/**
 * User preferences
 */
export interface UserPreferences {
  /** Theme preference */
  theme?: 'light' | 'dark' | 'system';
  
  /** Whether to show approval dialog for every signature */
  alwaysConfirmSignature?: boolean;
  
  /** Default relay URLs for this user */
  defaultRelays?: string[];
  
  /** Notification preferences */
  notifications?: {
    enabled: boolean;
    soundEnabled?: boolean;
  };
}

/**
 * Security settings
 */
export interface SecuritySettings {
  /** Whether biometric authentication is enabled */
  biometricEnabled?: boolean;
  
  /** Session timeout in minutes */
  sessionTimeout?: number;
  
  /** Whether to require re-authentication for sensitive operations */
  requireReauthForSensitive?: boolean;
  
  /** Backup method configured */
  backupMethod?: 'none' | 'cloud' | 'manual';
  
  /** Last backup timestamp */
  lastBackupAt?: number;
}

/**
 * Simplified permission levels for app actions
 */
export type PermissionLevel = 'ALLOW' | 'ASK_EVERYTIME' | 'DENY';

/**
 * Permission categories with their associated event kinds
 */
export interface PermissionCategories {
  /** Social interactions (kinds 0, 1, 3, 5, 6, 7, etc.) - ALLOW by default */
  social: PermissionLevel;
  /** Messaging (kind 4, 14, etc.) - ASK_EVERYTIME by default */
  messaging: PermissionLevel;
  /** General data signing (arbitrary data, authentication, etc.) - ASK_EVERYTIME by default */
  signData: PermissionLevel;
  /** Financial operations (payments, zaps, etc.) - ASK_EVERYTIME by default */
  financial: PermissionLevel;
}

/**
 * App-specific permissions and data
 */
export interface AppPermissions {
  /** App identifier (usually origin/domain) */
  appId: string;
  
  /** App name for display */
  appName?: string;
  
  /** When permissions were first granted */
  grantedAt: number;
  
  /** Last time app was used */
  lastUsedAt: number;
  
  /** Permission categories */
  permissions: PermissionCategories;
  
  /** Permission level for reading public key - ALLOW by default */
  getPublicKey: PermissionLevel;
  
  /** Session-specific permissions (cleared on new session) */
  sessionPermissions?: {
    social: boolean;
    messaging: boolean;
    signData: boolean;
    financial: boolean;
    expiresAt: number;
  };
  
  /** App-specific encrypted data */
  appData?: Record<string, unknown>;
}

/**
 * Encrypted vault containing sensitive data
 */
export interface EncryptedVault {
  /** Version of the vault schema */
  version: number;
  
  /** Encrypted with user's derived key */
  encryptedData: string;
  
  /** Salt used for key derivation */
  salt: string;
  
  /** Nonce/IV for encryption */
  nonce: string;
  
  /** Key derivation parameters */
  kdf: {
    algorithm: 'argon2id' | 'scrypt' | 'pbkdf2';
    iterations?: number;
    memory?: number;
    parallelism?: number;
  };
}

/**
 * Decrypted vault contents
 */
export interface VaultContents {
  /** User's private key (hex) */
  privateKey: string;
  
  /** Recovery phrases or backup codes */
  recoveryData?: {
    mnemonic?: string;
    backupCodes?: string[];
  };
  
  /** Stored credentials for apps (optional) */
  credentials?: Array<{
    id: string;
    appId: string;
    username: string;
    encryptedPassword: string;
    notes?: string;
    createdAt: number;
    updatedAt: number;
  }>;
  
  /** Other sensitive data */
  additionalSecrets?: Record<string, string>;
}

/**
 * User data stored on Nostr (Event kind: 30078)
 */
export interface NostrUserData {
  /** User profile information */
  profile: UserProfile;
  
  /** Per-app permissions */
  appPermissions: AppPermissions[];
  
  /** Encrypted vault reference */
  vaultReference: {
    /** Event ID containing the encrypted vault */
    eventId: string;
    
    /** Relay hints where vault is stored */
    relayHints: string[];
    
    /** Vault version for migrations */
    version: number;
  };
  
  /** Sync metadata */
  sync?: {
    /** Device ID that last updated */
    deviceId: string;
    
    /** Last sync timestamp */
    lastSyncAt: number;
    
    /** Conflict resolution strategy */
    conflictStrategy: 'lastWrite' | 'merge';
  };
}

/**
 * Complete user object in memory
 */
export interface User {
  /** Public key (hex) */
  publicKey: string;
  
  /** Private key (available only after unlock) */
  privateKey: string;
  
  /** User profile data */
  profile: UserProfile;
  
  /** App permissions */
  appPermissions: Map<string, AppPermissions>;
  
  /** Whether user is fully authenticated */
  isAuthenticated: boolean;
  
  /** Session data */
  session: {
    /** When the session started */
    startedAt: number;
    
    /** Last activity timestamp */
    lastActivityAt: number;
    
    /** Whether biometric was used */
    biometricUsed?: boolean;
  };
  
  /** Vault PIN hash for verification (only present if vault has PIN) */
  vaultPinHash?: string;
}

/**
 * User registration data
 */
export interface UserRegistration {
  /** Desired username */
  username: string;
  
  /** Password for key derivation */
  password: string;
  
  /** Optional profile data */
  profile?: {
    displayName?: string;
    avatarUrl?: string;
  };
  
  /** Initial preferences */
  preferences?: Partial<UserPreferences>;
}

/**
 * User login data
 */
export interface UserLogin {
  /** Username or npub */
  identifier: string;
  
  /** Password */
  password: string;
  
  /** Whether to use biometric if available */
  useBiometric?: boolean;
  
  /** Whether to remember this device */
  rememberDevice?: boolean;
}