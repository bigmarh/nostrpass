/**
 * TypeScript-based cryptographic operations using Noble libraries
 * Replaces Rust/WASM implementation with audited, battle-tested JavaScript crypto
 *
 * SECURITY: All cryptographic logging is disabled by default.
 * Set CRYPTO_DEBUG=true in environment for development debugging only.
 * NEVER enable in production - logs could expose salts, IVs, and key material.
 */

import { secp256k1, schnorr } from '@noble/curves/secp256k1.js';
import { HDKey } from '@scure/bip32';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { sha256 } from '@noble/hashes/sha256';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { randomBytes } from '@noble/hashes/utils';
import { hmac } from '@noble/hashes/hmac';
import { base64 } from '@scure/base';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { gcm } from '@noble/ciphers/aes.js';

/**
 * SECURITY: Debug logging control
 * Disabled by default to prevent leaking cryptographic parameters
 * Only enable for local development debugging
 */
const CRYPTO_DEBUG = false; // NEVER set to true in production

/**
 * Safe logging function that only logs in debug mode
 * SECURITY: Prevents accidental logging of sensitive cryptographic material
 */
function cryptoLog(...args: any[]): void {
  if (CRYPTO_DEBUG) {
    console.log(...args);
  }
}

/**
 * Safe warning function that only logs in debug mode
 */
function cryptoWarn(...args: any[]): void {
  if (CRYPTO_DEBUG) {
    console.warn(...args);
  }
}

/**
 * Initialize crypto (no-op for TypeScript, kept for API compatibility)
 */
export function init() {
  // No initialization needed for Noble libraries
  return Promise.resolve();
}

/**
 * NostrCrypto class - API-compatible replacement for WASM NostrCrypto
 */
export class NostrCrypto {
  /**
   * Generate a new keypair
   */
  generateKeypair(): { privateKey: string; publicKey: string } {
    const privateKey = randomBytes(32);
    const publicKey = schnorr.getPublicKey(privateKey);
    
    return {
      privateKey: bytesToHex(privateKey),
      publicKey: bytesToHex(publicKey)
    };
  }

  /**
   * Get public key from private key
   */
  getPublicKey(privateKey: string): string {
    const privKeyBytes = hexToBytes(privateKey);
    const pubKeyBytes = schnorr.getPublicKey(privKeyBytes);
    return bytesToHex(pubKeyBytes);
  }

  /**
   * Sign a Nostr event
   */
  signEvent(event: any, privateKey: string): any {
    // Calculate event ID (Nostr spec: hash of serialized event)
    const eventId = this.calculateEventId(event);
    
    // Sign with Schnorr signature
    const signature = this.signMessage(eventId, privateKey);
    
    return {
      ...event,
      id: eventId,
      sig: signature
    };
  }

  /**
   * Calculate Nostr event ID
   */
  calculateEventId(event: any): string {
    const serialized = JSON.stringify([
      0,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content
    ]);
    
    const hash = sha256(new TextEncoder().encode(serialized));
    return bytesToHex(hash);
  }

  /**
   * Sign a message with Schnorr signature
   * For arbitrary data (signData), the message is plain text and will be hashed
   * For event signing, the message is already a hex event ID
   */
  signMessage(message: string, privateKey: string): string {
    let msgBytes: Uint8Array;
    
    // Check if message is hex (64 chars = 32 bytes for event ID) or plain text
    const isHex = /^[0-9a-f]+$/i.test(message) && message.length % 2 === 0;
    
    if (isHex && message.length === 64) {
      // This is an event ID (already hashed, 32 bytes)
      msgBytes = hexToBytes(message);
    } else {
      // This is arbitrary data - hash it first
      msgBytes = sha256(new TextEncoder().encode(message));
    }
    
    const privKeyBytes = hexToBytes(privateKey);
    
    const signature = schnorr.sign(msgBytes, privKeyBytes);
    return bytesToHex(signature);
  }

