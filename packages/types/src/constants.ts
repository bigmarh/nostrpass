/**
 * Shared crypto and derivation constants for NostrPass
 */

// BIP44: purpose 44', coin type: use 1237' for Nostr (project-specific)
export const BIP44_PURPOSE = 44;
export const BIP44_COIN_TYPE_NOSTR = 1237;

// Default account and change for identities
export const DEFAULT_ACCOUNT_INDEX = 0; // account 0 for user identities
export const DEFAULT_CHANGE = 0; // external chain

// Reserved index for storage identity (separate from user identities)
export const STORAGE_INDEX = 8907;

// Derivation helpers
export function identityPath(index: number): string {
  return `m/${BIP44_PURPOSE}'/${BIP44_COIN_TYPE_NOSTR}'/${DEFAULT_ACCOUNT_INDEX}'/${DEFAULT_changeSegment()}/${index}`;
}

export function storagePath(): string {
  return `m/${BIP44_PURPOSE}'/${BIP44_COIN_TYPE_NOSTR}'/1'/${DEFAULT_changeSegment()}/0`;
}

function DEFAULT_changeSegment(): number {
  return DEFAULT_CHANGE;
}

// KDF parameters (Argon2id)
export const ARGON2ID_PARAMS = {
  memoryKiB: 64 * 1024, // 64MB
  iterations: 3,
  parallelism: 4,
  saltBytes: 32
};

// AES-GCM parameters
export const AES_GCM_PARAMS = {
  ivBytes: 12, // 96-bit nonce recommended for GCM
  tagBytes: 16
};


