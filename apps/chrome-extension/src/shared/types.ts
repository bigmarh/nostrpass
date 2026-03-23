/**
 * Chrome Extension shared types
 */

// NIP-07 Nostr Event types
export interface UnsignedEvent {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
  pubkey?: string;
}

export interface SignedEvent extends UnsignedEvent {
  id: string;
  pubkey: string;
  sig: string;
}

export type RelayMap = Record<string, { read: boolean; write: boolean }>;

// Extension message types
export type ExtensionMessageType =
  | 'getPublicKey'
  | 'signEvent'
  | 'signData'
  | 'getRelays'
  | 'nip04.encrypt'
  | 'nip04.decrypt'
  | 'nip44.encrypt'
  | 'nip44.decrypt'
  | 'getAuthState'
  | 'unlock'
  | 'lock'
  | 'getPendingRequest'
  | 'resolvePermission';

export interface ExtensionMessage {
  type: ExtensionMessageType;
  data?: Record<string, unknown>;
  origin?: string;
  requestId?: string;
}

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

// Permission types
export type PermissionLevel = 'ALLOW' | 'ASK_EVERYTIME' | 'DENY';

export interface AppPermissions {
  origin: string;
  getPublicKey?: PermissionLevel;
  signEvent?: PermissionLevel | { kinds?: Record<number, PermissionLevel> };
  signData?: PermissionLevel;
  nip04?: PermissionLevel;
  nip44?: PermissionLevel;
  getRelays?: PermissionLevel;
  lastUsedAt?: number;
  appName?: string;
}

// Identity types
export interface Identity {
  publicKey: string;
  nickname?: string;
  avatar?: string;
  derivationPath?: string;
  appPermissions?: Record<string, AppPermissions>;
}

export interface DerivedIdentity extends Identity {
  privateKey: string;
}

// Vault data structure (stored encrypted)
export interface VaultData {
  xprivEncrypted: string;
  salt: string;
  storagePublicKey: string;
  identities: Identity[];
  version: number;
  updatedAt: number;
}

// Session data (in-memory only)
export interface SessionData {
  unlocked: boolean;
  xpriv?: string;
  identities?: DerivedIdentity[];
  activeIdentityIndex: number;
}

// Pending permission request
export interface PendingRequest {
  id: string;
  type: ExtensionMessageType;
  origin: string;
  appName?: string;
  data: Record<string, unknown>;
  timestamp: number;
}

// Auth state response
export interface AuthState {
  isLoggedIn: boolean;
  isLocked: boolean;
  hasVault: boolean;
  activeIdentityIndex?: number;
  publicKey?: string;
}
