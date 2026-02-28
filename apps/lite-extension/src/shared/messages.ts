export type LiteMessageType =
  | 'lite.authState'
  | 'lite.enrollPassword'
  | 'lite.enrollGoogle'
  | 'lite.importKey'
  | 'lite.loginPassword'
  | 'lite.loginGoogle'
  | 'lite.unlock'
  | 'lite.lock'
  | 'lite.pendingRequest'
  | 'lite.resolvePermission'
  | 'getPublicKey'
  | 'signEvent'
  | 'nip04.encrypt'
  | 'nip04.decrypt'
  | 'nip44.encrypt'
  | 'nip44.decrypt';

export interface LiteMessage {
  type: LiteMessageType;
  data?: Record<string, unknown>;
  origin?: string;
  requestId?: string;
}

export interface LiteResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  requestId?: string;
}
