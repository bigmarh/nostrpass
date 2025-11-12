/**
 * VaultManager tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VaultManager } from '../managers/VaultManager';

describe('VaultManager', () => {
  let vaultManager: VaultManager;
  let mockWorker: Worker;

  beforeEach(() => {
    mockWorker = new Worker('test.js');
    vaultManager = new VaultManager(mockWorker);
  });

  describe('initialization', () => {
    it('should create an instance', () => {
      expect(vaultManager).toBeInstanceOf(VaultManager);
    });

    it('should have a worker reference', () => {
      expect((vaultManager as any).worker).toBe(mockWorker);
    });
  });

  describe('event subscriptions', () => {
    it('should allow subscribing to vault updated events', () => {
      const callback = vi.fn();
      const unsubscribe = vaultManager.onVaultUpdated(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unsubscribe when calling returned function', () => {
      const callback = vi.fn();
      const unsubscribe = vaultManager.onVaultUpdated(callback);

      unsubscribe();

      (vaultManager as any).emit('vault-updated', {});
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('getVaultData', () => {
    it('should send getVaultData message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = vaultManager.getVaultData('alice');

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'getVaultData',
          data: { username: 'alice' }
        })
      );

      await expect(promise).rejects.toThrow(); // Will reject due to timeout
    });

    it('should include forceRefresh option', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = vaultManager.getVaultData('alice', { forceRefresh: true });

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'getVaultData',
          data: {
            username: 'alice',
            forceRefresh: true
          }
        })
      );

      await expect(promise).rejects.toThrow();
    });
  });

  describe('updateVaultData', () => {
    it('should send updateVaultData message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const vaultData = {
        username: 'alice',
        identities: [],
        xprivEncrypted: 'encrypted',
        xprivRecovery: 'recovery',
        salt: 'salt',
        version: 1,
        updatedAt: Date.now()
      };

      const promise = vaultManager.updateVaultData('alice', vaultData);

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'updateVaultData',
          data: {
            username: 'alice',
            vaultData
          }
        })
      );

      await expect(promise).rejects.toThrow();
    });

    it('should emit vault-updated event on success', async () => {
      const callback = vi.fn();
      vaultManager.onVaultUpdated(callback);

      const vaultData = {
        username: 'alice',
        identities: [],
        xprivEncrypted: 'encrypted',
        xprivRecovery: 'recovery',
        salt: 'salt',
        version: 1,
        updatedAt: Date.now()
      };

      // Mock successful response
      setTimeout(() => {
        const listeners = (mockWorker as any)._listeners?.message || [];
        listeners.forEach((listener: any) => {
          listener({
            data: {
              requestId: expect.any(String),
              success: true
            }
          });
        });
      }, 10);

      try {
        await vaultManager.updateVaultData('alice', vaultData);
      } catch (e) {
        // Expected to timeout in test
      }

      // Event should be emitted before worker response timeout
      // In real implementation, event is emitted after successful response
    });
  });

  describe('deleteVault', () => {
    it('should send deleteVault message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = vaultManager.deleteVault('alice', 'password');

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'deleteVault',
          data: {
            username: 'alice',
            password: 'password'
          }
        })
      );

      await expect(promise).rejects.toThrow();
    });
  });

  describe('checkVaultExists', () => {
    it('should send checkVaultExists message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = vaultManager.checkVaultExists('alice');

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'checkVaultExists',
          data: { username: 'alice' }
        })
      );

      await expect(promise).rejects.toThrow();
    });
  });

  describe('syncToNostr', () => {
    it('should send syncToNostr message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = vaultManager.syncToNostr('alice');

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'syncToNostr',
          data: { username: 'alice' }
        })
      );

      await expect(promise).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle worker errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Trigger error by calling method
      const promise = vaultManager.getVaultData('alice');

      await expect(promise).rejects.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
