import { createWorkerClient } from '@nostrpass/worker-messenger';

export type WorkerBackend = 'shared-worker' | 'dedicated-worker';

let workerClient: any | null = null;
let sharedPort: MessagePort | null = null;
let dedicatedWorker: Worker | null = null;
let currentBackend: WorkerBackend | null = null;

/**
 * Detect the best worker backend for the current environment.
 * - Mobile devices use Dedicated Worker (SharedWorker not supported on mobile Chrome)
 * - Desktop with SharedWorker support uses SharedWorker for cross-tab session sharing
 */
export function detectBestBackend(): WorkerBackend {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const hasSharedWorker = typeof SharedWorker !== 'undefined';

  if (isMobile || !hasSharedWorker) {
    return 'dedicated-worker';
  }

  return 'shared-worker';
}

/**
 * Get the current backend type being used.
 * Returns null if no worker has been initialized yet.
 */
export function getBackendType(): WorkerBackend | null {
  return currentBackend;
}

/**
 * Check if we're running on a mobile device.
 */
export function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Get or create the crypto worker client.
 * Automatically selects the best backend for the current environment.
 */
export function getCryptoWorker(): any {
  if (workerClient) {
    return workerClient;
  }

  currentBackend = detectBestBackend();

  if (currentBackend === 'shared-worker') {
    workerClient = createSharedWorkerClient();
  } else {
    workerClient = createDedicatedWorkerClient();
  }

  console.log(`[NostrPass] Crypto worker initialized with backend: ${currentBackend}`);
  return workerClient;
}

/**
 * Create a SharedWorker client (desktop).
 * SharedWorker allows session sharing across tabs.
 */
function createSharedWorkerClient(): any {
  // Prefer module SharedWorker, fall back to classic IIFE
  try {
    const workerUrl = import.meta.env.PROD
      ? new URL('/crypto.worker.js', window.location.origin)
      : new URL('../workers/crypto.worker.ts', import.meta.url);

    // Version param forces reload after code changes
    workerUrl.searchParams.set('v', '14');

    const shared = new SharedWorker(workerUrl, {
      type: 'module',
      name: 'nostrpass-crypto-v14'
    });

    sharedPort = shared.port as MessagePort;
    sharedPort.start();

    console.log('[NostrPass] Crypto: using Module SharedWorker');

    return createWorkerClient(sharedPort, {
      timeout: 60000,
      onError: () => {}, // suppress noisy errors in UI
    });
  } catch (e1) {
    console.warn('[NostrPass] Module SharedWorker failed:', e1);

    // Fallback: Classic SharedWorker from public
    try {
      const shared = new SharedWorker('/crypto.worker.js', {
        name: 'nostrpass-crypto-classic'
      });

      sharedPort = shared.port as MessagePort;
      sharedPort.start();

      console.log('[NostrPass] Crypto: using Classic SharedWorker');

      return createWorkerClient(sharedPort, {
        timeout: 60000,
        onError: () => {},
      });
    } catch (e2) {
      console.error('[NostrPass] All SharedWorker attempts failed:', e2);

      // Final fallback: try dedicated worker
      console.log('[NostrPass] Falling back to Dedicated Worker');
      currentBackend = 'dedicated-worker';
      return createDedicatedWorkerClient();
    }
  }
}

/**
 * Create a Dedicated Worker client (mobile).
 * Dedicated Worker runs per-tab - no cross-tab session sharing.
 * On mobile, this is expected since users only have one active tab.
 */
function createDedicatedWorkerClient(): any {
  try {
    const workerUrl = import.meta.env.PROD
      ? new URL('/crypto.worker.js', window.location.origin)
      : new URL('../workers/crypto.worker.ts', import.meta.url);

    // Version param forces reload after code changes
    workerUrl.searchParams.set('v', '14');

    dedicatedWorker = new Worker(workerUrl, {
      type: 'module',
      name: 'nostrpass-crypto-dedicated'
    });

    console.log('[NostrPass] Crypto: using Dedicated Worker (mobile mode)');

    return createWorkerClient(dedicatedWorker, {
      timeout: 60000,
      onError: () => {},
    });
  } catch (e1) {
    console.warn('[NostrPass] Module Dedicated Worker failed:', e1);

    // Fallback: Classic worker from public
    try {
      dedicatedWorker = new Worker('/crypto.worker.js', {
        name: 'nostrpass-crypto-dedicated-classic'
      });

      console.log('[NostrPass] Crypto: using Classic Dedicated Worker');

      return createWorkerClient(dedicatedWorker, {
        timeout: 60000,
        onError: () => {},
      });
    } catch (e2) {
      console.error('[NostrPass] All Dedicated Worker attempts failed:', e2);
      throw new Error('[NostrPass] Failed to initialize crypto worker. Please check browser compatibility.');
    }
  }
}

/**
 * Get the underlying worker instance (MessagePort for SharedWorker, Worker for Dedicated).
 * Used for backward compatibility and direct messaging.
 */
export function getCryptoWorkerInstance(): MessagePort | Worker {
  if (!workerClient) {
    getCryptoWorker();
  }

  if (currentBackend === 'shared-worker' && sharedPort) {
    return sharedPort;
  }

  if (currentBackend === 'dedicated-worker' && dedicatedWorker) {
    return dedicatedWorker;
  }

  throw new Error('[NostrPass] No worker instance available');
}

/**
 * Terminate the current worker and clear the cache.
 * Useful for testing or forced reinitialization.
 */
export function terminateWorker(): void {
  if (sharedPort) {
    sharedPort.close();
    sharedPort = null;
  }

  if (dedicatedWorker) {
    dedicatedWorker.terminate();
    dedicatedWorker = null;
  }

  workerClient = null;
  currentBackend = null;

  console.log('[NostrPass] Crypto worker terminated');
}
