/**
 * IdentityManager tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IdentityManager } from '../managers/IdentityManager';

describe('IdentityManager', () => {
  let identityManager: IdentityManager;
  let mockWorker: Worker;

  beforeEach(() => {
    mockWorker = new Worker('test.js');
    identityManager = new IdentityManager(mockWorker);
  });

  describe('initialization', () => {
    it('should create an instance', () => {
      expect(identityManager).toBeInstanceOf(IdentityManager);
    });

    it('should have a worker reference', () => {
      expect((identityManager as any).worker).toBe(mockWorker);
    });
  });

  describe('event subscriptions', () => {
    it('should allow subscribing to identity created events', () => {
      const callback = vi.fn();
      const unsubscribe = identityManager.onIdentityCreated(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow subscribing to identity updated events', () => {
      const callback = vi.fn();
      const unsubscribe = identityManager.onIdentityUpdated(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow subscribing to identity deleted events', () => {
      const callback = vi.fn();
      const unsubscribe = identityManager.onIdentityDeleted(callback);

      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('createIdentity', () => {
    it('should send createIdentity message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const options = {
        name: 'Test Identity',
        purpose: 'general'
      };

      const promise = identityManager.createIdentity('alice', options);

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'createIdentity',
          data: {
            username: 'alice',
            options
          }
        })
      );

      await expect(promise).rejects.toThrow();
    });

    it('should include derivation path if provided', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const options = {
        name: 'Test Identity',
        purpose: 'general',
        derivationPath: "m/44'/1237'/0'/0/0"
      };

      const promise = identityManager.createIdentity('alice', options);

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'createIdentity',
          data: {
            username: 'alice',
            options
          }
        })
      );

      await expect(promise).rejects.toThrow();
    });
  });

  describe('updateIdentity', () => {
    it('should send updateIdentity message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const updates = {
        name: 'Updated Name'
      };

      const promise = identityManager.updateIdentity('alice', 0, updates);

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'updateIdentity',
          data: {
            username: 'alice',
            identityIndex: 0,
            updates
          }
        })
      );

      await expect(promise).rejects.toThrow();
    });
  });

  describe('deleteIdentity', () => {
    it('should send deleteIdentity message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = identityManager.deleteIdentity('alice', 0);

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'deleteIdentity',
          data: {
            username: 'alice',
            identityIndex: 0
          }
        })
      );

      await expect(promise).rejects.toThrow();
    });
  });

  describe('signEvent', () => {
    it('should send signEvent message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const event = {
        kind: 1,
        content: 'Hello world',
        tags: [],
        created_at: Math.floor(Date.now() / 1000)
      };

      const promise = identityManager.signEvent('alice', event, 0);

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'signEvent',
          data: {
            username: 'alice',
            event,
            identityIndex: 0
          }
        })
      );

      await expect(promise).rejects.toThrow();
    });
  });

  describe('encrypt', () => {
    it('should send encrypt message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = identityManager.encrypt(
        'alice',
        'Hello world',
        'recipient-pubkey',
        0
      );

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'encrypt',
          data: {
            username: 'alice',
            plaintext: 'Hello world',
            recipientPubkey: 'recipient-pubkey',
            identityIndex: 0
          }
        })
      );

      await expect(promise).rejects.toThrow();
    });
  });

  describe('decrypt', () => {
    it('should send decrypt message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = identityManager.decrypt(
        'alice',
        'encrypted-text',
        'sender-pubkey',
        0
      );

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'decrypt',
          data: {
            username: 'alice',
            ciphertext: 'encrypted-text',
            senderPubkey: 'sender-pubkey',
            identityIndex: 0
          }
        })
      );

      await expect(promise).rejects.toThrow();
    });
  });

  describe('getPublicKey', () => {
    it('should send getPublicKey message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = identityManager.getPublicKey('alice', 0);

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'getPublicKey',
          data: {
            username: 'alice',
            identityIndex: 0
          }
        })
      );

      await expect(promise).rejects.toThrow();
    });
  });

  describe('event emissions', () => {
    it('should emit identity-created event after successful creation', async () => {
      const callback = vi.fn();
      identityManager.onIdentityCreated(callback);

      // Mock successful worker response
      const mockIdentity = {
        index: 0,
        name: 'Test Identity',
        publicKey: 'test-pubkey',
        purpose: 'general'
      };

      // Simulate worker response
      setTimeout(() => {
        (identityManager as any).emit('identity-created', mockIdentity);
      }, 10);

      // Wait for event
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(callback).toHaveBeenCalledWith(mockIdentity);
    });

    it('should emit identity-updated event after successful update', async () => {
      const callback = vi.fn();
      identityManager.onIdentityUpdated(callback);

      const updates = { name: 'Updated Name' };

      setTimeout(() => {
        (identityManager as any).emit('identity-updated', {
          identityIndex: 0,
          updates
        });
      }, 10);

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(callback).toHaveBeenCalledWith({
        identityIndex: 0,
        updates
      });
    });

    it('should emit identity-deleted event after successful deletion', async () => {
      const callback = vi.fn();
      identityManager.onIdentityDeleted(callback);

      setTimeout(() => {
        (identityManager as any).emit('identity-deleted', 0);
      }, 10);

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(callback).toHaveBeenCalledWith(0);
    });
  });

  describe('error handling', () => {
    it('should handle worker errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const promise = identityManager.createIdentity('alice', { name: 'Test' });

      await expect(promise).rejects.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
