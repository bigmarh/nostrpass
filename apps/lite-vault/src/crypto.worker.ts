/**
 * Crypto Web Worker for NostrPass Lite Vault
 *
 * The private key lives exclusively in this worker's memory. The main thread
 * (DOM) only sees: encrypted blobs, unsigned events, and operation results.
 * Even in the event of an XSS on the iframe page, injected code on the main
 * thread cannot read the raw private key directly from worker memory.
 */

import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { hexToBytes } from '@noble/hashes/utils';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import { encrypt as nip04Encrypt, decrypt as nip04Decrypt } from 'nostr-tools/nip04';
import * as nip44 from 'nostr-tools/nip44';

// ── Key held exclusively in worker closure ─────────────────────────────────────
let privateKeyHex: string | null = null;

// ── AES-GCM decrypt (mirrors lite-core/src/crypto.ts#decryptString) ──────────
interface EncryptedPayload { salt: string; iv: string; data: string }

function decryptAesGcm(encrypted: string, secret: string): string {
  const { salt, iv, data } = JSON.parse(encrypted) as EncryptedPayload;
  const key = pbkdf2(sha256, new TextEncoder().encode(secret), hexToBytes(salt), {
    c: 100000,
    dkLen: 32,
  });
  const cipher = gcm(key, hexToBytes(iv));
  return new TextDecoder().decode(cipher.decrypt(hexToBytes(data)));
}

// ── Message handler ───────────────────────────────────────────────────────────
type WorkerMsg =
  | { id: string; type: 'LOAD_KEY';        payload: { encryptedKey: string; pin: string } }
  | { id: string; type: 'LOAD_KEY_DIRECT'; payload: { privateKeyHex: string } }
  | { id: string; type: 'EXECUTE';         payload: { operation: string } & Record<string, unknown> }
  | { id: string; type: 'CLEAR_KEY' };

self.onmessage = async (e: MessageEvent<WorkerMsg>) => {
  const { id, type } = e.data;
  try {
    let result: unknown;

    switch (type) {
      case 'LOAD_KEY': {
        const { encryptedKey, pin } = e.data.payload;
        const decrypted = decryptAesGcm(encryptedKey, pin);
        // getPublicKey() already returns a hex string — no bytesToHex needed
        const pubkey = getPublicKey(hexToBytes(decrypted));
        privateKeyHex = decrypted;
        result = { publicKey: pubkey };
        break;
      }

      case 'LOAD_KEY_DIRECT': {
        privateKeyHex = e.data.payload.privateKeyHex;
        result = {};
        break;
      }

      case 'CLEAR_KEY': {
        privateKeyHex = null;
        result = {};
        break;
      }

      case 'EXECUTE': {
        if (!privateKeyHex) throw new Error('No key loaded in worker');
        const p = e.data.payload;
        const op = p.operation;

        switch (op) {
          case 'signEvent': {
            const raw = p.event as Record<string, unknown>;
            if (!raw) throw new Error('Missing event payload');
            const unsigned = {
              kind: Number(raw.kind ?? 1),
              created_at: Number(raw.created_at ?? Math.floor(Date.now() / 1000)),
              tags: (raw.tags as string[][] | undefined) ?? [],
              content: String(raw.content ?? ''),
            };
            result = finalizeEvent(unsigned, hexToBytes(privateKeyHex));
            break;
          }

          case 'nip04.encrypt':
            result = await nip04Encrypt(
              privateKeyHex,
              String(p.pubkey ?? ''),
              String(p.plaintext ?? '')
            );
            break;

          case 'nip04.decrypt':
            result = await nip04Decrypt(
              privateKeyHex,
              String(p.pubkey ?? ''),
              String(p.ciphertext ?? '')
            );
            break;

          case 'nip44.encrypt': {
            const convKey = nip44.v2.utils.getConversationKey(
              hexToBytes(privateKeyHex),
              String(p.pubkey ?? '')
            );
            result = nip44.v2.encrypt(String(p.plaintext ?? ''), convKey);
            break;
          }

          case 'nip44.decrypt': {
            const convKey = nip44.v2.utils.getConversationKey(
              hexToBytes(privateKeyHex),
              String(p.pubkey ?? '')
            );
            result = nip44.v2.decrypt(String(p.ciphertext ?? ''), convKey);
            break;
          }

          default:
            throw new Error(`Unsupported operation in worker: ${op}`);
        }
        break;
      }
    }

    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, result });
  } catch (err) {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
