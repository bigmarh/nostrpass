import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

export function stableHash(input: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(input))).slice(0, 32);
}

export function createLoginDTag(
  namespace: string,
  authMethod: 'password' | 'google',
  identifier: string,
  environment: string
): string {
  return `${namespace}:lite:login:${authMethod}:${stableHash(identifier)}:${environment}`;
}

export function createVaultDTag(
  namespace: string,
  publicKey: string,
  environment: string
): string {
  return `${namespace}:lite:vault:${stableHash(publicKey)}:${environment}`;
}
