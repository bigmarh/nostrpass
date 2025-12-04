/**
 * Crypto Primitives Layer
 *
 * This module provides stateless cryptographic operations that don't depend on
 * session management or vault operations. These are the core building blocks
 * used by higher-level session-aware handlers.
 *
 * Key characteristics:
 * - Stateless: All operations require explicit key material
 * - No session management: Doesn't access activeSessions or vault data
 * - Pure crypto: Only cryptographic primitives and derivations
 * - Reusable: Can be used independently of the worker context
 */

import { NostrCrypto } from './crypto.noble';
import { encrypt as nip04EncryptJS, decrypt as nip04DecryptJS } from 'nostr-tools/nip04';

// Crypto instance state
let cryptoReady = false;
let cryptoInstance: NostrCrypto | null = null;

/**
 * Ensures the crypto instance is initialized and ready
 */
async function ensureCryptoReady(): Promise<NostrCrypto> {
  if (!cryptoReady) {
    cryptoInstance = new NostrCrypto();
    cryptoReady = true;
  }
  if (!cryptoInstance) {
    throw new Error('Crypto instance not initialized');
  }
  return cryptoInstance;
}

// Type definitions for crypto primitive operations
export interface GenerateKeypairParams {}
export interface GenerateKeypairResult {
  privateKey: string;
  publicKey: string;
}

export interface SignEventParams {
  event: any;
  privateKey: string;
}
export interface SignEventResult {
  event: any;
}

export interface SignMessageParams {
  message: string;
  privateKey: string;
}
export interface SignMessageResult {
  signature: string;
}

export interface EncryptParams {
  plaintext: string;
  privateKey: string;
  recipientPubkey: string;
}

export interface DecryptParams {
  ciphertext: string;
  privateKey: string;
  senderPubkey: string;
}

export interface DeriveKeyParams {
  password: string;
  salt?: string;
}
export interface DeriveKeyResult {
  key: string;
  salt: string;
}

export interface EncryptDataParams {
  data: string;
  password?: string;
  key?: string;
}

export interface DecryptDataParams {
  encryptedData: string;
  password?: string;
  key?: string;
}

/**
 * Crypto Primitives - Stateless cryptographic operations
 *
 * These handlers operate on raw key material and don't access sessions or vault data.
 * They are the foundation for higher-level session-aware operations.
 */
