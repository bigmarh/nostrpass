import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { randomBytes, bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import { decode as nip19Decode } from 'nostr-tools/nip19';
import { getPublicKey } from 'nostr-tools/pure';

interface EncryptedPayload {
  salt: string;
  iv: string;
  data: string;
}

export function deriveSecretKey(secret: string, saltHex?: string): { key: Uint8Array; saltHex: string } {
  const salt = saltHex ? hexToBytes(saltHex) : randomBytes(16);
  const key = pbkdf2(sha256, new TextEncoder().encode(secret), salt, {
    c: 100000,
    dkLen: 32,
  });

  return { key, saltHex: bytesToHex(salt) };
}

export function encryptString(data: string, secret: string, saltHex?: string): string {
  const { key, saltHex: resolvedSalt } = deriveSecretKey(secret, saltHex);
  const iv = randomBytes(12);
  const cipher = gcm(key, iv);
  const ciphertext = cipher.encrypt(new TextEncoder().encode(data));

  const payload: EncryptedPayload = {
    salt: resolvedSalt,
    iv: bytesToHex(iv),
    data: bytesToHex(ciphertext),
  };

  return JSON.stringify(payload);
}

export function decryptString(encrypted: string, secret: string): string {
  const payload = JSON.parse(encrypted) as EncryptedPayload;
  const { key } = deriveSecretKey(secret, payload.salt);
  const cipher = gcm(key, hexToBytes(payload.iv));
  const plaintext = cipher.decrypt(hexToBytes(payload.data));
  return new TextDecoder().decode(plaintext);
}

export function normalizePrivateKey(input: { format: 'nsec' | 'hex'; value: string }): string {
  if (input.format === 'hex') {
    const value = input.value.trim().replace(/^0x/i, '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(value)) {
      throw new Error('Invalid hex private key. Expected 64 hex characters.');
    }
    assertPrivateKeyWorks(value);
    return value;
  }

  const decoded = nip19Decode(input.value.trim());
  if (decoded.type !== 'nsec') {
    throw new Error('Invalid nsec value.');
  }

  const hex = bytesToHex(decoded.data as Uint8Array);
  assertPrivateKeyWorks(hex);
  return hex;
}

export function derivePublicKey(privateKeyHex: string): string {
  return getPublicKey(hexToBytes(privateKeyHex));
}

function assertPrivateKeyWorks(privateKeyHex: string): void {
  derivePublicKey(privateKeyHex);
}
