/**
 * Crypto operations for Chrome Extension
 *
 * Uses @noble/* libraries for all cryptographic operations.
 * This is a simplified version of vault's crypto-primitives.ts
 */

import { secp256k1, schnorr } from '@noble/curves/secp256k1.js';
import { HDKey } from '@scure/bip32';
import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { sha256 } from '@noble/hashes/sha256';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { randomBytes, bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { gcm } from '@noble/ciphers/aes.js';
import { encrypt as nip04Encrypt, decrypt as nip04Decrypt } from 'nostr-tools/nip04';
import * as nip44 from 'nostr-tools/nip44';

// Types
export interface DerivedKeypair {
  privateKey: string;
  publicKey: string;
  path: string;
}

export interface SignedEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/**
 * Generate a new mnemonic and derive xpriv
 */
export function generateXpriv(): string {
  const mnemonic = generateMnemonic(wordlist, 256);
  const seed = mnemonicToSeedSync(mnemonic);
  const hdKey = HDKey.fromMasterSeed(seed);
  return hdKey.privateExtendedKey;
}

/**
 * Derive keypair from xpriv at a specific index
 * Uses Nostr's derivation path: m/44'/1237'/<index>'/0/0
 */
export function deriveKeypairFromXpriv(
  xpriv: string,
  index: number
): DerivedKeypair {
  const hdKey = HDKey.fromExtendedKey(xpriv);
  const path = `m/44'/1237'/${index}'/0/0`;
  const derived = hdKey.derive(path);

  if (!derived.privateKey) {
    throw new Error('Failed to derive private key');
  }

  const publicKey = schnorr.getPublicKey(derived.privateKey);

  return {
    privateKey: bytesToHex(derived.privateKey),
    publicKey: bytesToHex(publicKey),
    path,
  };
}

/**
 * Get public key from private key
 */
export function getPublicKey(privateKey: string): string {
  const privKeyBytes = hexToBytes(privateKey);
  const pubKeyBytes = schnorr.getPublicKey(privKeyBytes);
  return bytesToHex(pubKeyBytes);
}

/**
 * Calculate Nostr event ID
 */
export function calculateEventId(event: {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}): string {
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);

  const hash = sha256(new TextEncoder().encode(serialized));
  return bytesToHex(hash);
}

/**
 * Sign a Nostr event
 */
export function signEvent(
  event: {
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
    pubkey?: string;
  },
  privateKey: string
): SignedEvent {
  const pubkey = event.pubkey || getPublicKey(privateKey);

  const eventWithPubkey = {
    ...event,
    pubkey,
  };

  const eventId = calculateEventId(eventWithPubkey);
  const msgBytes = hexToBytes(eventId);
  const privKeyBytes = hexToBytes(privateKey);
  const signature = schnorr.sign(msgBytes, privKeyBytes);

  return {
    ...eventWithPubkey,
    id: eventId,
    sig: bytesToHex(signature),
  };
}

/**
 * Sign arbitrary data (returns Schnorr signature of sha256 hash)
 */
export function signData(message: string, privateKey: string): string {
  const msgHash = sha256(new TextEncoder().encode(message));
  const privKeyBytes = hexToBytes(privateKey);
  const signature = schnorr.sign(msgHash, privKeyBytes);
  return bytesToHex(signature);
}

/**
 * Derive encryption key from password using PBKDF2
 */
export function deriveKey(
  password: string,
  salt?: string
): { key: Uint8Array; salt: string } {
  const saltBytes = salt ? hexToBytes(salt) : randomBytes(32);
  const iterations = 100000;
  const keyLength = 32;

  const key = pbkdf2(sha256, password, saltBytes, {
    c: iterations,
    dkLen: keyLength,
  });

  return {
    key,
    salt: bytesToHex(saltBytes),
  };
}

/**
 * Encrypt data with password
 */
export function encryptData(data: string, password: string): string {
  const { key, salt } = deriveKey(password);
  const iv = randomBytes(12);
  const plaintext = new TextEncoder().encode(data);

  const cipher = gcm(key, iv);
  const ciphertext = cipher.encrypt(plaintext);

  // Format: salt (64 hex) + iv (24 hex) + ciphertext (base64)
  const result = {
    salt,
    iv: bytesToHex(iv),
    data: Buffer.from(ciphertext).toString('base64'),
  };

  return JSON.stringify(result);
}

/**
 * Decrypt data with password
 */
export function decryptData(encryptedData: string, password: string): string {
  const { salt, iv, data } = JSON.parse(encryptedData);

  const { key } = deriveKey(password, salt);
  const ivBytes = hexToBytes(iv);
  const ciphertext = Uint8Array.from(Buffer.from(data, 'base64'));

  const cipher = gcm(key, ivBytes);
  const plaintext = cipher.decrypt(ciphertext);

  return new TextDecoder().decode(plaintext);
}

/**
 * NIP-04 encryption
 */
export async function nip04EncryptMessage(
  plaintext: string,
  privateKey: string,
  recipientPubkey: string
): Promise<string> {
  return nip04Encrypt(privateKey, recipientPubkey, plaintext);
}

/**
 * NIP-04 decryption
 */
export async function nip04DecryptMessage(
  ciphertext: string,
  privateKey: string,
  senderPubkey: string
): Promise<string> {
  return nip04Decrypt(privateKey, senderPubkey, ciphertext);
}

/**
 * NIP-44 encryption
 */
export function nip44EncryptMessage(
  plaintext: string,
  privateKey: string,
  recipientPubkey: string
): string {
  const conversationKey = nip44.v2.utils.getConversationKey(
    hexToBytes(privateKey),
    recipientPubkey
  );
  return nip44.v2.encrypt(plaintext, conversationKey);
}

/**
 * NIP-44 decryption
 */
export function nip44DecryptMessage(
  ciphertext: string,
  privateKey: string,
  senderPubkey: string
): string {
  const conversationKey = nip44.v2.utils.getConversationKey(
    hexToBytes(privateKey),
    senderPubkey
  );
  return nip44.v2.decrypt(ciphertext, conversationKey);
}
