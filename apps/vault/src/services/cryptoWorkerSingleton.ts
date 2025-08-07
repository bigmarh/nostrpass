import { createWorkerClient } from '@nostrpass/worker-messenger';
import type { CryptoWorkerMethods } from '../workers/crypto.worker';

let workerInstance: Worker | null = null;
let workerClient: any | null = null;

export function getCryptoWorker(): any {
  if (!workerClient) {
    workerInstance = new Worker(
      new URL('../workers/crypto.worker.ts', import.meta.url), 
      { type: 'module' }
    );
    workerClient = createWorkerClient(workerInstance, {
      timeout: 60000, // Increased to 60 seconds for large vault operations
      onError: (error) => {
        console.error('Crypto worker error:', error);
      },
    });
  }
  return workerClient;
}

export function getCryptoWorkerInstance(): Worker {
  if (!workerInstance) {
    getCryptoWorker();
  }
  return workerInstance!;
}