  /**
   * Derive key from password using PBKDF2
   */
  deriveKeyFromPassword(password: string, salt?: string): { key: string; salt: string } {
    const saltBytes = salt 
      ? hexToBytes(salt)
      : randomBytes(32);
    
    const iterations = 100000; // OWASP recommended minimum
    const keyLength = 32; // 256 bits
    
    const derivedKey = pbkdf2(sha256, password, saltBytes, {
      c: iterations,
      dkLen: keyLength
    });
    
    return {
      key: bytesToHex(derivedKey),
      salt: bytesToHex(saltBytes)
    };
  }

  /**
   * Encrypt data using AES-256-GCM with Argon2id-derived key
   * Uses Web Crypto API for native performance
   */
  async encryptData(data: string, password: string): Promise<string> {
    cryptoLog('🔐 [Noble.encryptData] Starting encryption, data length:', data.length);

    // Derive key using PBKDF2 (Argon2id not available in browsers, PBKDF2 is acceptable)
    const { key, salt } = this.deriveKeyFromPassword(password);

    // Use Web Crypto API for AES-GCM encryption
    const keyBytes = hexToBytes(key);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    // Generate random IV
    const iv = randomBytes(12); // 96 bits for GCM

    // Encrypt
    const dataBytes = new TextEncoder().encode(data);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      dataBytes
    );

    // Combine: salt (32 bytes) + iv (12 bytes) + ciphertext
    const combined = new Uint8Array(32 + 12 + encrypted.byteLength);
    combined.set(hexToBytes(salt), 0);
    combined.set(iv, 32);
    combined.set(new Uint8Array(encrypted), 44);

    const result = base64.encode(combined);
    cryptoLog('✅ [Noble.encryptData] Encryption complete, output length:', result.length);
    return result;
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  async decryptData(encryptedData: string, password: string): Promise<string> {
    cryptoLog('🔓 [Noble.decryptData] Starting decryption, input length:', encryptedData.length);

    // Decode base64
    const combined = base64.decode(encryptedData);

    // Extract components
    const salt = bytesToHex(combined.slice(0, 32));
    const iv = combined.slice(32, 44);
    const ciphertext = combined.slice(44);

    // Derive key
    const { key } = this.deriveKeyFromPassword(password, salt);

    const keyBytes = hexToBytes(key);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // Decrypt
    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        ciphertext
      );

