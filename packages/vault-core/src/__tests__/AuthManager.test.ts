/**
 * AuthManager tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthManager } from '../managers/AuthManager';

describe('AuthManager', () => {
  let authManager: AuthManager;
  let mockWorker: Worker;

  beforeEach(() => {
    // Create mock worker
    mockWorker = new Worker('test.js');
    authManager = new AuthManager(mockWorker);
  });

  describe('initialization', () => {
    it('should create an instance', () => {
      expect(authManager).toBeInstanceOf(AuthManager);
    });

    it('should have a worker reference', () => {
      expect((authManager as any).worker).toBe(mockWorker);
    });
  });

  describe('event subscriptions', () => {
    it('should allow subscribing to auth state changes', () => {
      const callback = vi.fn();
      const unsubscribe = authManager.onAuthStateChanged(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow subscribing to lock state changes', () => {
      const callback = vi.fn();
      const unsubscribe = authManager.onLockStateChanged(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow subscribing to session expired events', () => {
      const callback = vi.fn();
      const unsubscribe = authManager.onSessionExpired(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unsubscribe when calling returned function', () => {
      const callback = vi.fn();
      const unsubscribe = authManager.onAuthStateChanged(callback);

      // Unsubscribe
      unsubscribe();

      // Emit event - callback should not be called
      (authManager as any).emit('auth-state-changed', null);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should send login message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      // Mock worker response
      setTimeout(() => {
        const event = new MessageEvent('message', {
          data: {
            requestId: expect.any(String),
            success: true,
            data: {
              success: true,
              user: {
                publicKey: 'test-pubkey',
                profile: { username: 'alice' }
              }
            }
          }
        });
        mockWorker.dispatchEvent(event);
      }, 10);

      const promise = authManager.login('alice', 'password');

      // Check that postMessage was called
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'login',
          data: {
            username: 'alice',
            password: 'password'
          }
        })
      );

      await expect(promise).rejects.toThrow(); // Will reject due to timeout in test
    });
  });

  describe('logout', () => {
    it('should send logout message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = authManager.logout();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'logout'
        })
      );

      await expect(promise).rejects.toThrow(); // Will reject due to timeout in test
    });
  });

  describe('lockVault', () => {
    it('should send lockVault message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = authManager.lockVault();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'lockVault'
        })
      );

      await expect(promise).rejects.toThrow(); // Will reject due to timeout in test
    });
  });

  describe('unlockVault', () => {
    it('should send unlockVault message to worker with PIN', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = authManager.unlockVault('123456');

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'unlockVault',
          data: { pin: '123456' }
        })
      );

      await expect(promise).rejects.toThrow(); // Will reject due to timeout in test
    });
  });

  describe('restoreSession', () => {
    it('should send restoreSession message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = authManager.restoreSession();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'restoreSession'
        })
      );

      await expect(promise).rejects.toThrow(); // Will reject due to timeout in test
    });
  });

  describe('getCurrentUser', () => {
    it('should return null initially', () => {
      expect(authManager.getCurrentUser()).toBeNull();
    });

    it('should return user after auth state change', () => {
      const user = {
        publicKey: 'test-pubkey',
        privateKey: 'test-privkey',
        profile: { username: 'alice' } as any,
        appPermissions: new Map(),
        isAuthenticated: true,
        session: {
          startedAt: Date.now(),
          lastActivityAt: Date.now()
        }
      };

      (authManager as any).emit('auth-state-changed', user);
      expect(authManager.getCurrentUser()).toBe(user);
    });
  });

  describe('isVaultLocked', () => {
    it('should return true initially', () => {
      expect(authManager.isVaultLocked()).toBe(true);
    });

    it('should return false after lock state change', () => {
      (authManager as any).emit('lock-state-changed', false);
      expect(authManager.isVaultLocked()).toBe(false);
    });
  });

  describe('event handling', () => {
    it('should handle SESSION_EXPIRED message', () => {
      const callback = vi.fn();
      authManager.onSessionExpired(callback);

      const event = new MessageEvent('message', {
        data: { type: 'SESSION_EXPIRED' }
      });

      mockWorker.dispatchEvent(event);

      expect(callback).toHaveBeenCalled();
    });

    it('should handle SESSION_LOCKED message', () => {
      const callback = vi.fn();
      authManager.onLockStateChanged(callback);

      const event = new MessageEvent('message', {
        data: { type: 'SESSION_LOCKED' }
      });

      mockWorker.dispatchEvent(event);

      expect(callback).toHaveBeenCalledWith(true);
    });

    it('should handle USER_LOGGED_OUT message', () => {
      const callback = vi.fn();
      authManager.onAuthStateChanged(callback);

      const event = new MessageEvent('message', {
        data: { type: 'USER_LOGGED_OUT' }
      });

      mockWorker.dispatchEvent(event);

      expect(callback).toHaveBeenCalledWith(null);
    });
  });
});
