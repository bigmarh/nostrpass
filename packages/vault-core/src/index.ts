/**
 * @nostrpass/vault-core
 *
 * Framework-agnostic vault management library for NostrPass.
 *
 * This library provides a clean, event-based API for managing:
 * - Authentication and sessions
 * - Vault data (CRUD operations)
 * - Identities and cryptographic operations
 * - App permissions
 *
 * It can be used with any UI framework (React, SolidJS, Svelte, Vue, etc.)
 * or vanilla JavaScript.
 *
 * @example
 * ```typescript
 * import { VaultCore } from '@nostrpass/vault-core';
 *
 * const vault = new VaultCore({
 *   workerUrl: '/crypto.worker.js',
 *   environment: 'production'
 * });
 *
 * await vault.initialize();
 *
 * // Login
 * const result = await vault.auth.login('username', 'password');
 *
 * // Listen to auth changes
 * vault.auth.onAuthStateChanged((user) => {
 *   console.log('User:', user);
 * });
 *
 * // Create identity
 * const identity = await vault.identities.createIdentity('username', {
 *   name: 'My Identity',
 *   purpose: 'general'
 * });
 * ```
 *
 * @packageDocumentation
 */

// Main class
export { VaultCore } from './VaultCore';

// Managers
export {
  AuthManager,
  VaultManager,
  IdentityManager,
  PermissionManager
} from './managers';

// Types
export type {
  PermissionRequest,
  PermissionCheckResult
} from './managers';

export type {
  VaultCoreConfig,
  User,
  Identity,
  VaultData,
  AppPermissions,
  PermissionLevel,
  PermissionCategories,
  LoginResult,
  UnlockResult,
  CreateIdentityOptions,
  EventCallback,
  Unsubscribe
} from './types';

// Utilities
export { EventEmitter } from './utils/EventEmitter';