      const result = new TextDecoder().decode(decrypted);
      cryptoLog('✅ [Noble.decryptData] Decryption successful, output length:', result.length);
      return result;
    } catch (error) {
      // Only log error type, not details that could leak information
      throw new Error('Decryption failed - invalid password or corrupted data');
    }
  }

  /**
   * Generate a new extended private key (xpriv)
   */
  generateXpriv(): string {
    // Generate 24-word mnemonic (256 bits entropy)
    const mnemonic = generateMnemonic(wordlist, 256);

    // Convert to seed
    const seed = mnemonicToSeedSync(mnemonic);

    // Create HDKey from seed
    const hdKey = HDKey.fromMasterSeed(seed);

    return hdKey.privateExtendedKey;
  }

  /**
   * Generate a 12-word recovery phrase (mnemonic)
   * Returns both the mnemonic and derived xpriv
   */
  generateRecoveryPhrase(): { mnemonic: string; xpriv: string } {
    // Generate 12-word mnemonic (128 bits entropy)
    const mnemonic = generateMnemonic(wordlist, 128);

    // Convert to seed
    const seed = mnemonicToSeedSync(mnemonic);

    // Create HDKey from seed
    const hdKey = HDKey.fromMasterSeed(seed);

    return {
      mnemonic,
      xpriv: hdKey.privateExtendedKey
    };
  }

  /**
   * Validate a recovery phrase (mnemonic)
   */
  validateRecoveryPhrase(mnemonic: string): boolean {
    try {
      return validateMnemonic(mnemonic, wordlist);
    } catch {
      return false;
    }
  }

  /**
   * Convert recovery phrase (mnemonic) to xpriv
   */
  recoveryPhraseToXpriv(mnemonic: string): string {
    // Validate mnemonic first
    if (!this.validateRecoveryPhrase(mnemonic)) {
      throw new Error('Invalid recovery phrase');
    }

    // Convert to seed
    const seed = mnemonicToSeedSync(mnemonic);

    // Create HDKey from seed
    const hdKey = HDKey.fromMasterSeed(seed);

    return hdKey.privateExtendedKey;
  }

  /**
   * Derive a keypair from xpriv using BIP44 path
   * Path: m/44'/1237'/0'/0/{index}
   */
  deriveKeypairFromXpriv(xpriv: string, index: number): any {
    const hdKey = HDKey.fromExtendedKey(xpriv);
    
    // Derive child key using BIP44 path for Nostr
    const path = `m/44'/1237'/0'/0/${index}`;
    const derived = hdKey.derive(path);
    
    if (!derived.privateKey) {
      throw new Error('Failed to derive private key');
    }
    
    // Get Schnorr public key (x-only)
    const publicKey = schnorr.getPublicKey(derived.privateKey);
    
    return {
      privateKey: bytesToHex(derived.privateKey),
      publicKey: bytesToHex(publicKey),
      path
    };
  }

  /**
   * Derive storage keypair from xpriv
   * Path: m/44'/1237'/1'/0/0 (account 1 for storage)
   */
  deriveStorageKeypairFromXpriv(xpriv: string): any {
    const hdKey = HDKey.fromExtendedKey(xpriv);
    
    // Storage uses account 1
    const path = `m/44'/1237'/1'/0/0`;
    const derived = hdKey.derive(path);
    
    if (!derived.privateKey) {
      throw new Error('Failed to derive storage private key');
    }
    
    const publicKey = schnorr.getPublicKey(derived.privateKey);
    
    return {
      privateKey: bytesToHex(derived.privateKey),
      publicKey: bytesToHex(publicKey),
      path
    };
  }

  /**
   * Get storage derivation path
   */
  getStoragePath(): string {
    return `m/44'/1237'/1'/0/0`;
  }

  /**
   * Encrypt data with Argon2 (using PBKDF2 fallback for browser compatibility)
   */
  async encryptDataWithArgon2(data: string, password: string): Promise<string> {
    return this.encryptData(data, password);
  }

  /**
   * Decrypt data with Argon2 (using PBKDF2 fallback for browser compatibility)
   */
  async decryptDataWithArgon2(encryptedData: string, password: string): Promise<string> {
    return this.decryptData(encryptedData, password);
  }

  /**
   * Encrypt data with specific salt
   */
  async encryptDataWithSalt(data: string, password: string, salt: string): Promise<string> {
    // Derive key using provided salt
    const { key } = this.deriveKeyFromPassword(password, salt);
    const keyBytes = hexToBytes(key);

    // Generate random IV
    const iv = randomBytes(12);

    // Encrypt
    const dataBytes = new TextEncoder().encode(data);

    // Check if crypto.subtle is available (HTTPS or localhost)
    const hasCryptoSubtle = typeof crypto !== 'undefined' &&
                           typeof crypto.subtle !== 'undefined' &&
                           typeof crypto.subtle.importKey === 'function';

    let encrypted: Uint8Array;

    if (hasCryptoSubtle) {
      // Use native Web Crypto API (fastest)
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );

      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        dataBytes
      );

      encrypted = new Uint8Array(encryptedBuffer);
    } else {
      // Fallback to noble-ciphers for non-secure contexts (HTTP on mobile)
      const aes = gcm(keyBytes, iv);
      encrypted = aes.encrypt(dataBytes);
    }

    // Combine: salt + iv + ciphertext
    const combined = new Uint8Array(32 + 12 + encrypted.byteLength);
    combined.set(hexToBytes(salt), 0);
    combined.set(iv, 32);
    combined.set(encrypted, 44);

    return base64.encode(combined);
  }

  /**
   * Decrypt data with specific salt
   */
  async decryptDataWithSalt(encryptedData: string, password: string, salt: string): Promise<string> {
    // Decode base64
    const combined = base64.decode(encryptedData);

    // Extract components (skip salt verification, use provided salt)
    const iv = combined.slice(32, 44);
    const ciphertext = combined.slice(44);

    // Derive key
    const { key } = this.deriveKeyFromPassword(password, salt);
    const keyBytes = hexToBytes(key);

    // Check if crypto.subtle is available (HTTPS or localhost)
    // On mobile over HTTP, crypto.subtle is undefined, so we fall back to noble-ciphers
    const hasCryptoSubtle = typeof crypto !== 'undefined' &&
                           typeof crypto.subtle !== 'undefined' &&
                           typeof crypto.subtle.importKey === 'function';

    if (hasCryptoSubtle) {
      // Use native Web Crypto API (fastest)
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        ciphertext
      );

      return new TextDecoder().decode(decrypted);
    } else {
      // Fallback to noble-ciphers for non-secure contexts (HTTP on mobile)
      const aes = gcm(keyBytes, iv);
      const decrypted = aes.decrypt(ciphertext);
      return new TextDecoder().decode(decrypted);
    }
  }

  /**
   * Generate random bytes
   */
  generateRandomBytes(length: number): string {
    const bytes = randomBytes(length);
    return bytesToHex(bytes);
  }

  /**
   * Generate secure salt
   */
  generateSalt(): string {
    return this.generateRandomBytes(32);
  }

  /**
   * Zeroize a string (best effort in JavaScript)
   */
  zeroizeString(data: string): void {
    // Note: JavaScript strings are immutable, so we can't truly zeroize
    // This is a no-op for API compatibility
    // Security note: Sensitive data should be cleared at the caller level
  }

  /**
   * Create a new vault with username and PIN
   * Generates xpriv, derives keypair, encrypts with PIN
   */
  async createVault(username: string, pin: string): Promise<{
    username: string;
    publicKey: string;
    privateKey: string;
    xpriv: string;
    derivationPath: string;
    xprivEncrypted: string;
    salt: string;
  }> {
    // Generate xpriv
    const xpriv = this.generateXpriv();

    // Derive the main keypair (index 0)
    const keypair = this.deriveKeypairFromXpriv(xpriv, 0);

    // Encrypt xpriv with PIN
    const encrypted = await this.encryptData(xpriv, pin);

    // Extract salt from encrypted data
    const combined = base64.decode(encrypted);
    const salt = bytesToHex(combined.slice(0, 32));

    return {
      username,
      publicKey: keypair.publicKey,
      privateKey: keypair.privateKey,
      xpriv,
      derivationPath: keypair.path,
      xprivEncrypted: encrypted,
      salt
    };
  }

  /**
   * Create vault from existing keys (for re-encryption)
   */
  async createVaultFromKeys(username: string, privateKey: string, pin: string): Promise<{
    xprivEncrypted: string;
    salt: string;
  }> {
    // For now, we'll just encrypt the private key
    // In a full implementation, you'd want to encrypt the xpriv
    const encrypted = await this.encryptData(privateKey, pin);

    // Extract salt from encrypted data
    const combined = base64.decode(encrypted);
    const salt = bytesToHex(combined.slice(0, 32));

    return {
      xprivEncrypted: encrypted,
      salt
    };
  }

  /**
   * Decrypt vault with PIN
   */
  async decryptVault(encryptedVault: string, pin: string): Promise<{
    xpriv: string;
    privateKey: string;
    publicKey: string;
  }> {
    // Decrypt the xpriv
    const xpriv = await this.decryptData(encryptedVault, pin);

    // Derive the main keypair (index 0) from xpriv
    const keypair = this.deriveKeypairFromXpriv(xpriv, 0);

    return {
      xpriv,
      privateKey: keypair.privateKey,
      publicKey: keypair.publicKey
    };
  }

  /**
   * NIP-04 encryption
   * Encrypts plaintext using sender's private key and recipient's public key
   */
  async nip04Encrypt(plaintext: string, senderPrivateKey: string, recipientPublicKey: string): Promise<string> {
    try {
      // Import nostr-tools nip04
      const nip04Module = await import('nostr-tools/nip04');
      return await nip04Module.encrypt(senderPrivateKey, recipientPublicKey, plaintext);
    } catch (error) {
      // SECURITY: Don't log error details that could leak key information
      cryptoLog('NIP-04 encryption failed');
      throw new Error('NIP-04 encryption failed');
    }
  }

  /**
   * NIP-04 decryption
   * Decrypts ciphertext using recipient's private key and sender's public key
   */
  async nip04Decrypt(ciphertext: string, recipientPrivateKey: string, senderPublicKey: string): Promise<string> {
    try {
      // Import nostr-tools nip04
      const nip04Module = await import('nostr-tools/nip04');
      return await nip04Module.decrypt(recipientPrivateKey, senderPublicKey, ciphertext);
    } catch (error) {
      // SECURITY: Don't log error details that could leak key information
      cryptoLog('NIP-04 decryption failed');
      throw new Error('NIP-04 decryption failed');
    }
  }

  /**
   * NIP-44 encryption
   * Encrypts plaintext using sender's private key and recipient's public key
   * NIP-44 is the improved encryption standard, replacing NIP-04
   */
  async nip44Encrypt(plaintext: string, senderPrivateKey: string, recipientPublicKey: string): Promise<string> {
    try {
      // Import nostr-tools nip44
      const nip44Module = await import('nostr-tools/nip44');

      // Derive conversation key from sender's private key and recipient's public key
      const conversationKey = nip44Module.getConversationKey(senderPrivateKey, recipientPublicKey);

      // Encrypt with the conversation key
      return nip44Module.encrypt(plaintext, conversationKey);
    } catch (error) {
      // SECURITY: Don't log error details that could leak key information
      cryptoLog('NIP-44 encryption failed');
      throw new Error('NIP-44 encryption failed');
    }
  }

  /**
   * NIP-44 decryption
   * Decrypts ciphertext using recipient's private key and sender's public key
   * NIP-44 is the improved encryption standard, replacing NIP-04
   */
  async nip44Decrypt(ciphertext: string, recipientPrivateKey: string, senderPublicKey: string): Promise<string> {
    try {
      // Import nostr-tools nip44
      const nip44Module = await import('nostr-tools/nip44');

      // Derive conversation key from recipient's private key and sender's public key
      const conversationKey = nip44Module.getConversationKey(recipientPrivateKey, senderPublicKey);

      // Decrypt with the conversation key
      return nip44Module.decrypt(ciphertext, conversationKey);
    } catch (error) {
      // SECURITY: Don't log error details that could leak key information
      cryptoLog('NIP-44 decryption failed');
      throw new Error('NIP-44 decryption failed');
    }
  }

  /**
   * BYOK (Bring Your Own Key) helpers
   */

  /**
   * Validate and decode an nsec (bech32-encoded private key)
   * Returns the hex-encoded private key if valid
   * @throws Error if nsec is invalid
   */
  async validateAndDecodeNsec(nsec: string): Promise<{ privateKey: string; publicKey: string }> {
    try {
      const nip19Module = await import('nostr-tools/nip19');

      // Validate format
      if (!nsec.startsWith('nsec1')) {
        throw new Error('Invalid nsec format - must start with nsec1');
      }

      // Decode nsec to get private key bytes
      const decoded = nip19Module.decode(nsec);

      if (decoded.type !== 'nsec') {
        throw new Error('Invalid nsec format');
      }

      // Convert Uint8Array to hex string
      const privateKey = bytesToHex(decoded.data as Uint8Array);

      // Derive public key from private key
      const publicKey = this.getPublicKey(privateKey);

      return { privateKey, publicKey };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid nsec')) {
        throw error;
      }
      throw new Error('Invalid nsec - could not decode');
    }
  }

  /**
   * Encrypt an nsec for BYOK storage
   * Uses the same salt as xpriv for consistency
   */
  async encryptNsecForBYOK(nsec: string, pin: string, salt: string): Promise<string> {
    // Validate nsec first
    await this.validateAndDecodeNsec(nsec);

    // Encrypt using same salt as xpriv
    return this.encryptDataWithSalt(nsec, pin, salt);
  }

  /**
   * Decrypt an nsec from BYOK storage
   * Returns the hex private key (not nsec format)
   */
  async decryptNsecFromBYOK(encryptedNsec: string, pin: string, salt: string): Promise<string> {
    // Decrypt to get nsec
    const nsec = await this.decryptDataWithSalt(encryptedNsec, pin, salt);

    // Decode nsec to get hex private key
    const { privateKey } = await this.validateAndDecodeNsec(nsec);

    return privateKey;
  }
}

// Export singleton instance
export default NostrCrypto;
