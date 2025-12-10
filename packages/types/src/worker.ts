/**
 * Typed Worker API for crypto operations
 */

import { ErrorCode } from './messages';

export enum WorkerOp {
  GenerateXpriv = 'generateXpriv',
  DeriveKeypairFromXpriv = 'deriveKeypairFromXpriv',
  SignEvent = 'signEvent',
  SignData = 'signData',
  Nip04Encrypt = 'nip04Encrypt',
  Nip04Decrypt = 'nip04Decrypt',
  Nip44Encrypt = 'nip44Encrypt',
  Nip44Decrypt = 'nip44Decrypt',
  EncryptData = 'encryptData',
  DecryptData = 'decryptData',
  CreateSession = 'createSession',
  GetSession = 'getSession',
  ClearSession = 'clearSession'
}

export type WorkerRequest =
  | { type: WorkerOp.GenerateXpriv; data: {} }
  | { type: WorkerOp.DeriveKeypairFromXpriv; data: { xpriv: string; index: number } }
  | { type: WorkerOp.SignEvent; data: { privateKey?: string; event: any } }
  | { type: WorkerOp.SignData; data: { privateKey?: string; message: string } }
  | { type: WorkerOp.Nip04Encrypt; data: { privateKey?: string; recipientPubkey: string; plaintext: string } }
  | { type: WorkerOp.Nip04Decrypt; data: { privateKey?: string; senderPubkey: string; ciphertext: string } }
  | { type: WorkerOp.Nip44Encrypt; data: { privateKey?: string; recipientPubkey: string; plaintext: string } }
  | { type: WorkerOp.Nip44Decrypt; data: { privateKey?: string; senderPubkey: string; ciphertext: string } }
  | { type: WorkerOp.EncryptData; data: { data: string; password?: string; key?: CryptoKey | ArrayBuffer } }
  | { type: WorkerOp.DecryptData; data: { data: string; password?: string; key?: CryptoKey | ArrayBuffer } }
  | { type: WorkerOp.CreateSession; data: { username: string; privateKey: string; publicKey: string; identityIndex: number; ttlMs?: number } }
  | { type: WorkerOp.GetSession; data: { username: string } }
  | { type: WorkerOp.ClearSession; data: { username: string } };

export type WorkerResponse =
  | { success: true; data: any }
  | { success: false; error: string; code?: ErrorCode };


