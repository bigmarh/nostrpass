import { createWorkerClient } from '@nostrpass/worker-messenger';

let sharedPort: MessagePort | null = null;
let workerClient: any | null = null;

export function getCryptoWorker(): any {
  if (!workerClient) {
    try {
      // Prefer SharedWorker if available
      const shared = new (window as any).SharedWorker(
        new URL('../workers/crypto.worker.ts', import.meta.url),
        { type: 'module', name: 'nostrpass-crypto' }
      );
      sharedPort = shared.port as MessagePort;
      console.log('[NostrPass] Crypto: using SharedWorker');
      workerClient = createWorkerClient(sharedPort, {
        timeout: 60000,
        onError: (error) => console.error('Crypto shared worker error:', error),
      });
      return workerClient;
    } catch (e) {
      // Fallback to dedicated Worker
      const worker = new Worker(
        new URL('../workers/crypto.worker.ts', import.meta.url),
        { type: 'module' }
      );
      console.log('[NostrPass] Crypto: using Dedicated Worker (fallback)');
      workerClient = createWorkerClient(worker, {
        timeout: 60000,
        onError: (error) => console.error('Crypto worker error:', error),
      });
      return workerClient;
    }
  }
  return workerClient;
}

export function getCryptoWorkerInstance(): MessagePort | Worker {
  if (!workerClient) {
    getCryptoWorker();
  }
  return (sharedPort as MessagePort) || (undefined as any);
}