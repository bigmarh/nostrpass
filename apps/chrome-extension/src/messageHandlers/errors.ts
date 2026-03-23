import { ErrorCode } from '@nostrpass/types';

export function vaultError(code: ErrorCode, message: string): Error {
  const err: any = new Error(message);
  err.code = code;
  return err as Error & { code?: ErrorCode };
}

export { ErrorCode };


