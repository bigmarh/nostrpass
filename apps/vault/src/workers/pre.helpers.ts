import { sha256 } from '@noble/hashes/sha256';
import { hmac } from '@noble/hashes/hmac';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

export interface Envelope<T = any> {
  version: number;
  updatedAt: number;
  prevHash: string | null;
  contentHash: string;
  data: T;
}

// Stable stringify with sorted keys (recursively) to ensure deterministic hashes
export function stableStringify(value: any): string {
  const cache = new Set<any>();
  const stringify = (val: any): any => {
    if (val === null || typeof val !== 'object') return val;
    if (cache.has(val)) throw new Error('Cyclic structure in stableStringify');
    cache.add(val);
    if (Array.isArray(val)) return val.map((v) => stringify(v));
    const keys = Object.keys(val).sort();
    const obj: any = {};
    for (const k of keys) obj[k] = stringify(val[k]);
    return obj;
  };
  const normalized = stringify(value);
  return JSON.stringify(normalized);
}

export function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  return bytesToHex(sha256(bytes));
}

export function hmacHexFromKeyHex(keyHex: string, message: string): string {
  const key = hexToBytes(keyHex);
  const msg = new TextEncoder().encode(message);
  const mac = hmac(sha256, key, msg);
  return bytesToHex(mac);
}

// Deterministic IDs (opaque)
export function deriveIdentityId(storagePrivateKeyHex: string, path: string): string {
  return hmacHexFromKeyHex(storagePrivateKeyHex, `np:identity:${path}`);
}

export function deriveAppId(storagePrivateKeyHex: string, appDomain: string): string {
  return hmacHexFromKeyHex(storagePrivateKeyHex, `np:app:${appDomain}`);
}

export function identityStreamId(storagePrivateKeyHex: string, identityId: string): string {
  return hmacHexFromKeyHex(storagePrivateKeyHex, `np:stream:identity:${identityId}`);
}

export function permStreamId(storagePrivateKeyHex: string, identityId: string, appId: string): string {
  return hmacHexFromKeyHex(storagePrivateKeyHex, `np:stream:perm:${identityId}:${appId}`);
}

export function activeStreamId(storagePrivateKeyHex: string, appId: string): string {
  return hmacHexFromKeyHex(storagePrivateKeyHex, `np:stream:active:${appId}`);
}

export function relaysStreamId(storagePrivateKeyHex: string): string {
  return hmacHexFromKeyHex(storagePrivateKeyHex, `np:stream:relays`);
}

// Envelope helpers
export function computeContentHash<T>(envelopeLike: Omit<Envelope<T>, 'contentHash'>): string {
  // Hash excludes contentHash to avoid recursion
  const serialized = stableStringify(envelopeLike);
  return sha256Hex(serialized);
}

export function computePrevHash<T>(prevEnvelope: Envelope<T>): string {
  // Previous hash includes the previous envelope fields including contentHash
  const serialized = stableStringify(prevEnvelope);
  return sha256Hex(serialized);
}

export function buildEnvelope<T>(params: { data: T; prev?: Envelope<T>; now?: number }): Envelope<T> {
  const { data, prev } = params;
  const updatedAt = params.now ?? Date.now();
  const version = prev ? (prev.version || 0) + 1 : 1;
  const prevHash = prev ? computePrevHash(prev) : null;
  const partial: Omit<Envelope<T>, 'contentHash'> = { version, updatedAt, prevHash, data };
  const contentHash = computeContentHash(partial);
  return { ...partial, contentHash };
}

export function verifyEnvelope<T>(current: Envelope<T>, prev?: Envelope<T>): boolean {
  // Verify contentHash
  const recomputed = computeContentHash({
    version: current.version,
    updatedAt: current.updatedAt,
    prevHash: current.prevHash,
    data: current.data
  });
  if (recomputed !== current.contentHash) return false;

  if (!prev) return current.version === 1 && current.prevHash === null;

  // Version monotonicity and prevHash linkage
  if (current.version !== (prev.version || 0) + 1) return false;
  const expectedPrevHash = computePrevHash(prev);
  if (current.prevHash !== expectedPrevHash) return false;
  if ((current.updatedAt || 0) < (prev.updatedAt || 0)) return false;
  return true;
}


