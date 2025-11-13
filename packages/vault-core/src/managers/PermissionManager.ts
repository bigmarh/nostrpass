/**
 * PermissionManager - Framework-agnostic permission manager
 *
 * Handles all permission-related operations including:
 * - Check and validate app permissions
 * - Grant/revoke app permissions
 * - Session-based temporary permissions
 * - Permission level management (ALLOW, ASK_EVERYTIME, DENY)
 *
 * @example
 * ```typescript
 * const permissions = new PermissionManager(worker);
 *
 * // Check permission
 * const result = await permissions.checkPermission(
 *   'alice',
 *   'https://app.example.com',
 *   'signEvent',
 *   1
 * );
 *
 * if (result.needsPrompt) {
 *   // Show permission prompt to user
 * }
 *
 * // Grant permissions
 * await permissions.saveAppPermissions('alice', 'https://app.example.com', {
 *   permissions: {
 *     social: 'ALLOW',
 *     messaging: 'ASK_EVERYTIME',
 *     signData: 'ASK_EVERYTIME',
 *     financial: 'DENY'
 *   }
 * });
 * ```
 */

import { EventEmitter } from '../utils/EventEmitter';
import type {
  AppPermissions,
  PermissionLevel,
  EventCallback,
  Unsubscribe
} from '../types';

export interface PermissionRequest {
  origin: string;
  appName?: string;
  action: 'signEvent' | 'signData' | 'getPublicKey' | 'nip04' | 'getRelays';
  eventKind?: number;
}

export interface PermissionCheckResult {
  allowed: boolean;
  level: PermissionLevel;
  needsPrompt: boolean;
  sessionGranted?: boolean;
}

export class PermissionManager extends EventEmitter {
  private worker: Worker | any;
  private isRpcMode: boolean = false;

  constructor(worker: Worker | any) {
    super();
    this.worker = worker;

    // Detect if this is an RPC client
    this.isRpcMode = worker && typeof worker.checkPermission === 'function';
  }

  /**
   * Send message to worker and wait for response
   */
  private async sendToWorker<T = any>(type: string, data?: any): Promise<T> {
    // RPC mode - call method directly
    if (this.isRpcMode) {
      if (typeof this.worker[type] === 'function') {
        return await this.worker[type](data);
      }
      throw new Error(`Worker does not have method: ${type}`);
    }

    // Raw Worker mode - use postMessage
    return new Promise((resolve, reject) => {
      const requestId = `${type}_${Date.now()}_${Math.random()}`;

      const handler = (event: MessageEvent) => {
        if (event.data.requestId === requestId) {
          this.worker.removeEventListener('message', handler);

          if (event.data.success !== false) {
            resolve(event.data.data || event.data);
          } else {
            reject(new Error(event.data.error || 'Worker request failed'));
          }
        }
      };

      this.worker.addEventListener('message', handler);

      this.worker.postMessage({
        type,
        data,
        requestId
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        this.worker.removeEventListener('message', handler);
        reject(new Error(`Worker request timeout: ${type}`));
      }, 30000);
    });
  }

  /**
   * Get app permissions for a specific origin
   *
   * @param username - Username
   * @param origin - App origin (e.g., 'https://app.example.com')
   * @param identityIndex - Index of identity (optional)
   * @returns App permissions or null if not found
   *
   * @example
   * ```typescript
   * const perms = await permissionManager.getAppPermissions(
   *   'alice',
   *   'https://app.example.com'
   * );
   *
   * if (perms) {
   *   console.log('Social permission:', perms.permissions.social);
   * }
   * ```
   */
  async getAppPermissions(
    username: string,
    origin: string,
    identityIndex?: number
  ): Promise<AppPermissions | null> {
    try {
      const result = await this.sendToWorker<AppPermissions | null>('getAppPermissions', {
        username,
        origin,
        identityIndex
      });

      return result;
    } catch (error) {
      console.error('[PermissionManager] Get app permissions error:', error);
      throw error;
    }
  }

  /**
   * Check if an action is allowed for a specific app
   *
   * @param username - Username
   * @param origin - App origin
   * @param action - Action to check (e.g., 'signEvent', 'getPublicKey')
   * @param eventKind - Event kind (required for signEvent)
   * @returns Permission check result
   *
   * @example
   * ```typescript
   * const result = await permissionManager.checkPermission(
   *   'alice',
   *   'https://app.example.com',
   *   'signEvent',
   *   1
   * );
   *
   * if (result.allowed) {
   *   // Proceed with action
   * } else if (result.needsPrompt) {
   *   // Show permission prompt
   * } else {
   *   // Action denied
   * }
   * ```
   */
  async checkPermission(
    username: string,
    origin: string,
    action: PermissionRequest['action'],
    eventKind?: number
  ): Promise<PermissionCheckResult> {
    try {
      const result = await this.sendToWorker<PermissionCheckResult>('checkPermission', {
        username,
        origin,
        action,
        eventKind
      });

      return result;
    } catch (error) {
      console.error('[PermissionManager] Check permission error:', error);
      throw error;
    }
  }

  /**
   * Save or update app permissions
   *
   * @param username - Username
   * @param origin - App origin
   * @param permissions - Permissions to save (partial)
   * @param appName - Optional app name
   * @param identityIndex - Optional identity index
   *
   * @example
   * ```typescript
   * await permissionManager.saveAppPermissions(
   *   'alice',
   *   'https://app.example.com',
   *   {
   *     permissions: {
   *       social: 'ALLOW',
   *       messaging: 'ASK_EVERYTIME',
   *       signData: 'ASK_EVERYTIME',
   *       financial: 'DENY'
   *     },
   *     getPublicKey: 'ALLOW'
   *   },
   *   'Example App'
   * );
   * ```
   */
  async saveAppPermissions(
    username: string,
    origin: string,
    permissions: Partial<AppPermissions>,
    appName?: string,
    identityIndex?: number
  ): Promise<void> {
    try {
      await this.sendToWorker('saveAppPermissions', {
        username,
        origin,
        permissions,
        appName,
        identityIndex
      });

      this.emit('permissions-updated', { username, origin, permissions });
    } catch (error) {
      console.error('[PermissionManager] Save app permissions error:', error);
      throw error;
    }
  }

