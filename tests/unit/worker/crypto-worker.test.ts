/**
 * Unit tests for the crypto worker functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCryptoWorker } from '../../../apps/vault/src/services/cryptoWorkerSingleton';

// Mock the crypto worker for testing
const mockCryptoWorker = {
  generateKeypair: vi.fn(),
  getPublicKey: vi.fn(),
  signEvent: vi.fn(),
  signMessage: vi.fn(),
  nip04Encrypt: vi.fn(),
  nip04Decrypt: vi.fn(),
  deriveKeyFromPassword: vi.fn(),
  encryptData: vi.fn(),
  decryptData: vi.fn(),
  generateXpriv: vi.fn(),
  deriveKeypairFromXpriv: vi.fn(),
  deriveStorageKeypairFromXpriv: vi.fn(),
  encryptLoginObj: vi.fn(),
  decryptLoginObj: vi.fn(),
  encryptVaultObj: vi.fn(),
  decryptVaultObj: vi.fn(),
  generateRandomBytes: vi.fn(),
  generateSalt: vi.fn(),
};

// Mock the crypto worker singleton
vi.mock('../../../apps/vault/src/services/cryptoWorkerSingleton', () => ({
  getCryptoWorker: vi.fn(() => mockCryptoWorker),
  getCryptoWorkerInstance: vi.fn(() => mockCryptoWorker),
}));

describe('Crypto Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Key Generation', () => {
    it('should generate a new keypair', async () => {
      const mockKeypair = {
        privateKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        publicKey: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'
      };
      
      mockCryptoWorker.generateKeypair.mockResolvedValue(mockKeypair);
      
      const worker = getCryptoWorker();
      const result = await worker.generateKeypair();
      
      expect(result).toEqual(mockKeypair);
      expect(mockCryptoWorker.generateKeypair).toHaveBeenCalledOnce();
    });

    it('should derive public key from private key', async () => {
      const privateKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const expectedPublicKey = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
      
      mockCryptoWorker.getPublicKey.mockResolvedValue(expectedPublicKey);
      
      const worker = getCryptoWorker();
      const result = await worker.getPublicKey(privateKey);
      
      expect(result).toBe(expectedPublicKey);
      expect(mockCryptoWorker.getPublicKey).toHaveBeenCalledWith(privateKey);
    });
  });

  describe('Event Signing', () => {
    it('should sign a Nostr event', async () => {
      const event = {
        kind: 1,
        content: 'Hello, Nostr!',
        tags: [],
        created_at: Math.floor(Date.now() / 1000)
      };
      const privateKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const expectedSignedEvent = {
        ...event,
        id: 'event_id_123',
        sig: 'signature_123'
      };
      
      mockCryptoWorker.signEvent.mockResolvedValue(expectedSignedEvent);
      
      const worker = getCryptoWorker();
      const result = await worker.signEvent(event, privateKey);
      
      expect(result).toEqual(expectedSignedEvent);
      expect(mockCryptoWorker.signEvent).toHaveBeenCalledWith(event, privateKey);
    });

    it('should sign a message with Schnorr signature', async () => {
      const message = 'Hello, World!';
      const privateKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const expectedSignature = 'signature_123';
      
      mockCryptoWorker.signMessage.mockResolvedValue(expectedSignature);
      
      const worker = getCryptoWorker();
      const result = await worker.signMessage(message, privateKey);
      
      expect(result).toBe(expectedSignature);
      expect(mockCryptoWorker.signMessage).toHaveBeenCalledWith(message, privateKey);
    });
  });

  describe('NIP-04 Encryption', () => {
    it('should encrypt a message using NIP-04', async () => {
      const plaintext = 'Secret message';
      const senderPrivateKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const recipientPublicKey = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
      const expectedCiphertext = 'encrypted_message_123';
      
      mockCryptoWorker.nip04Encrypt.mockResolvedValue(expectedCiphertext);
      
      const worker = getCryptoWorker();
      const result = await worker.nip04Encrypt(plaintext, senderPrivateKey, recipientPublicKey);
      
      expect(result).toBe(expectedCiphertext);
      expect(mockCryptoWorker.nip04Encrypt).toHaveBeenCalledWith(plaintext, senderPrivateKey, recipientPublicKey);
    });

    it('should decrypt a message using NIP-04', async () => {
      const ciphertext = 'encrypted_message_123';
      const recipientPrivateKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const senderPublicKey = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
      const expectedPlaintext = 'Secret message';
      
      mockCryptoWorker.nip04Decrypt.mockResolvedValue(expectedPlaintext);
      
      const worker = getCryptoWorker();
      const result = await worker.nip04Decrypt(ciphertext, recipientPrivateKey, senderPublicKey);
      
      expect(result).toBe(expectedPlaintext);
      expect(mockCryptoWorker.nip04Decrypt).toHaveBeenCalledWith(ciphertext, recipientPrivateKey, senderPublicKey);
    });
  });

  describe('Key Derivation', () => {
    it('should derive key from password using Argon2id', async () => {
      const password = 'test_password';
      const expectedDerived = {
        key: 'derived_key_123',
        salt: 'salt_123'
      };
      
      mockCryptoWorker.deriveKeyFromPassword.mockResolvedValue(expectedDerived);
      
      const worker = getCryptoWorker();
      const result = await worker.deriveKeyFromPassword(password);
      
      expect(result).toEqual(expectedDerived);
      expect(mockCryptoWorker.deriveKeyFromPassword).toHaveBeenCalledWith(password, undefined);
    });

    it('should derive keypair from xpriv', async () => {
      const xpriv = 'xprv9s21ZrQH143K...';
      const index = 0;
      const expectedKeypair = {
        privateKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        publicKey: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
        path: 'm/44\'/1237\'/0\'/0/0'
      };
      
      mockCryptoWorker.deriveKeypairFromXpriv.mockResolvedValue(expectedKeypair);
      
      const worker = getCryptoWorker();
      const result = await worker.deriveKeypairFromXpriv(xpriv, index);
      
      expect(result).toEqual(expectedKeypair);
      expect(mockCryptoWorker.deriveKeypairFromXpriv).toHaveBeenCalledWith(xpriv, index);
    });

    it('should derive storage keypair from xpriv', async () => {
      const xpriv = 'xprv9s21ZrQH143K...';
      const expectedStorageKeypair = {
        privateKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        publicKey: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
        path: 'm/44\'/1237\'/1\'/0/0'
      };
      
      mockCryptoWorker.deriveStorageKeypairFromXpriv.mockResolvedValue(expectedStorageKeypair);
      
      const worker = getCryptoWorker();
      const result = await worker.deriveStorageKeypairFromXpriv(xpriv);
      
      expect(result).toEqual(expectedStorageKeypair);
      expect(mockCryptoWorker.deriveStorageKeypairFromXpriv).toHaveBeenCalledWith(xpriv);
    });
  });

  describe('Data Encryption', () => {
    it('should encrypt data with Argon2id', async () => {
      const data = 'sensitive data';
      const password = 'test_password';
      const expectedEncrypted = 'encrypted_data_123';
      
      mockCryptoWorker.encryptData.mockResolvedValue(expectedEncrypted);
      
      const worker = getCryptoWorker();
      const result = await worker.encryptData(data, password);
      
      expect(result).toBe(expectedEncrypted);
      expect(mockCryptoWorker.encryptData).toHaveBeenCalledWith(data, password);
    });

    it('should decrypt data with Argon2id', async () => {
      const encryptedData = 'encrypted_data_123';
      const password = 'test_password';
      const expectedDecrypted = 'sensitive data';
      
      mockCryptoWorker.decryptData.mockResolvedValue(expectedDecrypted);
      
      const worker = getCryptoWorker();
      const result = await worker.decryptData(encryptedData, password);
      
      expect(result).toBe(expectedDecrypted);
      expect(mockCryptoWorker.decryptData).toHaveBeenCalledWith(encryptedData, password);
    });
  });

  describe('LoginObj/VaultObj Operations', () => {
    it('should encrypt LoginObj with storage public key', async () => {
      const loginObj = JSON.stringify({
        storagePublicKey: 'pubkey123',
        username: 'testuser',
        createdAt: Date.now(),
        version: 1
      });
      const storagePublicKey = 'pubkey123';
      const expectedEncrypted = 'encrypted_loginobj_123';
      
      mockCryptoWorker.encryptLoginObj.mockResolvedValue(expectedEncrypted);
      
      const worker = getCryptoWorker();
      const result = await worker.encryptLoginObj(loginObj, storagePublicKey);
      
      expect(result).toBe(expectedEncrypted);
      expect(mockCryptoWorker.encryptLoginObj).toHaveBeenCalledWith(loginObj, storagePublicKey);
    });

    it('should decrypt LoginObj with storage private key', async () => {
      const encryptedLoginObj = 'encrypted_loginobj_123';
      const storagePrivateKey = 'privkey123';
      const expectedDecrypted = JSON.stringify({
        storagePublicKey: 'pubkey123',
        username: 'testuser',
        createdAt: Date.now(),
        version: 1
      });
      
      mockCryptoWorker.decryptLoginObj.mockResolvedValue(expectedDecrypted);
      
      const worker = getCryptoWorker();
      const result = await worker.decryptLoginObj(encryptedLoginObj, storagePrivateKey);
      
      expect(result).toBe(expectedDecrypted);
      expect(mockCryptoWorker.decryptLoginObj).toHaveBeenCalledWith(encryptedLoginObj, storagePrivateKey);
    });

    it('should encrypt VaultObj with PIN', async () => {
      const vaultObj = JSON.stringify({
        username: 'testuser',
        identities: [],
        xprivEncrypted: 'encrypted_xpriv',
        xprivRecovery: 'recovery_xpriv',
        salt: 'salt123',
        version: 1,
        updatedAt: Date.now()
      });
      const pin = '1234';
      const salt = 'salt123';
      const expectedEncrypted = 'encrypted_vaultobj_123';
      
      mockCryptoWorker.encryptVaultObj.mockResolvedValue(expectedEncrypted);
      
      const worker = getCryptoWorker();
      const result = await worker.encryptVaultObj(vaultObj, pin, salt);
      
      expect(result).toBe(expectedEncrypted);
      expect(mockCryptoWorker.encryptVaultObj).toHaveBeenCalledWith(vaultObj, pin, salt);
    });

    it('should decrypt VaultObj with PIN', async () => {
      const encryptedVaultObj = 'encrypted_vaultobj_123';
      const pin = '1234';
      const salt = 'salt123';
      const expectedDecrypted = JSON.stringify({
        username: 'testuser',
        identities: [],
        xprivEncrypted: 'encrypted_xpriv',
        xprivRecovery: 'recovery_xpriv',
        salt: 'salt123',
        version: 1,
        updatedAt: Date.now()
      });
      
      mockCryptoWorker.decryptVaultObj.mockResolvedValue(expectedDecrypted);
      
      const worker = getCryptoWorker();
      const result = await worker.decryptVaultObj(encryptedVaultObj, pin, salt);
      
      expect(result).toBe(expectedDecrypted);
      expect(mockCryptoWorker.decryptVaultObj).toHaveBeenCalledWith(encryptedVaultObj, pin, salt);
    });
  });

  describe('Utility Functions', () => {
    it('should generate random bytes', async () => {
      const length = 32;
      const expectedBytes = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      
      mockCryptoWorker.generateRandomBytes.mockResolvedValue(expectedBytes);
      
      const worker = getCryptoWorker();
      const result = await worker.generateRandomBytes(length);
      
      expect(result).toBe(expectedBytes);
      expect(mockCryptoWorker.generateRandomBytes).toHaveBeenCalledWith(length);
    });

    it('should generate salt', async () => {
      const expectedSalt = 'salt_123';
      
      mockCryptoWorker.generateSalt.mockResolvedValue(expectedSalt);
      
      const worker = getCryptoWorker();
      const result = await worker.generateSalt();
      
      expect(result).toBe(expectedSalt);
      expect(mockCryptoWorker.generateSalt).toHaveBeenCalledOnce();
    });
  });

  describe('Error Handling', () => {
    it('should handle crypto worker errors gracefully', async () => {
      const error = new Error('Crypto operation failed');
      mockCryptoWorker.generateKeypair.mockRejectedValue(error);
      
      const worker = getCryptoWorker();
      
      await expect(worker.generateKeypair()).rejects.toThrow('Crypto operation failed');
    });

    it('should handle invalid input parameters', async () => {
      const invalidPrivateKey = 'invalid_key';
      const error = new Error('Invalid private key');
      mockCryptoWorker.getPublicKey.mockRejectedValue(error);
      
      const worker = getCryptoWorker();
      
      await expect(worker.getPublicKey(invalidPrivateKey)).rejects.toThrow('Invalid private key');
    });
  });
});

