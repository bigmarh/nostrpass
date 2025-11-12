/**
 * VaultManager - Framework-agnostic vault operations manager
 *
 * Handles all vault CRUD operations including:
 * - Get vault data
 * - Update vault data
 * - Delete vault
 * - Check vault existence
 *
 * @example
 * ```typescript
 * const vault = new VaultManager(worker);
 *
 * // Get vault data
 * const data = await vault.getVaultData('username');
 *
 * // Update vault data
 * await vault.updateVaultData('username', updatedData);
 *
 * // Listen to vault updates
 * vault.onVaultUpdated((data) => {
 *   console.log('Vault updated:', data);
 * });
 * ```
 */

import { EventEmitter } from '../utils/EventEmitter';
import type { VaultData, EventCallback, Unsubscribe } from '../types';

export class VaultManager extends EventEmitter {
  private worker: Worker;
  private currentVaultData: VaultData | null = null;

  constructor(worker: Worker) {
    super();
    this.worker = worker;
    if (this.worker) {
      this.setupWorkerListeners();
    }
  }

  /**
   * Set up listeners for worker messages related to vault
   */
  private setupWorkerListeners(): void {
    if (!this.worker) return;

    this.worker.addEventListener('message', (event: MessageEvent) => {
      const { type, data } = event.data;

      switch (type) {
        case 'VAULT_DATA_UPDATED':
          this.handleVaultUpdate(data.vaultData);
          break;
        default:
          // Ignore other message types
          break;
      }
    });
  }

  /**
   * Send message to worker and wait for response
   */
  private async sendToWorker<T = any>(type: string, data?: any): Promise<T> {
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
   * Get vault data for a user
   *
   * @param username - Username to get vault for
   * @returns Vault data or null if not found
   *
   * @example
   * ```typescript
   * const vaultData = await vault.getVaultData('alice');
   * console.log('Identities:', vaultData.identities);
   * ```
   */
  async getVaultData(username: string): Promise<VaultData | null> {
    try {
      const result = await this.sendToWorker<VaultData>('getVaultData', { username });

      if (result) {
        this.currentVaultData = result;
        return result;
      }

      return null;
    } catch (error) {
      console.error('[VaultManager] Get vault data error:', error);
      return null;
    }
  }

  /**
   * Update vault data
   *
   * @param username - Username
   * @param vaultData - Updated vault data
   *
   * @example
   * ```typescript
   * const vaultData = await vault.getVaultData('alice');
   * vaultData.identities.push(newIdentity);
   * await vault.updateVaultData('alice', vaultData);
   * ```
   */
  async updateVaultData(username: string, vaultData: VaultData): Promise<void> {
    try {
      await this.sendToWorker('updateVaultData', { username, vaultData });

      this.currentVaultData = vaultData;
      this.emit('vault-updated', vaultData);
    } catch (error) {
      console.error('[VaultManager] Update vault data error:', error);
      throw error;
    }
  }

  /**
   * Delete vault for a user
   *
   * @param username - Username
   * @param password - User password for verification
   *
   * @example
   * ```typescript
   * await vault.deleteVault('alice', 'password123');
   * ```
   */
  async deleteVault(username: string, password: string): Promise<void> {
    try {
      await this.sendToWorker('deleteVault', { username, password });

      this.currentVaultData = null;
      this.emit('vault-deleted', username);
    } catch (error) {
      console.error('[VaultManager] Delete vault error:', error);
      throw error;
    }
  }

  /**
   * Check if a vault exists for a username
   *
   * @param username - Username to check
   * @returns True if vault exists
   *
   * @example
   * ```typescript
   * const exists = await vault.checkVaultExists('alice');
   * if (exists) {
   *   console.log('Vault found');
   * }
   * ```
   */
  async checkVaultExists(username: string): Promise<boolean> {
    try {
      const result = await this.sendToWorker<{ exists: boolean }>('checkVaultExists', {
        username
      });

      return result.exists;
    } catch (error) {
      console.error('[VaultManager] Check vault exists error:', error);
      return false;
    }
  }

  /**
   * Get current cached vault data (synchronous)
   *
   * @returns Current vault data or null
   */
  getCurrentVaultData(): VaultData | null {
    return this.currentVaultData;
  }

  /**
   * Handle vault update from worker
   */
  private handleVaultUpdate(vaultData: VaultData): void {
    this.currentVaultData = vaultData;
    this.emit('vault-updated', vaultData);
  }

  /**
   * Subscribe to vault updates
   *
   * @param callback - Function to call when vault is updated
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsub = vault.onVaultUpdated((data) => {
   *   console.log('Vault updated with', data.identities.length, 'identities');
   * });
   * ```
   */
  onVaultUpdated(callback: EventCallback<VaultData>): Unsubscribe {
    return this.on('vault-updated', callback);
  }

  /**
   * Subscribe to vault deletion events
   *
   * @param callback - Function to call when vault is deleted
   * @returns Unsubscribe function
   */
  onVaultDeleted(callback: EventCallback<string>): Unsubscribe {
    return this.on('vault-deleted', callback);
  }
}
