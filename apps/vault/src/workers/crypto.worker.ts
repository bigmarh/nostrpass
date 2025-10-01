// Top-level error handler
self.addEventListener('error', (event) => {
  console.error('[CryptoWorker] Uncaught error:', event.error);
  // Post error to main thread
  if (self.postMessage) {
    self.postMessage({ type: 'WORKER_ERROR', error: event.error?.message || String(event.error) });
  }
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[CryptoWorker] Unhandled rejection:', event.reason);
  // Post error to main thread
  if (self.postMessage) {
    self.postMessage({ type: 'WORKER_ERROR', error: event.reason?.message || String(event.reason) });
  }
});

console.log('[CryptoWorker] Starting initialization...');

import { createWorkerHost } from '@nostrpass/worker-messenger';
import { handlers, ensureCryptoReady } from './crypto.handlers';

console.log('[CryptoWorker] Imports loaded successfully');

// Re-export handlers for type checking
export { handlers };

export type CryptoWorkerMethods = typeof handlers;

// Detect if we're in a SharedWorker or regular Worker context
const isSharedWorker = typeof (globalThis as any).SharedWorkerGlobalScope !== 'undefined' && 
                       self instanceof (globalThis as any).SharedWorkerGlobalScope;

console.log('[CryptoWorker] Worker type detected:', isSharedWorker ? 'SharedWorker' : 'DedicatedWorker');

if (isSharedWorker) {
  // Create worker host ONCE - it handles all port connections internally
  console.log('[SharedWorker] Creating single worker host (handles all ports)');
  const host = createWorkerHost(handlers as any, { debug: true });
  
  // Track connections for diagnostics
  const ports: Set<MessagePort> = new Set();
  console.log('[SharedWorker] Initializing in SharedWorker mode');
  
  self.addEventListener('connect', (event: any) => {
    const port: MessagePort = event.ports[0];
    ports.add(port);
    
    console.log('[SharedWorker] New connection received (worker host will handle it)');
    
    // Port is automatically handled by WorkerMessenger's internal connect listener
    // Just send ready signal
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

// Pre-initialize crypto on worker startup - CRITICAL for SharedWorker
// Must be initialized before handling any connections
let cryptoInitPromise = ensureCryptoReady()
  .then(() => {
    console.log('[CryptoWorker] Noble crypto module ready');
    return true;
  })
  .catch((error) => {
    console.error('[CryptoWorker] Error initializing crypto:', error);
    throw error;
  });

// Ensure crypto is ready before processing any messages
if (isSharedWorker) {
  // Wrap all handlers to ensure crypto is ready first
  for (const key in handlers) {
    const originalHandler = (handlers as any)[key];
    (handlers as any)[key] = async (...args: any[]) => {
      await cryptoInitPromise; // Wait for crypto to be ready
      return originalHandler(...args);
    };
  }
}

// Check for expired sessions and notify
// Auto-expiry disabled: no periodic expiry checks