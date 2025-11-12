/**
 * Managers barrel export
 *
 * Re-exports all manager classes for convenient importing.
 */

export { AuthManager } from './AuthManager';
export { VaultManager } from './VaultManager';
export { IdentityManager } from './IdentityManager';
export { PermissionManager } from './PermissionManager';

export type {
  PermissionRequest,
  PermissionCheckResult
} from './PermissionManager';
