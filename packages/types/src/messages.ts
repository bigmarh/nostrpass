/**
 * Cross-component message enums and payloads
 */

export enum Msg {
  VAULT_READY = 'VAULT_READY',
  AUTH_STATUS = 'AUTH_STATUS',
  VAULT_DATA_UPDATED = 'VAULT_DATA_UPDATED',
  ACCOUNT_PICKER_SELECTED = 'ACCOUNT_PICKER_SELECTED',
  IDENTITY_SWITCHED = 'IDENTITY_SWITCHED',
  SHOW_VAULT = 'SHOW_VAULT',
  HIDE_VAULT = 'HIDE_VAULT',
  NAVIGATE = 'NAVIGATE',
  LOGOUT = 'LOGOUT',
  CHECK_PERMISSION = 'CHECK_PERMISSION',
  GET_RELAYS = 'GET_RELAYS',
  GET_PUBLIC_KEY = 'GET_PUBLIC_KEY',
  SIGN_EVENT = 'SIGN_EVENT',
  SIGN_DATA = 'SIGN_DATA',
  ENCRYPT = 'ENCRYPT',
  DECRYPT = 'DECRYPT',
  NIP44_ENCRYPT = 'NIP44_ENCRYPT',
  NIP44_DECRYPT = 'NIP44_DECRYPT',
  GOT_ERROR = 'GOT_ERROR',
  PROMPT_REQUIRED = 'PROMPT_REQUIRED',
  MANAGE_ACCOUNTS = 'MANAGE_ACCOUNTS',
  GET_ALL_IDENTITIES = 'GET_ALL_IDENTITIES',
  SWITCH_IDENTITY = 'SWITCH_IDENTITY'
}

export enum ErrorCode {
  LOCKED = 'E_LOCKED',
  PERMISSION_DENIED = 'E_PERMISSION_DENIED',
  TIMEOUT = 'E_TIMEOUT',
  ORIGIN_REJECTED = 'E_ORIGIN_REJECTED',
  INVALID_REQUEST = 'E_INVALID_REQUEST',
  INTERNAL = 'E_INTERNAL',
  // Additional error codes for auth/vault operations
  USER_NOT_AUTHENTICATED = 'E_USER_NOT_AUTHENTICATED',
  VAULT_LOCKED = 'E_VAULT_LOCKED',
  INVALID_PIN = 'E_INVALID_PIN',
  TOO_MANY_ATTEMPTS = 'E_TOO_MANY_ATTEMPTS',
  // Additional error codes for operations
  SESSION_EXPIRED = 'E_SESSION_EXPIRED',
  NETWORK_ERROR = 'E_NETWORK_ERROR',
  ENCRYPTION_ERROR = 'E_ENCRYPTION_ERROR',
  STORAGE_ERROR = 'E_STORAGE_ERROR',
  INVALID_SIGNATURE = 'E_INVALID_SIGNATURE',
  UNSUPPORTED_OPERATION = 'E_UNSUPPORTED_OPERATION',
  RATE_LIMITED = 'E_RATE_LIMITED',
  INSUFFICIENT_PERMISSIONS = 'E_INSUFFICIENT_PERMISSIONS',
  INVALID_IDENTITY = 'E_INVALID_IDENTITY',
  SYNC_ERROR = 'E_SYNC_ERROR',
  GOOGLE_AUTH_NOT_AVAILABLE = 'E_GOOGLE_AUTH_NOT_AVAILABLE'
}

export interface RequestBase<T extends Msg, D = unknown> {
  type: T;
  data: D;
}

export interface ResponseBase<T extends `${Msg}_RESPONSE`, D = unknown> {
  type: T;
  data: D | { error: string; code?: ErrorCode };
}

export interface GetPublicKeyRequest extends RequestBase<Msg.GET_PUBLIC_KEY, { appName?: string; appDomain?: string; identityIndex?: number }>{}
export interface GetPublicKeyResponse extends ResponseBase<'GET_PUBLIC_KEY_RESPONSE', { publicKey: string }>{}

export interface SignEventRequest extends RequestBase<Msg.SIGN_EVENT, { event: any; appName?: string; appDomain?: string; identityIndex?: number }>{}
export interface SignEventResponse extends ResponseBase<'SIGN_EVENT_RESPONSE', { signedEvent: any }>{}

export interface SignDataRequest extends RequestBase<Msg.SIGN_DATA, { data: string; appName?: string; appDomain?: string; identityIndex?: number }>{}
export interface SignDataResponse extends ResponseBase<'SIGN_DATA_RESPONSE', { signature: string }>{}

export interface EncryptRequest extends RequestBase<Msg.ENCRYPT, { plaintext: string; recipientPubkey: string; appName?: string; appDomain?: string; identityIndex?: number }>{}
export interface EncryptResponse extends ResponseBase<'ENCRYPT_RESPONSE', string>{}

export interface DecryptRequest extends RequestBase<Msg.DECRYPT, { ciphertext: string; senderPubkey: string; appName?: string; appDomain?: string; identityIndex?: number }>{}
export interface DecryptResponse extends ResponseBase<'DECRYPT_RESPONSE', string>{}

export interface Nip44EncryptRequest extends RequestBase<Msg.NIP44_ENCRYPT, { plaintext: string; recipientPubkey: string; appName?: string; appDomain?: string; identityIndex?: number }>{}
export interface Nip44EncryptResponse extends ResponseBase<'NIP44_ENCRYPT_RESPONSE', string>{}

export interface Nip44DecryptRequest extends RequestBase<Msg.NIP44_DECRYPT, { ciphertext: string; senderPubkey: string; appName?: string; appDomain?: string; identityIndex?: number }>{}
export interface Nip44DecryptResponse extends ResponseBase<'NIP44_DECRYPT_RESPONSE', string>{}

export interface GetRelaysRequest extends RequestBase<Msg.GET_RELAYS, { appName?: string; appDomain?: string; identityIndex?: number }>{}
export interface GetRelaysResponse extends ResponseBase<'GET_RELAYS_RESPONSE', Record<string, { read: boolean; write: boolean }>>{}

export interface ManageAccountsRequest extends RequestBase<Msg.MANAGE_ACCOUNTS, { appName?: string; appDomain?: string; forcePrompt?: boolean }>{}
export interface ManageAccountsResponse extends ResponseBase<'MANAGE_ACCOUNTS_RESPONSE', {
  identityIndex: number;
  identity?: {
    nickname?: string;
    publicKey: string;
    npub?: string;
    path?: string;
    authorized: boolean;
  }
}>{}

export interface VaultDataUpdatedPayload {
  username: string;
  timestamp: number;
  activeIdentityIndex?: number;
  activePublicKey?: string;
  appKey?: string;
}

export interface AccountPickerSelectedPayload {
  requestId?: string;
  identityIndex: number;
  identity?: {
    publicKey?: string;
    npub?: string;
    nickname?: string;
    authorized?: boolean;
    avatar?: string;
  };
}

export interface IdentitySwitchedPayload {
  username: string;
  appOrigin: string;
  identityIndex: number;
  timestamp: number;
}