  /**
   * Grant temporary session-based permission
   *
   * @param username - Username
   * @param origin - App origin
   * @param action - Action to grant ('signEvent' or 'signData')
   * @param eventKind - Optional event kind
   * @param sessionDurationMinutes - Duration in minutes (default: 60)
   *
   * @example
   * ```typescript
   * // Grant temporary permission for 30 minutes
   * await permissionManager.grantSessionPermission(
   *   'alice',
   *   'https://app.example.com',
   *   'signEvent',
   *   1,
   *   30
   * );
   * ```
   */
  async grantSessionPermission(
    username: string,
    origin: string,
    action: 'signEvent' | 'signData',
    eventKind?: number,
    sessionDurationMinutes: number = 60
  ): Promise<void> {
    try {
      await this.sendToWorker('grantSessionPermission', {
        username,
        origin,
        action,
        eventKind,
        sessionDurationMinutes
      });

      this.emit('session-permission-granted', {
        username,
        origin,
        action,
        eventKind,
        expiresIn: sessionDurationMinutes
      });
    } catch (error) {
      console.error('[PermissionManager] Grant session permission error:', error);
      throw error;
    }
  }

  /**
   * Update last used timestamp for an app
   *
   * @param username - Username
   * @param origin - App origin
   *
   * @example
   * ```typescript
   * await permissionManager.updateLastUsed('alice', 'https://app.example.com');
   * ```
   */
  async updateLastUsed(username: string, origin: string): Promise<void> {
    try {
      const appPerms = await this.getAppPermissions(username, origin);
      if (!appPerms) return;

      const updatedPerms = {
        ...appPerms,
        lastUsedAt: Date.now()
      };

      await this.saveAppPermissions(username, origin, updatedPerms);
    } catch (error) {
      console.error('[PermissionManager] Update last used error:', error);
      throw error;
    }
  }

  /**
   * Revoke all permissions for an app
   *
   * @param username - Username
   * @param origin - App origin
   *
   * @example
   * ```typescript
   * await permissionManager.revokeAppPermissions('alice', 'https://app.example.com');
   * console.log('App permissions revoked');
   * ```
   */
  async revokeAppPermissions(username: string, origin: string): Promise<void> {
    try {
      await this.sendToWorker('revokeAppPermissions', {
        username,
        origin
      });

      this.emit('permissions-revoked', { username, origin });
    } catch (error) {
      console.error('[PermissionManager] Revoke app permissions error:', error);
      throw error;
    }
  }

  /**
   * Get all app permissions for a user
   *
   * @param username - Username
   * @returns Array of all app permissions
   *
   * @example
   * ```typescript
   * const allPerms = await permissionManager.getAllAppPermissions('alice');
   * console.log('Connected apps:', allPerms.length);
   *
   * allPerms.forEach(perm => {
   *   console.log(`${perm.appName}: ${perm.appId}`);
   * });
   * ```
   */
  async getAllAppPermissions(username: string): Promise<AppPermissions[]> {
    try {
      const result = await this.sendToWorker<AppPermissions[]>('getAllAppPermissions', {
        username
      });

      return result;
    } catch (error) {
      console.error('[PermissionManager] Get all app permissions error:', error);
      throw error;
    }
  }

  /**
   * Check if origin is allowed (wildcard matching)
   *
   * @param origin - Origin to check
   * @param allowedOrigins - List of allowed origins (supports wildcards)
   * @returns True if origin is allowed
   *
   * @example
   * ```typescript
   * const allowed = permissionManager.isOriginAllowed(
   *   'https://sub.example.com',
   *   ['https://example.com', '*.example.com']
   * );
   * ```
   */
  isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
    try {
      const url = new URL(origin);
      return allowedOrigins.some(allowed => {
        if (allowed === '*') return true;
        if (allowed.startsWith('*.')) {
          const domain = allowed.slice(2);
          return url.hostname === domain || url.hostname.endsWith(`.${domain}`);
        }
        return url.origin === allowed;
      });
    } catch {
      return false;
    }
  }

  /**
   * Subscribe to permission update events
   *
   * @param callback - Function to call when permissions are updated
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsub = permissionManager.onPermissionsUpdated((data) => {
   *   console.log('Permissions updated for:', data.origin);
   * });
   * ```
   */
  onPermissionsUpdated(
    callback: EventCallback<{
      username: string;
      origin: string;
      permissions: Partial<AppPermissions>;
    }>
  ): Unsubscribe {
    return this.on('permissions-updated', callback);
  }

  /**
   * Subscribe to permission revoked events
   *
   * @param callback - Function to call when permissions are revoked
   * @returns Unsubscribe function
   */
  onPermissionsRevoked(
    callback: EventCallback<{ username: string; origin: string }>
  ): Unsubscribe {
    return this.on('permissions-revoked', callback);
  }

  /**
   * Subscribe to session permission granted events
   *
   * @param callback - Function to call when session permission is granted
   * @returns Unsubscribe function
   */
  onSessionPermissionGranted(
    callback: EventCallback<{
      username: string;
      origin: string;
      action: string;
      eventKind?: number;
      expiresIn: number;
    }>
  ): Unsubscribe {
    return this.on('session-permission-granted', callback);
  }
}
