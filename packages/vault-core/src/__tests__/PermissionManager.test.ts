/**
 * PermissionManager tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PermissionManager } from '../managers/PermissionManager';

describe('PermissionManager', () => {
  let permissionManager: PermissionManager;
  let mockWorker: Worker;

  beforeEach(() => {
    mockWorker = new Worker('test.js');
    permissionManager = new PermissionManager(mockWorker);
  });

  describe('initialization', () => {
    it('should create an instance', () => {
      expect(permissionManager).toBeInstanceOf(PermissionManager);
    });

    it('should have a worker reference', () => {
      expect((permissionManager as any).worker).toBe(mockWorker);
    });
  });

  describe('event subscriptions', () => {
    it('should allow subscribing to permissions updated events', () => {
      const callback = vi.fn();
      const unsubscribe = permissionManager.onPermissionsUpdated(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow subscribing to permissions revoked events', () => {
      const callback = vi.fn();
      const unsubscribe = permissionManager.onPermissionsRevoked(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow subscribing to session permission granted events', () => {
      const callback = vi.fn();
      const unsubscribe = permissionManager.onSessionPermissionGranted(callback);

      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('getAppPermissions', () => {
    it('should send getAppPermissions message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = permissionManager.getAppPermissions(
        'alice',
        'https://app.example.com'
      );

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'getAppPermissions',
          data: {
            username: 'alice',
            origin: 'https://app.example.com',
            identityIndex: undefined
          }
        })
      );

      await expect(promise).rejects.toThrow();
    });

    it('should include identityIndex if provided', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = permissionManager.getAppPermissions(
        'alice',
        'https://app.example.com',
        0
      );

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'getAppPermissions',
          data: {
            username: 'alice',
            origin: 'https://app.example.com',
            identityIndex: 0
          }
        })
      );

      await expect(promise).rejects.toThrow();
    });
  });

  describe('checkPermission', () => {
    it('should send checkPermission message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = permissionManager.checkPermission(
        'alice',
        'https://app.example.com',
        'signEvent',
        1
      );

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'checkPermission',
          data: {
            username: 'alice',
            origin: 'https://app.example.com',
            action: 'signEvent',
            eventKind: 1
          }
        })
      );

      await expect(promise).rejects.toThrow();
    });

    it('should work without eventKind', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = permissionManager.checkPermission(
        'alice',
        'https://app.example.com',
        'getPublicKey'
      );

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'checkPermission',
          data: {
            username: 'alice',
            origin: 'https://app.example.com',
            action: 'getPublicKey',
            eventKind: undefined
          }
        })
      );

      await expect(promise).rejects.toThrow();
    });
  });

  describe('saveAppPermissions', () => {
    it('should send saveAppPermissions message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const permissions = {
        permissions: {
          social: 'ALLOW' as const,
          messaging: 'ASK_EVERYTIME' as const,
          signData: 'ASK_EVERYTIME' as const,
          financial: 'DENY' as const
        },
        getPublicKey: 'ALLOW' as const
      };

      const promise = permissionManager.saveAppPermissions(
        'alice',
        'https://app.example.com',
        permissions,
        'Example App'
      );

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'saveAppPermissions',
          data: {
            username: 'alice',
            origin: 'https://app.example.com',
            permissions,
            appName: 'Example App',
            identityIndex: undefined
          }
        })
      );

      await expect(promise).rejects.toThrow();
    });

    it('should emit permissions-updated event', async () => {
      const callback = vi.fn();
      permissionManager.onPermissionsUpdated(callback);

      const permissions = {
        getPublicKey: 'ALLOW' as const
      };

      setTimeout(() => {
        (permissionManager as any).emit('permissions-updated', {
          username: 'alice',
          origin: 'https://app.example.com',
          permissions
        });
      }, 10);

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(callback).toHaveBeenCalledWith({
        username: 'alice',
        origin: 'https://app.example.com',
        permissions
      });
    });
  });

  describe('grantSessionPermission', () => {
    it('should send grantSessionPermission message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = permissionManager.grantSessionPermission(
        'alice',
        'https://app.example.com',
        'signEvent',
        1,
        30
      );

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'grantSessionPermission',
          data: {
            username: 'alice',
            origin: 'https://app.example.com',
            action: 'signEvent',
            eventKind: 1,
            sessionDurationMinutes: 30
          }
        })
      );

      await expect(promise).rejects.toThrow();
    });

    it('should use default duration of 60 minutes', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = permissionManager.grantSessionPermission(
        'alice',
        'https://app.example.com',
        'signEvent'
      );

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'grantSessionPermission',
          data: {
            username: 'alice',
            origin: 'https://app.example.com',
            action: 'signEvent',
            eventKind: undefined,
            sessionDurationMinutes: 60
          }
        })
      );

      await expect(promise).rejects.toThrow();
    });
  });

  describe('revokeAppPermissions', () => {
    it('should send revokeAppPermissions message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = permissionManager.revokeAppPermissions(
        'alice',
        'https://app.example.com'
      );

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'revokeAppPermissions',
          data: {
            username: 'alice',
            origin: 'https://app.example.com'
          }
        })
      );

      await expect(promise).rejects.toThrow();
    });

    it('should emit permissions-revoked event', async () => {
      const callback = vi.fn();
      permissionManager.onPermissionsRevoked(callback);

      setTimeout(() => {
        (permissionManager as any).emit('permissions-revoked', {
          username: 'alice',
          origin: 'https://app.example.com'
        });
      }, 10);

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(callback).toHaveBeenCalledWith({
        username: 'alice',
        origin: 'https://app.example.com'
      });
    });
  });

  describe('getAllAppPermissions', () => {
    it('should send getAllAppPermissions message to worker', async () => {
      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      const promise = permissionManager.getAllAppPermissions('alice');

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'getAllAppPermissions',
          data: { username: 'alice' }
        })
      );

      await expect(promise).rejects.toThrow();
    });
  });

  describe('isOriginAllowed', () => {
    it('should return true for wildcard', () => {
      const result = permissionManager.isOriginAllowed(
        'https://any.example.com',
        ['*']
      );

      expect(result).toBe(true);
    });

    it('should return true for exact match', () => {
      const result = permissionManager.isOriginAllowed(
        'https://app.example.com',
        ['https://app.example.com']
      );

      expect(result).toBe(true);
    });

    it('should return true for wildcard subdomain match', () => {
      const result = permissionManager.isOriginAllowed(
        'https://sub.example.com',
        ['*.example.com']
      );

      expect(result).toBe(true);
    });

    it('should return false for non-matching origin', () => {
      const result = permissionManager.isOriginAllowed(
        'https://other.com',
        ['https://app.example.com']
      );

      expect(result).toBe(false);
    });

    it('should return false for invalid URL', () => {
      const result = permissionManager.isOriginAllowed(
        'not-a-url',
        ['https://app.example.com']
      );

      expect(result).toBe(false);
    });
  });

  describe('updateLastUsed', () => {
    it('should update lastUsedAt timestamp', async () => {
      const getAppPermissionsSpy = vi.spyOn(permissionManager, 'getAppPermissions')
        .mockResolvedValue({
          appId: 'https://app.example.com',
          appName: 'Example App',
          grantedAt: Date.now(),
          lastUsedAt: Date.now() - 1000,
          permissions: {
            social: 'ALLOW',
            messaging: 'ASK_EVERYTIME',
            signData: 'ASK_EVERYTIME',
            financial: 'DENY'
          },
          getPublicKey: 'ALLOW'
        });

      const saveAppPermissionsSpy = vi.spyOn(permissionManager, 'saveAppPermissions')
        .mockResolvedValue();

      await permissionManager.updateLastUsed('alice', 'https://app.example.com');

      expect(getAppPermissionsSpy).toHaveBeenCalledWith('alice', 'https://app.example.com');
      expect(saveAppPermissionsSpy).toHaveBeenCalled();

      const savedPerms = saveAppPermissionsSpy.mock.calls[0][2];
      expect((savedPerms as any).lastUsedAt).toBeGreaterThan(Date.now() - 1000);
    });

    it('should do nothing if no permissions exist', async () => {
      const getAppPermissionsSpy = vi.spyOn(permissionManager, 'getAppPermissions')
        .mockResolvedValue(null);

      const saveAppPermissionsSpy = vi.spyOn(permissionManager, 'saveAppPermissions')
        .mockResolvedValue();

      await permissionManager.updateLastUsed('alice', 'https://app.example.com');

      expect(getAppPermissionsSpy).toHaveBeenCalled();
      expect(saveAppPermissionsSpy).not.toHaveBeenCalled();
    });
  });
});
