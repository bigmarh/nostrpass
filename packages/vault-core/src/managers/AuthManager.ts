/**
 * AuthManager - Framework-agnostic authentication manager
 *
 * Handles all authentication operations including:
 * - Login/logout
 * - Session management
 * - Vault locking/unlocking
 * - Account migration
 * - Cross-tab synchronization
 *
 * @example
 * ```typescript
 * const auth = new AuthManager(worker);
 *
 * // Listen to auth state
 * auth.onAuthStateChanged((user) => {
 *   console.log('User:', user);
 * });
 *
 * // Login
 * const result = await auth.login('username', 'password');
 * if (result.success) {
 *   console.log('Logged in as:', result.user);
 * }
 *
 * // Unlock vault with PIN
 * await auth.unlockVault('123456');
 * ```
 */

import { EventEmitter } from '../utils/EventEmitter';
import type {
  User,
  LoginResult,
  UnlockResult,
  EventCallback,
  Unsubscribe
} from '../types';

export class AuthManager extends EventEmitter {
  private worker: Worker | any; // Can be raw Worker or RPC client
  private currentUser: User | null = null;
  private isLocked: boolean = true;
  private sessionId: string | null = null;
  private isRpcMode: boolean = false; // Track if using RPC client
  private environment?: string;
  private relays?: string[];

  constructor(worker: Worker | any, config?: { environment?: string; relays?: string[] }) {
    super();
    this.worker = worker;
    this.environment = config?.environment;
    this.relays = config?.relays;

    // Detect if this is an RPC client (has method-like properties)
    this.isRpcMode = worker && typeof worker.login === 'function';

    // Only set up listeners for raw Worker mode
    if (this.worker && !this.isRpcMode) {
      this.setupWorkerListeners();
    }
  }

  /**
   * Set up listeners for worker messages related to auth (raw Worker mode only)
   */
  private setupWorkerListeners(): void {
    if (!this.worker || this.isRpcMode) return;

    this.worker.addEventListener('message', (event: MessageEvent) => {
      const { type } = event.data;

      switch (type) {
        case 'SESSION_EXPIRED':
          this.handleSessionExpired();
          break;
        case 'SESSION_LOCKED':
          this.handleSessionLocked();
          break;
        case 'USER_LOGGED_OUT':
          this.handleLogout();
          break;
        default:
          // Ignore other message types
          break;
      }
    });
  }