export const cryptoPrimitives = {
  /**
   * Generate a new extended private key (xpriv) using BIP32
   */
  generateXpriv: async (): Promise<{ xpriv: string }> => {
    const crypto = await ensureCryptoReady();
    const xpriv = crypto.generateXpriv();
    return { xpriv };
  },

  /**
   * Generate a random keypair
   */
  generateKeypair: async (_params: GenerateKeypairParams): Promise<GenerateKeypairResult> => {
    const crypto = await ensureCryptoReady();
    return crypto.generateKeypair();
  },

  /**
   * Sign a Nostr event with a private key
   */
  signEvent: async (params: SignEventParams): Promise<SignEventResult> => {
    const crypto = await ensureCryptoReady();
    const signedEvent = crypto.signEvent(params.event, params.privateKey);
    return { event: signedEvent };
  },

  /**
   * Sign an arbitrary message with a private key
   */
  signMessage: async (params: SignMessageParams): Promise<SignMessageResult> => {
    const crypto = await ensureCryptoReady();
    return { signature: crypto.signMessage(params.message, params.privateKey) };
  },

  /**
   * Calculate the ID for a Nostr event
   */
  calculateEventId: async (params: { event: any }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.calculateEventId(params.event);
  },

  /**
   * Derive public key from private key
   */
  getPublicKey: async (params: { privateKey: string }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.getPublicKey(params.privateKey);
  },

  /**
   * Encrypt plaintext using NIP-04
   */
  encrypt: async (params: EncryptParams): Promise<string> => {
    await ensureCryptoReady();
    return nip04EncryptJS(
      params.privateKey,
      params.recipientPubkey,
      params.plaintext
    );
  },

  /**
   * Decrypt ciphertext using NIP-04
   */
  decrypt: async (params: DecryptParams): Promise<string> => {
    await ensureCryptoReady();
    return nip04DecryptJS(
      params.privateKey,
      params.senderPubkey,
      params.ciphertext
    );
  },

  /**
   * Derive a key from password and salt using Argon2id
   */
  deriveKey: async (params: DeriveKeyParams): Promise<DeriveKeyResult> => {
    const crypto = await ensureCryptoReady();
    const result = crypto.deriveKeyFromPassword(params.password, params.salt);

    // Handle if result is a Map (from serde_wasm_bindgen)
    if (result instanceof Map) {
      const derived = {
        key: result.get('key'),
        salt: result.get('salt'),
      };
      return derived;
    }

    return result;
  },

  /**
   * Encrypt data using Argon2id-based encryption
   */
  encryptData: async (params: EncryptDataParams): Promise<string> => {
    const crypto = await ensureCryptoReady();

    // Use key directly if provided, otherwise use password
    const encryptionKey = params.key || params.password;
    if (!encryptionKey) {
      throw new Error('Either key or password must be provided');
    }

    // Use Argon2id-based encryption for better security
    return crypto.encryptDataWithArgon2(params.data, encryptionKey);
  },

  /**
   * Decrypt data using Argon2id-based decryption
   */
  decryptData: async (params: DecryptDataParams): Promise<string> => {
    const crypto = await ensureCryptoReady();

    // Use key directly if provided, otherwise use password
    const decryptionKey = params.key || params.password;
    if (!decryptionKey) {
      throw new Error('Either key or password must be provided');
    }

    // Use Argon2id-based decryption for better security
    return crypto.decryptDataWithArgon2(params.encryptedData, decryptionKey);
  },

  /**
   * Derive a keypair from xpriv at a specific index using BIP32
   */
  deriveKeypairFromXpriv: async (params: { xpriv: string; index: number }): Promise<any> => {
    const crypto = await ensureCryptoReady();
    const result = crypto.deriveKeypairFromXpriv(params.xpriv, params.index);

    // Handle if result is a Map (from serde_wasm_bindgen)
    if (result instanceof Map) {
      return {
        privateKey: result.get('privateKey'),
        publicKey: result.get('publicKey'),
        path: result.get('path')
      };
    }

    return result;
  },

  /**
   * Encrypt data with a specific salt (for PIN-based encryption)
   */
  encryptDataWithSalt: async (params: { data: string; password: string; salt: string }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.encryptDataWithSalt(params.data, params.password, params.salt);
  },

  /**
   * Decrypt data with a specific salt (for PIN-based decryption)
   */
  decryptDataWithSalt: async (params: { encryptedData: string; password: string; salt: string }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.decryptDataWithSalt(params.encryptedData, params.password, params.salt);
  },

  /**
   * Generate secure random bytes of specified length
   */
  generateRandomBytes: async (params: { length: number }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.generateRandomBytes(params.length);
  },

  /**
   * Generate a secure random salt
   */
  generateSalt: async (): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.generateSalt();
  },

  /**
   * Derive storage keypair from xpriv for vault data encryption
   * Uses a deterministic derivation path for storage operations
   */
  deriveStorageKeypairFromXpriv: async (params: { xpriv: string }): Promise<any> => {
    const crypto = await ensureCryptoReady();
    const result = crypto.deriveStorageKeypairFromXpriv(params.xpriv);

    // Handle if result is a Map (from serde_wasm_bindgen)
    if (result instanceof Map) {
      return {
        privateKey: result.get('privateKey'),
        publicKey: result.get('publicKey'),
        path: result.get('path')
      };
    }

    return result;
  },

  /**
   * Get the derivation path used for storage keypair
   */
  getStoragePath: async (): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.getStoragePath();
  },

  /**
   * Encrypt LoginObj with storage public key
   */
  encryptLoginObj: async (params: { loginObj: string; storagePublicKey: string }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.encryptLoginObj(params.loginObj, params.storagePublicKey);
  },

  /**
   * Decrypt LoginObj with storage private key
   */
  decryptLoginObj: async (params: { encryptedLoginObj: string; storagePrivateKey: string }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.decryptLoginObj(params.encryptedLoginObj, params.storagePrivateKey);
  },

  /**
   * Encrypt VaultObj with PIN
   */
  encryptVaultObj: async (params: { vaultObj: string; pin: string; salt: string }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.encryptVaultObj(params.vaultObj, params.pin, params.salt);
  },

  /**
   * Decrypt VaultObj with PIN
   */
  decryptVaultObj: async (params: { encryptedVaultObj: string; pin: string; salt: string }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.decryptVaultObj(params.encryptedVaultObj, params.pin, params.salt);
  },

  /**
   * Mine proof-of-work for a Nostr event using NIP-13
   */
  minePow: async (params: { event: any; difficulty: number }): Promise<any> => {
    await ensureCryptoReady();
    console.log(`⛏️ [Crypto Primitives] Mining PoW with difficulty ${params.difficulty}...`);
    const startTime = Date.now();

    try {
      const { minePow } = await import('nostr-tools/nip13');
      const minedEvent = minePow(params.event, params.difficulty);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ [Crypto Primitives] PoW mined in ${duration}s! Event ID: ${minedEvent.id}`);
      return minedEvent;
    } catch (error) {
      console.error('❌ [Crypto Primitives] PoW mining failed:', error);
      throw error;
    }
  },

  // ========================================
  // BYOK (Bring Your Own Key) Operations
  // ========================================

  /**
   * Validate and decode an nsec (bech32-encoded private key)
   * Returns the hex private key and derived public key
   */
  validateAndDecodeNsec: async (params: { nsec: string }): Promise<{ privateKey: string; publicKey: string }> => {
    const crypto = await ensureCryptoReady();
    return crypto.validateAndDecodeNsec(params.nsec);
  },

  /**
   * Encrypt an nsec for BYOK storage
   * Uses the same salt as xpriv for consistency
   */
  encryptNsecForBYOK: async (params: { nsec: string; pin: string; salt: string }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.encryptNsecForBYOK(params.nsec, params.pin, params.salt);
  },

  /**
   * Decrypt an nsec from BYOK storage
   * Returns the hex private key (not nsec format)
   */
  decryptNsecFromBYOK: async (params: { encryptedNsec: string; pin: string; salt: string }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.decryptNsecFromBYOK(params.encryptedNsec, params.pin, params.salt);
  },
};

// Export the ensureCryptoReady function for use by other modules if needed
export { ensureCryptoReady };
