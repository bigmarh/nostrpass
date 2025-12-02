import { WorkerMessenger } from './worker-messenger';
import type { WorkerMethod } from './types';

type ExtractMethods<T> = {
  [K in keyof T]: T[K] extends WorkerMethod<infer P, infer R>
    ? (params: P) => Promise<R>
    : never;
};

export function createWorkerClient<T extends Record<string, WorkerMethod>>(
  workerOrPort: Worker | MessagePort,
  options?: { timeout?: number; onError?: (error: Error) => void; debug?: boolean }
): ExtractMethods<T> {
  const messenger = new WorkerMessenger(options);

  if (typeof Worker !== 'undefined' && workerOrPort instanceof Worker) {
    messenger.setWorker(workerOrPort);
  } else {
    messenger.setPort(workerOrPort as MessagePort);
  }

  return new Proxy({} as ExtractMethods<T>, {
    get: (_, method: string) => {
      // Special case: generic request method
      if (method === 'request') {
        return (methodName: string, params?: unknown) => messenger.call(methodName, params);
      }
      // Normal case: direct method calls
      return (params: unknown) => messenger.call(method, params);
    },
  });
}