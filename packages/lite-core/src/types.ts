import type { UnsignedEvent } from 'nostr-tools';

export type LiteAuthMethod = 'password' | 'google';

export type LitePermissionOperation =
  | 'getPublicKey'
  | 'signEvent'
  | 'nip04.encrypt'
  | 'nip04.decrypt'
  | 'nip44.encrypt'
  | 'nip44.decrypt';

export type LitePermissionLevel =
  | 'ALLOW'
  | 'ASK_PER_SESSION'
  | 'ASK_EVERYTIME'
  | 'DENY';

export type LitePermissionMap = Record<
  string,
  Partial<Record<LitePermissionOperation, LitePermissionLevel>>
>;

export interface LiteVaultPayload {
  version: 1;
  publicKey: string;
  privateKeyEncrypted: string;
  pinSalt: string;
  permissions: LitePermissionMap;
  createdAt: number;
  updatedAt: number;
}

export interface LiteLoginPayload {
  version: 1;
  authMethod: LiteAuthMethod;
  identifier: string;
  publicKey: string;
  storagePublicKey: string;
  storagePrivateKeyEncrypted: string;
  vaultSecretEncrypted: string;
  vaultDTag: string;
  createdAt: number;
  updatedAt: number;
}

export interface LiteAuthState {
  initialized: boolean;
  isAuthenticated: boolean;
  isLocked: boolean;
  authMethod?: LiteAuthMethod;
  identifier?: string;
  publicKey?: string;
}

export interface LitePendingPermissionRequest {
  id: string;
  origin: string;
  operation: LitePermissionOperation;
  payload?: Record<string, unknown>;
  createdAt: number;
}

export interface LiteEnrollInput {
  authMethod: LiteAuthMethod;
  identifier: string;
  authSecret: string;
  pin: string;
  privateKeyHex?: string;
  relays?: string[];
  overwriteExistingLogin?: boolean;
  overwriteExistingVault?: boolean;
}

export interface LiteImportKeyInput
  extends Omit<LiteEnrollInput, 'privateKeyHex'> {
  format: 'nsec' | 'hex';
  value: string;
}

export interface LiteLoginInput {
  authMethod: LiteAuthMethod;
  identifier: string;
  authSecret: string;
  relays?: string[];
}

export interface LiteUnlockInput {
  pin: string;
}

export interface LiteResolvePermissionInput {
  requestId: string;
  granted: boolean;
  remember?: boolean;
  level?: LitePermissionLevel;
  sessionDurationMinutes?: number;
}

export interface LiteOperationRequest {
  origin: string;
  operation: LitePermissionOperation;
  payload?: Record<string, unknown>;
}

export interface LiteOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?:
    | 'LOCKED'
    | 'NOT_AUTHENTICATED'
    | 'PERMISSION_DENIED'
    | 'PERMISSION_REQUIRED'
    | 'INVALID_INPUT'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'INTERNAL_ERROR';
  requestId?: string;
}

export interface LiteSetupResult {
  authState: LiteAuthState;
  publicKey: string;
}

export interface KeyValueStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface RelayClient {
  getLatest(filter: {
    kinds?: number[];
    authors?: string[];
    dTags?: string[];
    limit?: number;
  }): Promise<{ content: string; createdAt: number; pubkey: string } | null>;
  publish(event: UnsignedEvent & { pubkey: string; id: string; sig: string }): Promise<string[]>;
}

/**
 * Optional delegate for performing private-key crypto operations in an isolated
 * context (e.g., a Web Worker). When provided to LiteCore, the raw private key
 * never materialises on the main thread — only encrypted blobs and results cross
 * the boundary.
 */
export interface CryptoDelegate {
  /** Decrypt and load the private key into the delegate using the PIN */
  loadKey(encryptedPrivateKey: string, pin: string): Promise<{ publicKey: string }>;
  /** Load a private key directly (e.g., after enrollment when the key is freshly generated) */
  loadKeyDirect(privateKeyHex: string): Promise<void>;
  /** Execute a crypto operation using the key held by the delegate */
  execute<T>(operation: LitePermissionOperation, payload?: Record<string, unknown>): Promise<T>;
  /** Clear the private key from the delegate (on lock or logout) */
  clearKey(): Promise<void>;
  /** Synchronously check whether a key is currently loaded */
  isKeyLoaded: boolean;
}
