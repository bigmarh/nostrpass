import { describe, expect, test } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { schnorr } from '@noble/curves/secp256k1';
import {
  SUPPORTED_WORKER_OPERATIONS,
  executeWorkerCryptoOperation,
  workerPublicKey,
} from '../../../apps/lite-vault/src/cryptoWorkerOps';

describe('Lite worker crypto operations', () => {
  test('declares the full supported signer operation surface', () => {
    expect(Object.keys(SUPPORTED_WORKER_OPERATIONS).sort()).toEqual([
      'getPublicKey',
      'nip04.decrypt',
      'nip04.encrypt',
      'nip44.decrypt',
      'nip44.encrypt',
      'signData',
      'signEvent',
    ]);
  });

  test('getPublicKey returns the derived pubkey', async () => {
    const privateKey = generateSecretKey();
    const privateKeyHex = bytesToHex(privateKey);

    expect(workerPublicKey(privateKeyHex)).toBe(getPublicKey(privateKey));
    await expect(
      executeWorkerCryptoOperation(privateKeyHex, { operation: 'getPublicKey' })
    ).resolves.toBe(getPublicKey(privateKey));
  });

  test('signEvent finalizes a Nostr event', async () => {
    const privateKeyHex = bytesToHex(generateSecretKey());
    const result = await executeWorkerCryptoOperation(privateKeyHex, {
      operation: 'signEvent',
      event: {
        kind: 1,
        created_at: 1_700_000_000,
        tags: [['t', 'test']],
        content: 'gm',
      },
    });

    expect(result).toMatchObject({
      kind: 1,
      content: 'gm',
      pubkey: workerPublicKey(privateKeyHex),
    });
    expect((result as { id: string }).id).toMatch(/^[a-f0-9]{64}$/);
    expect((result as { sig: string }).sig).toMatch(/^[a-f0-9]{128}$/);
  });

  test('signData returns a schnorr signature for the provided hex payload', async () => {
    const privateKey = generateSecretKey();
    const privateKeyHex = bytesToHex(privateKey);
    const messageHex = '00'.repeat(32);

    const signature = await executeWorkerCryptoOperation(privateKeyHex, {
      operation: 'signData',
      message: messageHex,
    });

    expect(typeof signature).toBe('string');
    expect(schnorr.verify(String(signature), hexToBytes(messageHex), workerPublicKey(privateKeyHex))).toBe(true);
  });

  test('nip04 encrypt/decrypt roundtrips', async () => {
    const senderPrivateKey = generateSecretKey();
    const receiverPrivateKey = generateSecretKey();
    const senderHex = bytesToHex(senderPrivateKey);
    const receiverHex = bytesToHex(receiverPrivateKey);
    const receiverPubkey = getPublicKey(receiverPrivateKey);
    const senderPubkey = getPublicKey(senderPrivateKey);

    const ciphertext = await executeWorkerCryptoOperation(senderHex, {
      operation: 'nip04.encrypt',
      pubkey: receiverPubkey,
      plaintext: 'hello nip04',
    });

    await expect(
      executeWorkerCryptoOperation(receiverHex, {
        operation: 'nip04.decrypt',
        pubkey: senderPubkey,
        ciphertext,
      })
    ).resolves.toBe('hello nip04');
  });

  test('nip44 encrypt/decrypt roundtrips', async () => {
    const senderPrivateKey = generateSecretKey();
    const receiverPrivateKey = generateSecretKey();
    const senderHex = bytesToHex(senderPrivateKey);
    const receiverHex = bytesToHex(receiverPrivateKey);
    const receiverPubkey = getPublicKey(receiverPrivateKey);
    const senderPubkey = getPublicKey(senderPrivateKey);

    const ciphertext = await executeWorkerCryptoOperation(senderHex, {
      operation: 'nip44.encrypt',
      pubkey: receiverPubkey,
      plaintext: 'hello nip44',
    });

    await expect(
      executeWorkerCryptoOperation(receiverHex, {
        operation: 'nip44.decrypt',
        pubkey: senderPubkey,
        ciphertext,
      })
    ).resolves.toBe('hello nip44');
  });
});
