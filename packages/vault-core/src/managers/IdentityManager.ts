/**
 * IdentityManager - Framework-agnostic identity operations manager
 *
 * Handles all identity-related operations including:
 * - Create/update/delete identities
 * - Sign events
 * - Encrypt/decrypt messages (NIP-04)
 * - Derive keys
 *
 * @example
 * ```typescript
 * const identity = new IdentityManager(worker);
 *
 * // Create identity
 * const newIdentity = await identity.createIdentity({
 *   name: 'My Identity',
 *   purpose: 'general'
 * });
 *
 * // Sign event
 * const signed = await identity.signEvent(event, 0);
 *
 * // Encrypt message
 * const encrypted = await identity.encrypt('Hello!', recipientPubkey, 0);
 * ```
 */

import { EventEmitter } from '../utils/EventEmitter';
import type {
  Identity,
  CreateIdentityOptions,
  EventCallback,
  Unsubscribe
} from '../types';

export class IdentityManager extends EventEmitter {
  private worker: Worker;
  private identities: Identity[] = [];

  constructor(worker: Worker) {
    super();
    this.worker = worker;
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
   * Create a new identity
   *
   * @param username - Username
   * @param options - Identity creation options
   * @returns Created identity
   *
   * @example
   * ```typescript
   * const identity = await identityManager.createIdentity('alice', {
   *   name: 'Personal',
   *   purpose: 'social'
   * });
   * console.log('Created identity:', identity.publicKey);
   * ```
   */
  async createIdentity(
    username: string,
    options: CreateIdentityOptions
  ): Promise<Identity> {
    try {
      const identity = await this.sendToWorker<Identity>('createIdentity', {
        username,
        ...options
      });

      this.identities.push(identity);
      this.emit('identity-created', identity);

      return identity;
    } catch (error) {
      console.error('[IdentityManager] Create identity error:', error);
      throw error;
    }
  }

  /**
   * Update an existing identity
   *
   * @param username - Username
   * @param identityIndex - Index of identity to update
   * @param updates - Fields to update
   *
   * @example
   * ```typescript
   * await identityManager.updateIdentity('alice', 0, {
   *   name: 'Updated Name'
   * });
   * ```
   */
  async updateIdentity(
    username: string,
    identityIndex: number,
    updates: Partial<Identity>
  ): Promise<void> {
    try {
      await this.sendToWorker('updateIdentity', {
        username,
        identityIndex,
        updates
      });

      if (this.identities[identityIndex]) {
        this.identities[identityIndex] = {
          ...this.identities[identityIndex],
          ...updates
        };
      }

      this.emit('identity-updated', { identityIndex, updates });
    } catch (error) {
      console.error('[IdentityManager] Update identity error:', error);
      throw error;
    }
  }

  /**
   * Delete an identity
   *
   * @param username - Username
   * @param identityIndex - Index of identity to delete
   *
   * @example
   * ```typescript
   * await identityManager.deleteIdentity('alice', 0);
   * ```
   */
  async deleteIdentity(username: string, identityIndex: number): Promise<void> {
    try {
      await this.sendToWorker('deleteIdentity', {
        username,
        identityIndex
      });

      this.identities.splice(identityIndex, 1);
      this.emit('identity-deleted', identityIndex);
    } catch (error) {
      console.error('[IdentityManager] Delete identity error:', error);
      throw error;
    }
  }

  /**
   * Sign a Nostr event
   *
   * @param username - Username
   * @param event - Event to sign
   * @param identityIndex - Index of identity to use
   * @returns Signed event
   *
   * @example
   * ```typescript
   * const event = {
   *   kind: 1,
   *   content: 'Hello Nostr!',
   *   tags: [],
   *   created_at: Math.floor(Date.now() / 1000)
   * };
   *
   * const signed = await identityManager.signEvent('alice', event, 0);
   * ```
   */
  async signEvent(
    username: string,
    event: any,
    identityIndex: number
  ): Promise<any> {
    try {
      const result = await this.sendToWorker<{ event: any }>('signEventWithSession', {
        username,
        event,
        identityIndex
      });

      return result.event;
    } catch (error) {
      console.error('[IdentityManager] Sign event error:', error);
      throw error;
    }
  }

  /**
   * Encrypt a message (NIP-04)
   *
   * @param username - Username
   * @param plaintext - Message to encrypt
   * @param recipientPubkey - Recipient's public key
   * @param identityIndex - Index of identity to use
   * @returns Encrypted message
   *
   * @example
   * ```typescript
   * const encrypted = await identityManager.encrypt(
   *   'alice',
   *   'Secret message',
   *   recipientPubkey,
   *   0
   * );
   * ```
   */
  async encrypt(
    username: string,
    plaintext: string,
    recipientPubkey: string,
    identityIndex: number
  ): Promise<string> {
    try {
      const encrypted = await this.sendToWorker<string>('encryptWithSession', {
        username,
        plaintext,
        recipientPubkey,
        identityIndex
      });

      return encrypted;
    } catch (error) {
      console.error('[IdentityManager] Encrypt error:', error);
      throw error;
    }
  }

  /**
   * Decrypt a message (NIP-04)
   *
   * @param username - Username
   * @param ciphertext - Encrypted message
   * @param senderPubkey - Sender's public key
   * @param identityIndex - Index of identity to use
   * @returns Decrypted message
   *
   * @example
   * ```typescript
   * const decrypted = await identityManager.decrypt(
   *   'alice',
   *   encrypted,
   *   senderPubkey,
   *   0
   * );
   * ```
   */
  async decrypt(
    username: string,
    ciphertext: string,
    senderPubkey: string,
    identityIndex: number
  ): Promise<string> {
    try {
      const decrypted = await this.sendToWorker<string>('decryptWithSession', {
        username,
        ciphertext,
        senderPubkey,
        identityIndex
      });

      return decrypted;
    } catch (error) {
      console.error('[IdentityManager] Decrypt error:', error);
      throw error;
    }
  }

  /**
   * Get list of identities (synchronous)
   *
   * @returns Array of identities
   */
  getIdentities(): Identity[] {
    return [...this.identities];
  }

  /**
   * Set identities (used when loading vault data)
   *
   * @param identities - Array of identities
   */
  setIdentities(identities: Identity[]): void {
    this.identities = [...identities];
  }

  /**
   * Subscribe to identity created events
   *
   * @param callback - Function to call when identity is created
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsub = identityManager.onIdentityCreated((identity) => {
   *   console.log('New identity:', identity.name);
   * });
   * ```
   */
  onIdentityCreated(callback: EventCallback<Identity>): Unsubscribe {
    return this.on('identity-created', callback);
  }

  /**
   * Subscribe to identity updated events
   *
   * @param callback - Function to call when identity is updated
   * @returns Unsubscribe function
   */
  onIdentityUpdated(
    callback: EventCallback<{ identityIndex: number; updates: Partial<Identity> }>
  ): Unsubscribe {
    return this.on('identity-updated', callback);
  }

  /**
   * Subscribe to identity deleted events
   *
   * @param callback - Function to call when identity is deleted
   * @returns Unsubscribe function
   */
  onIdentityDeleted(callback: EventCallback<number>): Unsubscribe {
    return this.on('identity-deleted', callback);
  }
}
