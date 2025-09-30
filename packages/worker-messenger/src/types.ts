export interface WorkerRequest<T = unknown> {
  id: string;
  method: string;
  params?: T;
  timestamp: number;
}

export interface WorkerResponse<T = unknown> {
  id: string;
  result?: T;
  error?: WorkerError;
  timestamp: number;
}

export interface WorkerError {
  code: string;
  message: string;
  data?: unknown;
}

export type WorkerMessageHandler<TParams = unknown, TResult = unknown> = (
  params: TParams
) => Promise<TResult> | TResult;

export type WorkerMessageHandlers = Record<string, WorkerMessageHandler>;

export interface WorkerMessengerOptions {
  timeout?: number;
  onError?: (error: Error) => void;
  /**
   * When true, verbose console logging is enabled for the worker messenger.
   * Defaults to false.
   */
  debug?: boolean;
}

export type WorkerMethod<TParams = unknown, TResult = unknown> = (
  params: TParams
) => Promise<TResult>;