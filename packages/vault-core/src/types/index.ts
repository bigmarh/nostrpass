/**
 * Core type definitions for @nostrpass/vault-core
 *
 * Re-exports types from @nostrpass/types and adds vault-core specific types
 */

import type {
  UserProfile as ImportedUserProfile,
  Identity as ImportedIdentity,
  LoginObj as ImportedLoginObj,
  ErrorCode as ImportedErrorCode,
  AppPermissions as ImportedAppPermissions,
  PermissionCategories as ImportedPermissionCategories,
  VaultObj as ImportedVaultObj
} from '@nostrpass/types';

// Re-export types
export type UserProfile = ImportedUserProfile;
export type Identity = ImportedIdentity;
export type LoginObj = ImportedLoginObj;
export type ErrorCode = ImportedErrorCode;
export type AppPermissions = ImportedAppPermissions;
export type PermissionCategories = ImportedPermissionCategories;
export type VaultObj = ImportedVaultObj;

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
 * Vault data (alias for VaultObj)
 */
export type VaultData = VaultObj;

/**
 * Configuration for VaultCore initialization
 */
export interface VaultCoreConfig {
  /**
   * URL to the crypto worker script
   */
  workerUrl: string;

  /**
   * Environment name (production, development, etc.)
   */
  environment?: string;

  /**
   * Optional custom origin for messenger
   */
  targetOrigin?: string;

  /**
   * Enable debug logging
   */
  debug?: boolean;
}

/**
 * Result of login operation
 */
export interface LoginResult {
  success: boolean;
  user?: User;
  error?: string;
  needsMigration?: boolean;
}

/**
 * Result of vault unlock operation
 */
export interface UnlockResult {
  success: boolean;
  error?: string;
}

/**
 * Options for creating an identity
 */
export interface CreateIdentityOptions {
  name: string;
  purpose?: string;
  derivationPath?: string;
}

/**
 * Permission level for actions
 */
export type PermissionLevel = 'ALLOW' | 'DENY' | 'ASK_EVERYTIME';

/**
 * Permission check result
 */
export interface PermissionResult {
  allowed: boolean;
  needsPrompt: boolean;
  level: PermissionLevel;
}

/**
 * Event subscription callback
 */
export type EventCallback<T = any> = (data: T) => void;

/**
 * Unsubscribe function returned by event subscriptions
 */
export type Unsubscribe = () => void;

/**
 * Worker message types
 */
export interface WorkerMessage {
  type: string;
  data?: any;
  requestId?: string;
}

/**
 * Worker response types
 */
export interface WorkerResponse {
  success: boolean;
  data?: any;
  error?: string;
  requestId?: string;
}
