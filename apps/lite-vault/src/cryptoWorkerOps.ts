import type { LitePermissionOperation } from '@nostrpass/lite-core';
import { schnorr } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import { encrypt as nip04Encrypt, decrypt as nip04Decrypt } from 'nostr-tools/nip04';
import * as nip44 from 'nostr-tools/nip44';

type WorkerOperationPayload = { operation: LitePermissionOperation } & Record<string, unknown>;

interface UnsignedEventPayload {
  kind?: unknown;
  created_at?: unknown;
  tags?: unknown;
  content?: unknown;
}

export const SUPPORTED_WORKER_OPERATIONS: Record<LitePermissionOperation, true> = {
  'getPublicKey': true,
  'signEvent': true,
  'signData': true,
  'nip04.encrypt': true,
  'nip04.decrypt': true,
  'nip44.encrypt': true,
  'nip44.decrypt': true,
};

export function isSupportedWorkerOperation(value: string): value is LitePermissionOperation {
  return value in SUPPORTED_WORKER_OPERATIONS;
}

export function workerPublicKey(privateKeyHex: string): string {
  return getPublicKey(hexToBytes(privateKeyHex));
}

export async function executeWorkerCryptoOperation(
  privateKeyHex: string,
  payload: WorkerOperationPayload
): Promise<unknown> {
  switch (payload.operation) {
    case 'getPublicKey':
      return workerPublicKey(privateKeyHex);

    case 'signEvent': {
      const raw = payload.event as UnsignedEventPayload | undefined;
      if (!raw || typeof raw !== 'object') {
        throw new Error('Missing event payload');
      }

      const unsigned = {
        kind: Number(raw.kind ?? 1),
        created_at: Number(raw.created_at ?? Math.floor(Date.now() / 1000)),
        tags: (raw.tags as string[][] | undefined) ?? [],
        content: String(raw.content ?? ''),
      };

      return finalizeEvent(unsigned, hexToBytes(privateKeyHex));
    }

    case 'signData': {
      const messageHex = String(payload.message ?? '');
      return bytesToHex(
        schnorr.sign(hexToBytes(messageHex), hexToBytes(privateKeyHex))
      );
    }

    case 'nip04.encrypt':
      return nip04Encrypt(
        privateKeyHex,
        String(payload.pubkey ?? ''),
        String(payload.plaintext ?? '')
      );

    case 'nip04.decrypt':
      return nip04Decrypt(
        privateKeyHex,
        String(payload.pubkey ?? ''),
        String(payload.ciphertext ?? '')
      );

    case 'nip44.encrypt': {
      const conversationKey = nip44.v2.utils.getConversationKey(
        hexToBytes(privateKeyHex),
        String(payload.pubkey ?? '')
      );
      return nip44.v2.encrypt(String(payload.plaintext ?? ''), conversationKey);
    }

    case 'nip44.decrypt': {
      const conversationKey = nip44.v2.utils.getConversationKey(
        hexToBytes(privateKeyHex),
        String(payload.pubkey ?? '')
      );
      return nip44.v2.decrypt(String(payload.ciphertext ?? ''), conversationKey);
    }
  }
}
