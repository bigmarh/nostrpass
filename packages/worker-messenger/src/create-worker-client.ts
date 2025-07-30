import { WorkerMessenger } from './worker-messenger';
import type { WorkerMethod } from './types';

type ExtractMethods<T> = {
  [K in keyof T]: T[K] extends WorkerMethod<infer P, infer R>
    ? (params: P) => Promise<R>
    : never;
};

export function createWorkerClient<T extends Record<string, WorkerMethod>>(
  worker: Worker,
  options?: { timeout?: number; onError?: (error: Error) => void }
): ExtractMethods<T> {
  const messenger = new WorkerMessenger(options);
  messenger.setWorker(worker);

  return new Proxy({} as ExtractMethods<T>, {
    get: (_, method: string) => {
      return (params: unknown) => messenger.call(method, params);
    },
  });
}