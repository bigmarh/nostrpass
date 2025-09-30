/**
 * Unit tests for Vault message flows and handlers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Msg } from '@nostrpass/types';
import { authHandlers, vaultHandlers } from '../../../apps/vault/src/messageHandlers';

// Mock dependencies
const mockCryptoWorker = {
  getPublicKey: vi.fn(),
  signMessageWithSession: vi.fn(),
  encryptWithSession: vi.fn(),
  decryptWithSession: vi.fn(),
  hasKeysInSession: vi.fn(),
  getVaultData: vi.fn(),
  updateVaultData: vi.fn(),
};

const mockPermissionService = {
  checkPermission: vi.fn(),
  saveAppPermissions: vi.fn(),
  revokeAppPermissions: vi.fn(),
};

const mockVaultDataService = {
  getVaultData: vi.fn(),
  saveVaultData: vi.fn(),
};

const mockUser = {
  profile: {
    username: 'testuser',
    publicKey: 'test_public_key'
  }
};

const mockSession = {
  username: 'testuser',
  publicKey: 'test_public_key',
  isUnlocked: true,
  unlockedAt: Date.now(),
  privateKey: 'test_private_key',
  xpriv: 'test_xpriv'
};

describe('Vault Message Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication Handlers', () => {
    describe('GET_PUBLIC_KEY', () => {
      it('should return public key when vault is unlocked', async () => {
        const mockData = {
          appName: 'Test App',
          identityIndex: 0
        };
        
        const mockContext = {
          origin: 'https://testapp.com',
          user: mockUser
        };
        
        const mockDeps = {
          cryptoWorker: mockCryptoWorker,
          permissionService: mockPermissionService,
          vaultDataService: mockVaultDataService
        };

        mockCryptoWorker.hasKeysInSession.mockResolvedValue({ hasPrivateKey: true });
        mockVaultDataService.getVaultData.mockResolvedValue({
          identities: [{
            publicKey: 'test_public_key',
            identityIndex: 0
          }]
        });
        mockCryptoWorker.getPublicKey.mockResolvedValue('test_public_key');

        const handler = authHandlers.find(h => h.route === Msg.GET_PUBLIC_KEY);
        expect(handler).toBeDefined();

        const result = await handler!.handler(mockData, mockContext, mockDeps);
        
        expect(result).toBe('test_public_key');
        expect(mockCryptoWorker.getPublicKey).toHaveBeenCalledWith('test_private_key');
      });

      it('should throw error when vault is locked', async () => {
        const mockData = {
          appName: 'Test App',
          identityIndex: 0
        };
        
        const mockContext = {
          origin: 'https://testapp.com',
          user: mockUser
        };
        
        const mockDeps = {
          cryptoWorker: mockCryptoWorker,
          permissionService: mockPermissionService,
          vaultDataService: mockVaultDataService
        };

        mockCryptoWorker.hasKeysInSession.mockResolvedValue({ hasPrivateKey: false });

        const handler = authHandlers.find(h => h.route === Msg.GET_PUBLIC_KEY);
        expect(handler).toBeDefined();

        await expect(handler!.handler(mockData, mockContext, mockDeps))
          .rejects.toThrow('Vault is locked');
      });

      it('should check permissions before returning public key', async () => {
        const mockData = {
          appName: 'Test App',
          identityIndex: 0
        };
        
        const mockContext = {
          origin: 'https://testapp.com',
          user: mockUser
        };
        
        const mockDeps = {
          cryptoWorker: mockCryptoWorker,
          permissionService: mockPermissionService,
          vaultDataService: mockVaultDataService
        };

        mockCryptoWorker.hasKeysInSession.mockResolvedValue({ hasPrivateKey: true });
        mockVaultDataService.getVaultData.mockResolvedValue({
          identities: [{
            publicKey: 'test_public_key',
            identityIndex: 0
          }]
        });
        mockPermissionService.checkPermission.mockResolvedValue(true);
        mockCryptoWorker.getPublicKey.mockResolvedValue('test_public_key');

        const handler = authHandlers.find(h => h.route === Msg.GET_PUBLIC_KEY);
        expect(handler).toBeDefined();

        const result = await handler!.handler(mockData, mockContext, mockDeps);
        
        expect(result).toBe('test_public_key');
        expect(mockPermissionService.checkPermission).toHaveBeenCalledWith(
          'testuser',
          'https://testapp.com',
          'getPublicKey'
        );
      });
    });

    describe('SIGN_EVENT', () => {
      it('should sign event when permission is granted', async () => {
        const mockData = {
          appName: 'Test App',
          data: {
            kind: 1,
            content: 'Hello, Nostr!',
            tags: [],
            created_at: Math.floor(Date.now() / 1000)
          },
          identityIndex: 0
        };
        
        const mockContext = {
          origin: 'https://testapp.com',
          user: mockUser
        };
        
        const mockDeps = {
          cryptoWorker: mockCryptoWorker,
          permissionService: mockPermissionService,
          vaultDataService: mockVaultDataService
        };

        mockCryptoWorker.hasKeysInSession.mockResolvedValue({ hasPrivateKey: true });
        mockVaultDataService.getVaultData.mockResolvedValue({
          identities: [{
            publicKey: 'test_public_key',
            identityIndex: 0
          }]
        });
        mockPermissionService.checkPermission.mockResolvedValue(true);
        mockCryptoWorker.signMessageWithSession.mockResolvedValue('test_signature');

        const handler = authHandlers.find(h => h.route === Msg.SIGN_EVENT);
        expect(handler).toBeDefined();

        const result = await handler!.handler(mockData, mockContext, mockDeps);
        
        expect(result).toBe('test_signature');
        expect(mockCryptoWorker.signMessageWithSession).toHaveBeenCalledWith({
          username: 'testuser',
          message: JSON.stringify(mockData.data),
          identityIndex: 0
        });
      });

      it('should throw error when permission is denied', async () => {
        const mockData = {
          appName: 'Test App',
          data: {
            kind: 1,
            content: 'Hello, Nostr!',
            tags: [],
            created_at: Math.floor(Date.now() / 1000)
          },
          identityIndex: 0
        };
        
        const mockContext = {
          origin: 'https://testapp.com',
          user: mockUser
        };
        
        const mockDeps = {
          cryptoWorker: mockCryptoWorker,
          permissionService: mockPermissionService,
          vaultDataService: mockVaultDataService
        };

        mockCryptoWorker.hasKeysInSession.mockResolvedValue({ hasPrivateKey: true });
        mockVaultDataService.getVaultData.mockResolvedValue({
          identities: [{
            publicKey: 'test_public_key',
            identityIndex: 0
          }]
        });
        mockPermissionService.checkPermission.mockResolvedValue(false);

        const handler = authHandlers.find(h => h.route === Msg.SIGN_EVENT);
        expect(handler).toBeDefined();

        await expect(handler!.handler(mockData, mockContext, mockDeps))
          .rejects.toThrow('Permission denied');
      });
    });

    describe('NIP-04 Encryption', () => {
      it('should encrypt message when permission is granted', async () => {
        const mockData = {
          appName: 'Test App',
          plaintext: 'Secret message',
          recipientPubkey: 'recipient_pubkey',
          identityIndex: 0
        };
        
        const mockContext = {
          origin: 'https://testapp.com',
          user: mockUser
        };
        
        const mockDeps = {
          cryptoWorker: mockCryptoWorker,
          permissionService: mockPermissionService,
          vaultDataService: mockVaultDataService
        };

        mockCryptoWorker.hasKeysInSession.mockResolvedValue({ hasPrivateKey: true });
        mockVaultDataService.getVaultData.mockResolvedValue({
          identities: [{
            publicKey: 'test_public_key',
            identityIndex: 0
          }]
        });
        mockPermissionService.checkPermission.mockResolvedValue(true);
        mockCryptoWorker.encryptWithSession.mockResolvedValue('encrypted_message');

        const handler = authHandlers.find(h => h.route === Msg.ENCRYPT);
        expect(handler).toBeDefined();

        const result = await handler!.handler(mockData, mockContext, mockDeps);
        
        expect(result).toBe('encrypted_message');
        expect(mockCryptoWorker.encryptWithSession).toHaveBeenCalledWith({
          username: 'testuser',
          plaintext: 'Secret message',
          recipientPubkey: 'recipient_pubkey',
          identityIndex: 0
        });
      });

      it('should decrypt message when permission is granted', async () => {
        const mockData = {
          appName: 'Test App',
          ciphertext: 'encrypted_message',
          senderPubkey: 'sender_pubkey',
          identityIndex: 0
        };
        
        const mockContext = {
          origin: 'https://testapp.com',
          user: mockUser
        };
        
        const mockDeps = {
          cryptoWorker: mockCryptoWorker,
          permissionService: mockPermissionService,
          vaultDataService: mockVaultDataService
        };

        mockCryptoWorker.hasKeysInSession.mockResolvedValue({ hasPrivateKey: true });
        mockVaultDataService.getVaultData.mockResolvedValue({
          identities: [{
            publicKey: 'test_public_key',
            identityIndex: 0
          }]
        });
        mockPermissionService.checkPermission.mockResolvedValue(true);
        mockCryptoWorker.decryptWithSession.mockResolvedValue('decrypted_message');

        const handler = authHandlers.find(h => h.route === Msg.DECRYPT);
        expect(handler).toBeDefined();

        const result = await handler!.handler(mockData, mockContext, mockDeps);
        
        expect(result).toBe('decrypted_message');
        expect(mockCryptoWorker.decryptWithSession).toHaveBeenCalledWith({
          username: 'testuser',
          ciphertext: 'encrypted_message',
          senderPubkey: 'sender_pubkey',
          identityIndex: 0
        });
      });
    });
  });

  describe('Vault Handlers', () => {
    describe('CHECK_PERMISSION', () => {
      it('should check permission and return result', async () => {
        const mockData = {
          appName: 'Test App',
          permission: 'getPublicKey'
        };
        
        const mockContext = {
          origin: 'https://testapp.com',
          user: mockUser
        };
        
        const mockDeps = {
          cryptoWorker: mockCryptoWorker,
          permissionService: mockPermissionService,
          vaultDataService: mockVaultDataService
        };

        mockPermissionService.checkPermission.mockResolvedValue(true);

        const handler = vaultHandlers.find(h => h.route === Msg.CHECK_PERMISSION);
        expect(handler).toBeDefined();

        const result = await handler!.handler(mockData, mockContext, mockDeps);
        
        expect(result).toBe(true);
        expect(mockPermissionService.checkPermission).toHaveBeenCalledWith(
          'testuser',
          'https://testapp.com',
          'getPublicKey'
        );
      });

      it('should return false when permission is denied', async () => {
        const mockData = {
          appName: 'Test App',
          permission: 'signEvent'
        };
        
        const mockContext = {
          origin: 'https://testapp.com',
          user: mockUser
        };
        
        const mockDeps = {
          cryptoWorker: mockCryptoWorker,
          permissionService: mockPermissionService,
          vaultDataService: mockVaultDataService
        };

        mockPermissionService.checkPermission.mockResolvedValue(false);

        const handler = vaultHandlers.find(h => h.route === Msg.CHECK_PERMISSION);
        expect(handler).toBeDefined();

        const result = await handler!.handler(mockData, mockContext, mockDeps);
        
        expect(result).toBe(false);
      });
    });

    describe('GET_VAULT_DATA', () => {
      it('should return vault data when vault is unlocked', async () => {
        const mockData = {};
        
        const mockContext = {
          origin: 'https://testapp.com',
          user: mockUser
        };
        
        const mockDeps = {
          cryptoWorker: mockCryptoWorker,
          permissionService: mockPermissionService,
          vaultDataService: mockVaultDataService
        };

        const mockVaultData = {
          username: 'testuser',
          identities: [{
            publicKey: 'test_public_key',
            identityIndex: 0
          }],
          version: 1
        };

        mockCryptoWorker.hasKeysInSession.mockResolvedValue({ hasPrivateKey: true });
        mockVaultDataService.getVaultData.mockResolvedValue(mockVaultData);

        const handler = vaultHandlers.find(h => h.route === Msg.GET_VAULT_DATA);
        expect(handler).toBeDefined();

        const result = await handler!.handler(mockData, mockContext, mockDeps);
        
        expect(result).toEqual(mockVaultData);
        expect(mockVaultDataService.getVaultData).toHaveBeenCalledWith('testuser');
      });

      it('should throw error when vault is locked', async () => {
        const mockData = {};
        
        const mockContext = {
          origin: 'https://testapp.com',
          user: mockUser
        };
        
        const mockDeps = {
          cryptoWorker: mockCryptoWorker,
          permissionService: mockPermissionService,
          vaultDataService: mockVaultDataService
        };

        mockCryptoWorker.hasKeysInSession.mockResolvedValue({ hasPrivateKey: false });

        const handler = vaultHandlers.find(h => h.route === Msg.GET_VAULT_DATA);
        expect(handler).toBeDefined();

        await expect(handler!.handler(mockData, mockContext, mockDeps))
          .rejects.toThrow('Vault is locked');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle crypto worker errors', async () => {
      const mockData = {
        appName: 'Test App',
        identityIndex: 0
      };
      
      const mockContext = {
        origin: 'https://testapp.com',
        user: mockUser
      };
      
      const mockDeps = {
        cryptoWorker: mockCryptoWorker,
        permissionService: mockPermissionService,
        vaultDataService: mockVaultDataService
      };

      mockCryptoWorker.hasKeysInSession.mockRejectedValue(new Error('Crypto worker error'));

      const handler = authHandlers.find(h => h.route === Msg.GET_PUBLIC_KEY);
      expect(handler).toBeDefined();

      await expect(handler!.handler(mockData, mockContext, mockDeps))
        .rejects.toThrow('Crypto worker error');
    });

    it('should handle permission service errors', async () => {
      const mockData = {
        appName: 'Test App',
        permission: 'getPublicKey'
      };
      
      const mockContext = {
        origin: 'https://testapp.com',
        user: mockUser
      };
      
      const mockDeps = {
        cryptoWorker: mockCryptoWorker,
        permissionService: mockPermissionService,
        vaultDataService: mockVaultDataService
      };

      mockPermissionService.checkPermission.mockRejectedValue(new Error('Permission service error'));

      const handler = vaultHandlers.find(h => h.route === Msg.CHECK_PERMISSION);
      expect(handler).toBeDefined();

      await expect(handler!.handler(mockData, mockContext, mockDeps))
        .rejects.toThrow('Permission service error');
    });

    it('should handle vault data service errors', async () => {
      const mockData = {};
      
      const mockContext = {
        origin: 'https://testapp.com',
        user: mockUser
      };
      
      const mockDeps = {
        cryptoWorker: mockCryptoWorker,
        permissionService: mockPermissionService,
        vaultDataService: mockVaultDataService
      };

      mockCryptoWorker.hasKeysInSession.mockResolvedValue({ hasPrivateKey: true });
      mockVaultDataService.getVaultData.mockRejectedValue(new Error('Vault data service error'));

      const handler = vaultHandlers.find(h => h.route === Msg.GET_VAULT_DATA);
      expect(handler).toBeDefined();

      await expect(handler!.handler(mockData, mockContext, mockDeps))
        .rejects.toThrow('Vault data service error');
    });
  });

  describe('Identity Switching', () => {
    it('should handle different identity indices', async () => {
      const mockData = {
        appName: 'Test App',
        identityIndex: 1
      };
      
      const mockContext = {
        origin: 'https://testapp.com',
        user: mockUser
      };
      
      const mockDeps = {
        cryptoWorker: mockCryptoWorker,
        permissionService: mockPermissionService,
        vaultDataService: mockVaultDataService
      };

      mockCryptoWorker.hasKeysInSession.mockResolvedValue({ hasPrivateKey: true });
      mockVaultDataService.getVaultData.mockResolvedValue({
        identities: [
          { publicKey: 'test_public_key_0', identityIndex: 0 },
          { publicKey: 'test_public_key_1', identityIndex: 1 }
        ]
      });
      mockPermissionService.checkPermission.mockResolvedValue(true);
      mockCryptoWorker.getPublicKey.mockResolvedValue('test_public_key_1');

      const handler = authHandlers.find(h => h.route === Msg.GET_PUBLIC_KEY);
      expect(handler).toBeDefined();

      const result = await handler!.handler(mockData, mockContext, mockDeps);
      
      expect(result).toBe('test_public_key_1');
    });
  });
});

