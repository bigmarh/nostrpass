import { describe, expect, test } from 'vitest';
import { nsecEncode } from 'nostr-tools/nip19';
import { generateSecretKey } from 'nostr-tools';
import type { Event as NostrEvent } from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils';
import {
  LiteCore,
  MemoryKeyValueStore,
  decryptString,
  encryptString,
  normalizePrivateKey,
  type RelayClient,
} from '../../../packages/lite-core/src';

class MockRelayClient implements RelayClient {
  private events: NostrEvent[] = [];
  constructor(private readonly publishAcks: string[] = ['mock://relay']) {}

  async getLatest(filter: {
    kinds?: number[];
    authors?: string[];
    dTags?: string[];
    limit?: number;
  }): Promise<{ content: string; createdAt: number; pubkey: string } | null> {
    const matching = this.events.filter((event) => {
      if (filter.kinds && !filter.kinds.includes(event.kind)) {
        return false;
      }
      if (filter.authors && !filter.authors.includes(event.pubkey)) {
        return false;
      }
      if (filter.dTags?.length) {
        const dTag = event.tags.find((tag) => tag[0] === 'd')?.[1];
        if (!dTag || !filter.dTags.includes(dTag)) {
          return false;
        }
      }
      return true;
    });

    if (!matching.length) {
      return null;
    }

    const latest = [...matching].sort((a, b) => b.created_at - a.created_at)[0];
    return {
      content: latest.content,
      createdAt: latest.created_at * 1000,
      pubkey: latest.pubkey,
    };
  }

  async publish(event: NostrEvent): Promise<string[]> {
    this.events.push(event);
    return this.publishAcks;
  }
}

describe('LiteCore basics', () => {
  test('encryptString/decryptString roundtrip', () => {
    const secret = 'pass-123';
    const encrypted = encryptString('hello', secret);
    expect(decryptString(encrypted, secret)).toBe('hello');
  });

  test('normalizes nsec and hex key formats', () => {
    const secret = generateSecretKey();
    const hex = bytesToHex(secret);
    const nsec = nsecEncode(secret);

    expect(normalizePrivateKey({ format: 'hex', value: hex })).toBe(hex);
    expect(normalizePrivateKey({ format: 'nsec', value: nsec })).toBe(hex);
  });

  test('enroll/login/unlock and permission flow', async () => {
    const relay = new MockRelayClient();
    const core = new LiteCore({
      storage: new MemoryKeyValueStore(),
      relayClient: relay,
      namespace: 'nostrpass-lite-test',
      environment: 'test',
      relays: ['mock://relay'],
    });

    await core.initialize();

    const enroll = await core.enrollWithPassword({
      identifier: 'alice',
      authSecret: 'password123',
      pin: '123456',
    });

    expect(enroll.authState.isAuthenticated).toBe(true);
    expect(enroll.authState.isLocked).toBe(false);

    await core.lock();
    await core.logout();

    const login = await core.login({
      authMethod: 'password',
      identifier: 'alice',
      authSecret: 'password123',
      relays: ['mock://relay'],
    });

    expect(login.isAuthenticated).toBe(true);
    expect(login.isLocked).toBe(true);

    const unlocked = await core.unlock({ pin: '123456' });
    expect(unlocked.isLocked).toBe(false);

    const pending = await core.requestOperation<string>({
      origin: 'https://example.com',
      operation: 'getPublicKey',
    });

    expect(pending.success).toBe(false);
    expect(pending.errorCode).toBe('PERMISSION_REQUIRED');
    expect(pending.requestId).toBeTruthy();

    const resolved = await core.resolvePermission<string>({
      requestId: pending.requestId!,
      granted: true,
      remember: true,
      level: 'ALLOW',
    });

    expect(resolved.success).toBe(true);
    expect(resolved.data).toMatch(/^[a-f0-9]{64}$/);
  });

  test('fails enroll when relay durability minimum is not met', async () => {
    const relay = new MockRelayClient([]);
    const core = new LiteCore({
      storage: new MemoryKeyValueStore(),
      relayClient: relay,
      namespace: 'nostrpass-lite-test',
      environment: 'test',
      relays: ['mock://relay-a', 'mock://relay-b'],
      allowOffline: true,
      minRelayAcks: 1,
    });

    await core.initialize();

    await expect(
      core.enrollWithPassword({
        identifier: 'bob',
        authSecret: 'password123',
        pin: '123456',
      })
    ).rejects.toMatchObject({
      code: 'RELAY_DURABILITY_FAILED',
    });
  });

  test('supports ASK_PER_SESSION permission grants with expiry', async () => {
    let now = 1_700_000_000_000;
    const relay = new MockRelayClient();
    const core = new LiteCore({
      storage: new MemoryKeyValueStore(),
      relayClient: relay,
      namespace: 'nostrpass-lite-test',
      environment: 'test',
      relays: ['mock://relay'],
      now: () => now,
    });

    await core.initialize();
    await core.enrollWithPassword({
      identifier: 'carol',
      authSecret: 'password123',
      pin: '123456',
    });

    const first = await core.requestOperation<string>({
      origin: 'https://agent.example',
      operation: 'getPublicKey',
    });
    expect(first.success).toBe(false);
    expect(first.errorCode).toBe('PERMISSION_REQUIRED');

    const granted = await core.resolvePermission<string>({
      requestId: first.requestId!,
      granted: true,
      remember: true,
      level: 'ASK_PER_SESSION',
      sessionDurationMinutes: 5,
    });
    expect(granted.success).toBe(true);

    const second = await core.requestOperation<string>({
      origin: 'https://agent.example',
      operation: 'getPublicKey',
    });
    expect(second.success).toBe(true);

    now += 6 * 60 * 1000;
    const third = await core.requestOperation<string>({
      origin: 'https://agent.example',
      operation: 'getPublicKey',
    });
    expect(third.success).toBe(false);
    expect(third.errorCode).toBe('PERMISSION_REQUIRED');
  });
});
