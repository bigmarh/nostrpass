/**
 * Secure Key Storage
 *
 * Provides secure storage for cryptographic keys in worker memory.
 *
 * Security properties:
 * 1. Keys stored as Uint8Array instead of strings (can be overwritten)
 * 2. Memory wiping using crypto.getRandomValues() for secure clearing
 * 3. Automatic clearing on destroy
 * 4. No string interning issues
 *
 * Note: While JavaScript doesn't provide true memory protection,
 * this implementation provides best-effort security by:
 * - Avoiding immutable strings that can't be cleared
 * - Using cryptographically random data to overwrite sensitive bytes
 * - Providing explicit clear() methods that actually modify memory
 */

import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

/**
 * Secure container for a single key
 * Stores key as Uint8Array and provides secure wiping
 */
export class SecureKey {
  private data: Uint8Array | null = null;
  private isCleared = false;

  constructor(keyHex?: string) {
    if (keyHex) {
      this.set(keyHex);
    }
  }

  /**
   * Set key from hex string
   * Converts to Uint8Array for secure storage
   */
  set(keyHex: string): void {
    // Clear any existing data first
    this.clear();

    // Convert hex to bytes
    this.data = hexToBytes(keyHex);
    this.isCleared = false;
  }

  /**
   * Set key from Uint8Array directly
   * Makes a copy to ensure ownership
   */
  setBytes(bytes: Uint8Array): void {
    this.clear();
    this.data = new Uint8Array(bytes);
    this.isCleared = false;
  }

  /**
   * Get key as hex string
   * Returns null if cleared or not set
   */
  getHex(): string | null {
    if (this.isCleared || !this.data) {
      return null;
    }
    return bytesToHex(this.data);
  }

  /**
   * Get key as Uint8Array
   * Returns a COPY to prevent external modification
   */
  getBytes(): Uint8Array | null {
    if (this.isCleared || !this.data) {
      return null;
    }
    return new Uint8Array(this.data);
  }

  /**
   * Check if key is set and not cleared
   */
  isSet(): boolean {
    return !this.isCleared && this.data !== null;
  }

  /**
   * Securely clear the key from memory
   * Overwrites with random data before nullifying
   */
  clear(): void {
    if (this.data && !this.isCleared) {
      // Overwrite with random data to prevent memory inspection
      crypto.getRandomValues(this.data);
      // Overwrite again with zeros for good measure
      this.data.fill(0);
      // Overwrite with random data one more time
      crypto.getRandomValues(this.data);
    }
    this.data = null;
    this.isCleared = true;
  }
}

/**
 * Secure storage for extended private key (xpriv)
 * xpriv is a base58-encoded string, so we store as UTF-8 bytes
 */
export class SecureXpriv {
  private data: Uint8Array | null = null;
  private isCleared = false;

  constructor(xpriv?: string) {
    if (xpriv) {
      this.set(xpriv);
    }
  }

  /**
   * Set xpriv from string
   */
  set(xpriv: string): void {
    this.clear();
    // Encode string as UTF-8 bytes
    this.data = new TextEncoder().encode(xpriv);
    this.isCleared = false;
  }

  /**
   * Get xpriv as string
   */
  get(): string | null {
    if (this.isCleared || !this.data) {
      return null;
    }
    return new TextDecoder().decode(this.data);
  }

  /**
   * Check if xpriv is set
   */
  isSet(): boolean {
    return !this.isCleared && this.data !== null;
  }

  /**
   * Securely clear xpriv from memory
   */
  clear(): void {
    if (this.data && !this.isCleared) {
      crypto.getRandomValues(this.data);
      this.data.fill(0);
      crypto.getRandomValues(this.data);
    }
    this.data = null;
    this.isCleared = true;
  }
}

/**
 * Secure key storage container for a complete session
 * Manages xpriv, privateKey, and storagePrivateKey
 */
export class SecureKeyStorage {
  private xpriv: SecureXpriv = new SecureXpriv();
  private privateKey: SecureKey = new SecureKey();
  private storagePrivateKey: SecureKey = new SecureKey();

  /**
   * Set all keys at once (typical during unlock)
   */
  setKeys(keys: {
    xpriv?: string;
    privateKey?: string;
    storagePrivateKey?: string;
  }): void {
    if (keys.xpriv) {
      this.xpriv.set(keys.xpriv);
    }
    if (keys.privateKey) {
      this.privateKey.set(keys.privateKey);
    }
    if (keys.storagePrivateKey) {
      this.storagePrivateKey.set(keys.storagePrivateKey);
    }
  }

  /**
   * Get xpriv
   */
  getXpriv(): string | null {
    return this.xpriv.get();
  }

  /**
   * Set xpriv
   */
  setXpriv(value: string): void {
    this.xpriv.set(value);
  }

  /**
   * Get private key (hex)
   */
  getPrivateKey(): string | null {
    return this.privateKey.getHex();
  }

  /**
   * Set private key (hex)
   */
  setPrivateKey(value: string): void {
    this.privateKey.set(value);
  }

  /**
   * Get storage private key (hex)
   */
  getStoragePrivateKey(): string | null {
    return this.storagePrivateKey.getHex();
  }

  /**
   * Set storage private key (hex)
   */
  setStoragePrivateKey(value: string): void {
    this.storagePrivateKey.set(value);
  }

  /**
   * Check if any keys are set
   */
  hasKeys(): boolean {
    return this.xpriv.isSet() || this.privateKey.isSet() || this.storagePrivateKey.isSet();
  }

  /**
   * Check individual key status
   */
  keyStatus(): { xpriv: boolean; privateKey: boolean; storagePrivateKey: boolean } {
    return {
      xpriv: this.xpriv.isSet(),
      privateKey: this.privateKey.isSet(),
      storagePrivateKey: this.storagePrivateKey.isSet()
    };
  }

  /**
   * Securely clear all keys
   * This should be called on lock/logout
   */
  clearAll(): void {
    console.log('[SecureKeyStorage] Clearing all keys from memory');
    this.xpriv.clear();
    this.privateKey.clear();
    this.storagePrivateKey.clear();
  }
}

/**
 * Securely wipe a string by creating and clearing a temporary Uint8Array
 * Note: This doesn't truly clear the original string (strings are immutable),
 * but can help clear any temporary copies in memory.
 *
 * Best practice: Don't use strings for sensitive data in the first place.
 * Use SecureKey or SecureXpriv instead.
 */
export function secureWipeString(str: string): void {
  // Create a Uint8Array from the string and wipe it
  // This won't clear the original string, but can help with copies
  const bytes = new TextEncoder().encode(str);
  crypto.getRandomValues(bytes);
  bytes.fill(0);
}

/**
 * Securely wipe a Uint8Array
 */
export function secureWipeBytes(bytes: Uint8Array): void {
  crypto.getRandomValues(bytes);
  bytes.fill(0);
  crypto.getRandomValues(bytes);
}
