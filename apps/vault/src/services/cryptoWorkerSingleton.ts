import { createWorkerClient } from '@nostrpass/worker-messenger';

let sharedPort: MessagePort | null = null;
let workerClient: any | null = null;

export function getCryptoWorker(): any {
  if (!workerClient) {
    if (typeof SharedWorker === 'undefined') {
      throw new Error('[NostrPass] SharedWorker is not supported in this browser. Please use a modern browser that supports SharedWorker.');
    }
    
    // Prefer module SharedWorker (hot reload reflects handlers) then fall back to classic IIFE
    // Attempt 1: Module SharedWorker using unified worker (supports Shared/Dedicated)
    try {
      const workerUrl = new URL('../workers/crypto.worker.ts', import.meta.url);
      // NOTE: No cache buster - all tabs must use the same URL to share the worker
      const shared = new SharedWorker(workerUrl, { type: 'module', name: 'nostrpass-crypto-v2' });
      sharedPort = shared.port as MessagePort;
      sharedPort.start();
      console.log('[NostrPass] Crypto: using Module SharedWorker (crypto.worker.ts)');
      workerClient = createWorkerClient(sharedPort, {
        timeout: 60000,
        onError: () => {}, // suppress noisy worker messenger errors in UI
      });
      return workerClient;
    } catch (e1) {
      console.warn('[NostrPass] Module SharedWorker failed:', e1);
      // Attempt 2: Classic SharedWorker served from public (prebuilt IIFE)
      try {
        const shared = new SharedWorker('/crypto.worker.js', { name: 'nostrpass-crypto-classic' });
        sharedPort = shared.port as MessagePort;
        sharedPort.start();
        console.log('[NostrPass] Crypto: using Classic SharedWorker (/crypto.worker.js)');
      workerClient = createWorkerClient(sharedPort, {
        timeout: 60000,
        onError: () => {}, // suppress noisy worker messenger errors in UI
      });
        return workerClient;
      } catch (e2) {
        console.error('[NostrPass] All SharedWorker attempts failed:', e2);
        throw new Error('[NostrPass] Failed to initialize SharedWorker. Please check browser compatibility and security settings.');
      }
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