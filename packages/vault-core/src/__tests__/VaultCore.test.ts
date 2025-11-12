/**
 * VaultCore tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VaultCore } from '../VaultCore';

describe('VaultCore', () => {
  let vaultCore: VaultCore;

  beforeEach(() => {
    vaultCore = new VaultCore({
      workerUrl: '/test-worker.js',
      environment: 'test',
      debug: false
    });
  });

  describe('initialization', () => {
    it('should create an instance with default config', () => {
      const vault = new VaultCore({ workerUrl: '/worker.js' });

      expect(vault).toBeInstanceOf(VaultCore);
      expect(vault.getConfig()).toEqual({
        workerUrl: '/worker.js',
        environment: 'production',
        targetOrigin: '*',
        debug: false
      });
    });

    it('should create an instance with custom config', () => {
      const vault = new VaultCore({
        workerUrl: '/worker.js',
        environment: 'development',
        targetOrigin: 'https://example.com',
        debug: true
      });

      expect(vault.getConfig()).toEqual({
        workerUrl: '/worker.js',
        environment: 'development',
        targetOrigin: 'https://example.com',
        debug: true
      });
    });

    it('should have manager instances', () => {
      expect(vaultCore.auth).toBeDefined();
      expect(vaultCore.vault).toBeDefined();
      expect(vaultCore.identities).toBeDefined();
      expect(vaultCore.permissions).toBeDefined();
    });

    it('should not be initialized by default', () => {
      expect(vaultCore.isInitialized()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should initialize the vault core', async () => {
      const restoreSessionSpy = vi.spyOn(vaultCore.auth, 'restoreSession')
        .mockResolvedValue(false);

      // Mock worker ready message
      setTimeout(() => {
        const worker = vaultCore.getWorker();
        if (worker) {
          const event = new MessageEvent('message', {
            data: { type: 'WORKER_READY' }
          });
          worker.dispatchEvent(event);
        }
      }, 10);

      await vaultCore.initialize();

      expect(vaultCore.isInitialized()).toBe(true);
      expect(restoreSessionSpy).toHaveBeenCalled();
    });

    it('should not reinitialize if already initialized', async () => {
      const restoreSessionSpy = vi.spyOn(vaultCore.auth, 'restoreSession')
        .mockResolvedValue(false);

      setTimeout(() => {
        const worker = vaultCore.getWorker();
        if (worker) {
          const event = new MessageEvent('message', {
            data: { type: 'WORKER_READY' }
          });
          worker.dispatchEvent(event);
        }
      }, 10);

      await vaultCore.initialize();
      const firstInit = vaultCore.isInitialized();

      await vaultCore.initialize();
      const secondInit = vaultCore.isInitialized();

      expect(firstInit).toBe(true);
      expect(secondInit).toBe(true);
      expect(restoreSessionSpy).toHaveBeenCalledTimes(1);
    });

    it('should reject on worker timeout', async () => {
      // Don't send WORKER_READY message, let it timeout
      await expect(vaultCore.initialize()).rejects.toThrow('Worker initialization timeout');
    });
  });

  describe('getWorker', () => {
    it('should return null before initialization', () => {
      expect(vaultCore.getWorker()).toBeNull();
    });

    it('should return worker after initialization', async () => {
      setTimeout(() => {
        const worker = vaultCore.getWorker();
        if (worker) {
          const event = new MessageEvent('message', {
            data: { type: 'WORKER_READY' }
          });
          worker.dispatchEvent(event);
        }
      }, 10);

      await vaultCore.initialize();

      expect(vaultCore.getWorker()).not.toBeNull();
    });
  });

  describe('destroy', () => {
    it('should clean up resources', async () => {
      const restoreSessionSpy = vi.spyOn(vaultCore.auth, 'restoreSession')
        .mockResolvedValue(false);

      setTimeout(() => {
        const worker = vaultCore.getWorker();
        if (worker) {
          const event = new MessageEvent('message', {
            data: { type: 'WORKER_READY' }
          });
          worker.dispatchEvent(event);
        }
      }, 10);

      await vaultCore.initialize();
      expect(vaultCore.isInitialized()).toBe(true);

      await vaultCore.destroy();

      expect(vaultCore.isInitialized()).toBe(false);
      expect(vaultCore.getWorker()).toBeNull();
    });

    it('should remove all event listeners', async () => {
      const authRemoveSpy = vi.spyOn(vaultCore.auth, 'removeAllListeners');
      const vaultRemoveSpy = vi.spyOn(vaultCore.vault, 'removeAllListeners');
      const identitiesRemoveSpy = vi.spyOn(vaultCore.identities, 'removeAllListeners');
      const permissionsRemoveSpy = vi.spyOn(vaultCore.permissions, 'removeAllListeners');

      await vaultCore.destroy();

      expect(authRemoveSpy).toHaveBeenCalled();
      expect(vaultRemoveSpy).toHaveBeenCalled();
      expect(identitiesRemoveSpy).toHaveBeenCalled();
      expect(permissionsRemoveSpy).toHaveBeenCalled();
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the config', () => {
      const config1 = vaultCore.getConfig();
      const config2 = vaultCore.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different object references
    });
  });

  describe('manager integration', () => {
    it('should allow using auth manager', async () => {
      const callback = vi.fn();
      const unsubscribe = vaultCore.auth.onAuthStateChanged(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow using vault manager', async () => {
      const callback = vi.fn();
      const unsubscribe = vaultCore.vault.onVaultUpdated(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow using identities manager', async () => {
      const callback = vi.fn();
      const unsubscribe = vaultCore.identities.onIdentityCreated(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow using permissions manager', async () => {
      const callback = vi.fn();
      const unsubscribe = vaultCore.permissions.onPermissionsUpdated(callback);

      expect(typeof unsubscribe).toBe('function');
    });
  });
});
