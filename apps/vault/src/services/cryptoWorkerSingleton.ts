import { createWorkerClient } from '@nostrpass/worker-messenger';
import type { CryptoWorkerMethods } from '../workers/crypto.worker';

let workerInstance: Worker | null = null;
let workerClient: any | null = null;

export function getCryptoWorker(): any {
  if (!workerClient) {
    console.log('🔧 Creating singleton crypto worker instance');
    workerInstance = new Worker(
      new URL('../workers/crypto.worker.ts', import.meta.url), 
      { type: 'module' }
    );
    workerClient = createWorkerClient(workerInstance, {
      timeout: 10000,
      onError: (error) => {
        console.error('❌ CryptoWorker error:', error);
      },
    });
    console.log('✅ Singleton crypto worker created');
  }
  return workerClient;
}

export function getCryptoWorkerInstance(): Worker {
  if (!workerInstance) {
    getCryptoWorker();
  }
  return workerInstance!;
}