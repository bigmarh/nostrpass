/**
 * VaultCore - Main framework-agnostic vault management class
 *
 * Provides a unified interface to all vault operations including:
 * - Authentication and session management
 * - Vault data operations
 * - Identity management
 * - Permission management
 * - Event-based state updates
 *
 * This class is framework-agnostic and can be used with any UI framework
 * (React, SolidJS, Svelte, Vue, etc.) or vanilla JavaScript.
 *
 * @example
 * ```typescript
 * // Initialize vault core
 * const vault = new VaultCore({
 *   workerUrl: '/crypto.worker.js',
 *   environment: 'production',
 *   debug: true
 * });
 *
 * await vault.initialize();
 *
 * // Listen to auth state
 * vault.auth.onAuthStateChanged((user) => {
 *   if (user) {
 *     console.log('User logged in:', user.profile.username);
 *   }
 * });
 *
 * // Login
 * const result = await vault.auth.login('alice', 'password');
 * if (result.success) {
 *   console.log('Logged in successfully');
 * }
 *
 * // Create identity
 * const identity = await vault.identities.createIdentity('alice', {
 *   name: 'My Identity',
 *   purpose: 'general'
 * });
 *
 * // Check permissions
 * const permResult = await vault.permissions.checkPermission(
 *   'alice',
 *   'https://app.example.com',
 *   'signEvent',
 *   1
 * );
 * ```
 */

import { AuthManager } from './managers/AuthManager';
import { VaultManager } from './managers/VaultManager';
import { IdentityManager } from './managers/IdentityManager';
import { PermissionManager } from './managers/PermissionManager';
import type { VaultCoreConfig } from './types';

export class VaultCore {
  private worker: Worker | null = null;
  private config: VaultCoreConfig;
  private initialized: boolean = false;

  // Public manager instances
  public readonly auth: AuthManager;
  public readonly vault: VaultManager;
  public readonly identities: IdentityManager;
  public readonly permissions: PermissionManager;

  constructor(config: VaultCoreConfig) {
    this.config = {
      environment: 'production',
      targetOrigin: '*',
      debug: false,
      ...config
    };

    // Create placeholder worker (will be initialized later)
    this.worker = null as any;

    // Initialize managers with worker
    this.auth = new AuthManager(this.worker as Worker);
    this.vault = new VaultManager(this.worker as Worker);
    this.identities = new IdentityManager(this.worker as Worker);
    this.permissions = new PermissionManager(this.worker as Worker);
  }

  /**
   * Initialize the vault core (creates worker and sets up managers)
   *
   * @returns Promise that resolves when initialization is complete
   *
   * @example
   * ```typescript
   * const vault = new VaultCore({ workerUrl: '/crypto.worker.js' });
   * await vault.initialize();
   * console.log('Vault core ready');
   * ```
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      if (this.config.debug) {
        console.log('[VaultCore] Already initialized');
      }
      return;
    }

    try {
      // Create worker
      this.worker = new Worker(this.config.workerUrl);

      if (this.config.debug) {
        console.log('[VaultCore] Worker created:', this.config.workerUrl);
      }

      // Update manager worker references
      (this.auth as any).worker = this.worker;
      (this.vault as any).worker = this.worker;
      (this.identities as any).worker = this.worker;
      (this.permissions as any).worker = this.worker;

      // Set up worker listeners now that worker is assigned
      if (typeof (this.auth as any).setupWorkerListeners === 'function') {
        (this.auth as any).setupWorkerListeners();
      }
      if (typeof (this.vault as any).setupWorkerListeners === 'function') {
        (this.vault as any).setupWorkerListeners();
      }

      // Wait for worker to be ready
      await this.waitForWorkerReady();

      // Try to restore previous session
      await this.auth.restoreSession();

      this.initialized = true;

      if (this.config.debug) {
        console.log('[VaultCore] Initialized successfully');
      }
    } catch (error) {
      console.error('[VaultCore] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Wait for worker to be ready
   */
  private waitForWorkerReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not created'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Worker initialization timeout'));
      }, 10000);

      const handler = (event: MessageEvent) => {
        if (event.data.type === 'WORKER_READY') {
          clearTimeout(timeout);
          this.worker?.removeEventListener('message', handler);
          resolve();
        }
      };

      this.worker.addEventListener('message', handler);

      // Send initialization message
      this.worker.postMessage({
        type: 'INIT',
        data: {
          environment: this.config.environment,
          targetOrigin: this.config.targetOrigin
        }
      });
    });
  }

  /**
   * Check if vault core is initialized
   *
   * @returns True if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Destroy vault core and clean up resources
   *
   * @example
   * ```typescript
   * await vault.destroy();
   * console.log('Vault core destroyed');
   * ```
   */
  async destroy(): Promise<void> {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Remove all event listeners
    this.auth.removeAllListeners();
    this.vault.removeAllListeners();
    this.identities.removeAllListeners();
    this.permissions.removeAllListeners();

    this.initialized = false;

    if (this.config.debug) {
      console.log('[VaultCore] Destroyed');
    }
  }

  /**
   * Get the underlying worker instance (for advanced use cases)
   *
   * @returns Worker instance or null
   */
  getWorker(): Worker | null {
    return this.worker;
  }

  /**
   * Get configuration
   *
   * @returns Current configuration
   */
  getConfig(): VaultCoreConfig {
    return { ...this.config };
  }
}
