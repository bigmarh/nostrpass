/**
 * Cross-component message enums and payloads
 */

export enum Msg {
  VAULT_READY = 'VAULT_READY',
  AUTH_STATUS = 'AUTH_STATUS',
  SHOW_VAULT = 'SHOW_VAULT',
  HIDE_VAULT = 'HIDE_VAULT',
  CHECK_PERMISSION = 'CHECK_PERMISSION',
  GET_RELAYS = 'GET_RELAYS',
  GET_PUBLIC_KEY = 'GET_PUBLIC_KEY',
  SIGN_EVENT = 'SIGN_EVENT',
  SIGN_DATA = 'SIGN_DATA',
  ENCRYPT = 'ENCRYPT',
  DECRYPT = 'DECRYPT',
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
  INTERNAL = 'E_INTERNAL'
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


