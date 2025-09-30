/**
 * TypeScript-based cryptographic operations using Noble libraries
 * Replaces Rust/WASM implementation with audited, battle-tested JavaScript crypto
 */

import { secp256k1, schnorr } from '@noble/curves/secp256k1.js';
import { HDKey } from '@scure/bip32';
import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { sha256 } from '@noble/hashes/sha256';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { randomBytes } from '@noble/hashes/utils';
import { hmac } from '@noble/hashes/hmac';
import { base64 } from '@scure/base';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

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
    console.log('🔐 [Noble.encryptData] Starting encryption...');
    console.log('🔐 [Noble.encryptData] Data length:', data.length);
    console.log('🔐 [Noble.encryptData] Password length:', password.length);
    
    // Derive key using PBKDF2 (Argon2id not available in browsers, PBKDF2 is acceptable)
    const { key, salt } = this.deriveKeyFromPassword(password);
    console.log('🔑 [Noble.encryptData] Key derived. Salt:', salt.substring(0, 20) + '...');
    
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
    console.log('🎲 [Noble.encryptData] IV generated:', bytesToHex(iv));
    
    // Encrypt
    const dataBytes = new TextEncoder().encode(data);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      dataBytes
    );
    console.log('✅ [Noble.encryptData] Encryption successful. Ciphertext length:', encrypted.byteLength);
    
    // Combine: salt (32 bytes) + iv (12 bytes) + ciphertext
    const combined = new Uint8Array(32 + 12 + encrypted.byteLength);
    combined.set(hexToBytes(salt), 0);
    combined.set(iv, 32);
    combined.set(new Uint8Array(encrypted), 44);
    
    const result = base64.encode(combined);
    console.log('✅ [Noble.encryptData] Combined and encoded. Final length:', result.length);
    return result;
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  async decryptData(encryptedData: string, password: string): Promise<string> {
    console.log('🔓 [Noble.decryptData] Starting decryption...');
    console.log('🔓 [Noble.decryptData] Encrypted data length:', encryptedData.length);
    console.log('🔓 [Noble.decryptData] Password length:', password.length);
    
    // Decode base64
    const combined = base64.decode(encryptedData);
    console.log('🔓 [Noble.decryptData] Decoded length:', combined.length);
    
    // Extract components
    const salt = bytesToHex(combined.slice(0, 32));
    const iv = combined.slice(32, 44);
    const ciphertext = combined.slice(44);
    console.log('🔓 [Noble.decryptData] Extracted - Salt:', salt.substring(0, 20) + '...', 'IV:', bytesToHex(iv), 'Ciphertext length:', ciphertext.length);
    
    // Derive key
    console.log('🔑 [Noble.decryptData] Deriving key with extracted salt...');
    const { key } = this.deriveKeyFromPassword(password, salt);
    console.log('🔑 [Noble.decryptData] Key derived successfully');
    
    const keyBytes = hexToBytes(key);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    // Decrypt
    console.log('🔓 [Noble.decryptData] Attempting Web Crypto decryption...');
    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        ciphertext
      );
      console.log('✅ [Noble.decryptData] Decryption successful! Plaintext length:', decrypted.byteLength);
      
      const result = new TextDecoder().decode(decrypted);
      console.log('✅ [Noble.decryptData] Decoded to string. Result length:', result.length);
      return result;
    } catch (error) {
      console.error('❌ [Noble.decryptData] Web Crypto decryption failed:', error);
      throw error;
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
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    // Generate random IV
    const iv = randomBytes(12);
    
    // Encrypt
    const dataBytes = new TextEncoder().encode(data);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      dataBytes
    );
    
    // Combine: salt + iv + ciphertext
    const combined = new Uint8Array(32 + 12 + encrypted.byteLength);
    combined.set(hexToBytes(salt), 0);
    combined.set(iv, 32);
    combined.set(new Uint8Array(encrypted), 44);
    
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
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertext
    );
    
    return new TextDecoder().decode(decrypted);
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
   * NIP-04 encryption (handled by nostr-tools in handlers)
   */
  nip04Encrypt(plaintext: string, senderPrivateKey: string, recipientPublicKey: string): string {
    throw new Error('NIP-04 encryption should be handled by nostr-tools in handlers');
  }

  /**
   * NIP-04 decryption (handled by nostr-tools in handlers)
   */
  nip04Decrypt(ciphertext: string, recipientPrivateKey: string, senderPublicKey: string): string {
    throw new Error('NIP-04 decryption should be handled by nostr-tools in handlers');
  }
}

// Export singleton instance
export default NostrCrypto;
