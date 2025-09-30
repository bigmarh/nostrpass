// SharedWorker wrapper that handles both SharedWorker and regular Worker contexts
// This file will be built as an IIFE for browser compatibility

import { createWorkerHost } from '@nostrpass/worker-messenger';
import { handlers } from './crypto.worker';

// Detect if we're in a SharedWorker or regular Worker context
const isSharedWorker = typeof SharedWorkerGlobalScope !== 'undefined' && 
                       self instanceof SharedWorkerGlobalScope;

console.log('[CryptoWorker] Initializing as', isSharedWorker ? 'SharedWorker' : 'DedicatedWorker');

if (isSharedWorker) {
  // SharedWorker context - handle port connections
  const ports: Set<MessagePort> = new Set();
  
  self.addEventListener('connect', (event: any) => {
    const port = event.ports[0];
    ports.add(port);
    
    console.log('[CryptoWorker] New SharedWorker connection, total ports:', ports.size);
    
    // Create a worker host for this specific port
    const host = createWorkerHost(handlers as any, port);
    
    // Clean up on port close
    port.addEventListener('close', () => {
      ports.delete(port);
      console.log('[CryptoWorker] Port closed, remaining ports:', ports.size);
    });
    
    // Start the port
    port.start();
  });
} else {
  // Regular Worker context - use the global scope
  const host = createWorkerHost(handlers as any);
  console.log('[CryptoWorker] DedicatedWorker host created');
}

// Pre-initialize WASM on worker startup
import('./wasm/nostrpass_crypto.js').then(async (module) => {
  const { default: init, NostrCrypto } = module;
  await init();
  console.log('[CryptoWorker] WASM initialized');
  
  // Store globally for handlers to access
  (self as any).__wasmCrypto = new NostrCrypto();
}).catch((error) => {
  console.error('[CryptoWorker] Failed to initialize WASM:', error);
});