/**
 * SharedWorker-compatible version of the crypto worker
 * This file is built as an IIFE for browser compatibility
 */

// Import all the handlers and dependencies
import { createWorkerHost } from '@nostrpass/worker-messenger';
import { handlers, ensureWasmReady } from './crypto.handlers';

// Detect if we're in a SharedWorker or regular Worker context
const isSharedWorker = typeof (globalThis as any).SharedWorkerGlobalScope !== 'undefined' && 
                       self instanceof (globalThis as any).SharedWorkerGlobalScope;

console.log('[CryptoWorker] Starting as', isSharedWorker ? 'SharedWorker' : 'DedicatedWorker');

if (isSharedWorker) {
  // Initialize a single host; it will attach per-port listeners internally
  createWorkerHost(handlers as any);
  
  const ports: Set<MessagePort> = new Set();
  console.log('[SharedWorker] Ready to accept connections');
  (self as any).addEventListener('connect', (event: MessageEvent) => {
    const port = (event as any).ports[0] as MessagePort;
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
  const host = createWorkerHost(handlers as any);
  console.log('[DedicatedWorker] Host created and ready');
  
  // Send ready message for dedicated worker
  self.postMessage({ type: 'WORKER_READY' });
}

// Pre-initialize WASM on startup - CRITICAL for SharedWorker
let wasmInitPromise = ensureWasmReady()
  .then(() => {
    console.log('[CryptoWorker] WASM initialized successfully');
    return true;
  })
  .catch((error) => {
    console.error('[CryptoWorker] Failed to initialize WASM:', error);
    throw error;
  });

// Ensure WASM is ready before processing any messages in SharedWorker mode
if (isSharedWorker) {
  const originalHandlers = { ...handlers };
  // Wrap all handlers to ensure WASM is ready first
  for (const key in handlers) {
    const originalHandler = (handlers as any)[key];
    (handlers as any)[key] = async (...args: any[]) => {
      await wasmInitPromise; // Wait for WASM to be ready
      return originalHandler(...args);
    };
  }
}

// Export for type checking (won't be used in IIFE build)
export type CryptoWorkerMethods = typeof handlers;