  /**
   * Send message to worker and wait for response
   * Supports both raw Worker (postMessage) and RPC client modes
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

          if (event.data.success) {
            resolve(event.data.data);
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
   * Login with username and password
   *
   * @param username - User's username
   * @param password - User's password
   * @returns Login result with user data or error
   *
   * @example
   * ```typescript
   * const result = await auth.login('alice', 'password123');
   * if (result.success) {
   *   console.log('Welcome', result.user.profile.username);
   * } else {
   *   console.error('Login failed:', result.error);
   * }
   * ```
   */
  async login(username: string, password: string): Promise<LoginResult> {
    try {
      const result = await this.sendToWorker<{
        success: boolean;
        user?: User;
        sessionId?: string;
        needsMigration?: boolean;
      }>('login', {
        username,
        password,
        environment: this.environment,
        relays: this.relays
      });

      if (result.success && result.user) {
        this.currentUser = result.user;
        this.sessionId = result.sessionId || null;
        this.isLocked = false;

        // Store session info in localStorage
        if (this.sessionId) {
          localStorage.setItem('vaultsession', this.sessionId);
          localStorage.setItem('last-username', username);
        }

        // Emit events
        this.emit('auth-state-changed', this.currentUser);
        this.emit('lock-state-changed', this.isLocked);

        return {
          success: true,
          user: this.currentUser,
          needsMigration: result.needsMigration
        };
      }

      return { success: false, error: 'Login failed' };
    } catch (error) {
      console.error('[AuthManager] Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  }

  /**
   * Logout the current user
   *
   * @example
   * ```typescript
   * await auth.logout();
   * console.log('Logged out');
   * ```
   */
  async logout(): Promise<void> {
    try {
      await this.sendToWorker('logout', {
        username: this.currentUser?.profile.username
      });

      this.handleLogout();
    } catch (error) {
      console.error('[AuthManager] Logout error:', error);
      // Still clear local state even if worker fails
      this.handleLogout();
    }
  }

  /**
   * Unlock vault with PIN
   *
   * @param pin - 6-digit PIN
   * @returns Unlock result
   *
   * @example
   * ```typescript
   * const result = await auth.unlockVault('123456');
   * if (result.success) {
   *   console.log('Vault unlocked');
   * }
   * ```
   */
  async unlockVault(pin: string): Promise<UnlockResult> {
    try {
      if (!this.currentUser) {
        return { success: false, error: 'No user logged in' };
      }

      const result = await this.sendToWorker<{ success: boolean }>('unlockVault', {
        username: this.currentUser.profile.username,
        pin
      });

      if (result.success) {
        this.isLocked = false;
        this.emit('lock-state-changed', this.isLocked);
        return { success: true };
      }

      return { success: false, error: 'Incorrect PIN' };
    } catch (error) {
      console.error('[AuthManager] Unlock error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unlock failed'
      };
    }
  }

  /**
   * Lock the vault
   *
   * @example
   * ```typescript
   * await auth.lockVault();
   * console.log('Vault locked');
   * ```
   */
  async lockVault(): Promise<void> {
    try {
      if (!this.currentUser) {
        return;
      }

      await this.sendToWorker('lockVault', {
        username: this.currentUser.profile.username
      });

      this.isLocked = true;
      this.emit('lock-state-changed', this.isLocked);
    } catch (error) {
      console.error('[AuthManager] Lock error:', error);
      // Still update local state
      this.isLocked = true;
      this.emit('lock-state-changed', this.isLocked);
    }
  }

  /**
   * Restore session from localStorage on app start
   *
   * @returns True if session was restored
   *
   * @example
   * ```typescript
   * // On app initialization
   * const restored = await auth.restoreSession();
   * if (restored) {
   *   console.log('Session restored');
   * }
   * ```
   */
  async restoreSession(): Promise<boolean> {
    try {
      const lastUsername = localStorage.getItem('last-username');
      const sessionId = localStorage.getItem('vaultsession');

      if (!lastUsername || !sessionId) {
        return false;
      }

      const result = await this.sendToWorker<{
        success: boolean;
        user?: User;
        isLocked?: boolean;
      }>('getSessionStatus', { username: lastUsername });

      if (result.success && result.user) {
        this.currentUser = result.user;
        this.sessionId = sessionId;
        this.isLocked = result.isLocked ?? true;

        this.emit('auth-state-changed', this.currentUser);
        this.emit('lock-state-changed', this.isLocked);

        return true;
      }

      // Clear invalid session
      localStorage.removeItem('vaultsession');
      localStorage.removeItem('last-username');
      return false;
    } catch (error) {
      console.error('[AuthManager] Restore session error:', error);
      return false;
    }
  }

  /**
   * Handle session expiration from worker
   */
  private handleSessionExpired(): void {
    this.currentUser = null;
    this.sessionId = null;
    this.isLocked = true;

    localStorage.removeItem('vaultsession');
    localStorage.removeItem('last-username');

    this.emit('auth-state-changed', null);
    this.emit('session-expired');
  }

  /**
   * Handle session locked event from worker
   */
  private handleSessionLocked(): void {
    this.isLocked = true;
    this.emit('lock-state-changed', true);
  }

  /**
   * Handle logout (from user action or worker event)
   */
  private handleLogout(): void {
    this.currentUser = null;
    this.sessionId = null;
    this.isLocked = true;

    localStorage.removeItem('vaultsession');
    localStorage.removeItem('last-username');

    this.emit('auth-state-changed', null);
    this.emit('lock-state-changed', true);
  }

  /**
   * Get current user (synchronous)
   */
  getUser(): User | null {
    return this.currentUser;
  }

  /**
   * Check if vault is locked (synchronous)
   */
  isVaultLocked(): boolean {
    return this.isLocked;
  }

  /**
   * Check if user is authenticated (synchronous)
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  /**
   * Subscribe to authentication state changes
   *
   * @param callback - Function to call when auth state changes
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsub = auth.onAuthStateChanged((user) => {
   *   if (user) {
   *     console.log('Logged in as:', user.profile.username);
   *   } else {
   *     console.log('Logged out');
   *   }
   * });
   *
   * // Later, unsubscribe
   * unsub();
   * ```
   */
  onAuthStateChanged(callback: EventCallback<User | null>): Unsubscribe {
    return this.on('auth-state-changed', callback);
  }

  /**
   * Subscribe to lock state changes
   *
   * @param callback - Function to call when lock state changes
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsub = auth.onLockStateChanged((isLocked) => {
   *   console.log('Vault is', isLocked ? 'locked' : 'unlocked');
   * });
   * ```
   */
  onLockStateChanged(callback: EventCallback<boolean>): Unsubscribe {
    return this.on('lock-state-changed', callback);
  }

  /**
   * Subscribe to session expired events
   *
   * @param callback - Function to call when session expires
   * @returns Unsubscribe function
   */
  onSessionExpired(callback: EventCallback<void>): Unsubscribe {
    return this.on('session-expired', callback);
  }
}
