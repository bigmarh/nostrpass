import { createWorkerHost } from '@nostrpass/worker-messenger';
import { handlers, ensureWasmReady } from './crypto.handlers';

// Re-export handlers for type checking
export { handlers };

export type CryptoWorkerMethods = typeof handlers;

// Detect if we're in a SharedWorker or regular Worker context
const isSharedWorker = typeof (globalThis as any).SharedWorkerGlobalScope !== 'undefined' && 
                       self instanceof (globalThis as any).SharedWorkerGlobalScope;

if (isSharedWorker) {
  // Initialize a single host to register handlers and let it manage per-port wiring
  createWorkerHost(handlers as any);
  
  // Track connections for diagnostics and send readiness signals
  const ports: Set<MessagePort> = new Set();
  console.log('[SharedWorker] Initializing in SharedWorker mode');
  
  self.addEventListener('connect', (event: any) => {
    const port: MessagePort = event.ports[0];
    ports.add(port);
    try { port.start(); } catch {}
    port.postMessage({ type: 'WORKER_READY' });
    port.addEventListener('close', () => {
      ports.delete(port);
      console.log('[SharedWorker] Port closed, remaining connections:', ports.size);
    });
    console.log('[SharedWorker] Active connections:', ports.size);
  });
} else {
  // Regular Worker context - use the global scope directly
  // @ts-ignore - host is used by the worker-messenger library
  const host = createWorkerHost(handlers as any);
  console.log('[DedicatedWorker] Initialized in DedicatedWorker mode');
  
  // Send ready message for dedicated worker
  self.postMessage({ type: 'WORKER_READY' });
}

// Pre-initialize WASM on worker startup - CRITICAL for SharedWorker
// Must be initialized before handling any connections
let wasmInitPromise = ensureWasmReady()
  .then(() => {
    console.log('[CryptoWorker] WASM crypto module ready');
    return true;
  })
  .catch((error) => {
    console.error('[CryptoWorker] Error initializing WASM:', error);
    throw error;
  });

// Ensure WASM is ready before processing any messages
if (isSharedWorker) {
  // Wrap all handlers to ensure WASM is ready first
  for (const key in handlers) {
    const originalHandler = (handlers as any)[key];
    (handlers as any)[key] = async (...args: any[]) => {
      await wasmInitPromise; // Wait for WASM to be ready
      return originalHandler(...args);
    };
  }
}

// Check for expired sessions and notify
// Auto-expiry disabled: no periodic expiry checks