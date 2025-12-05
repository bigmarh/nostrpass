/// <reference lib="webworker" />

// Vault Service Worker
// Handles EMBASSY_REQUEST messages and forwards them to the active vault tab

declare const self: ServiceWorkerGlobalScope;

interface EmbassyRequest {
  type: 'EMBASSY_REQUEST';
  id: string;
  method: string;
  params: any;
}

interface EmbassyResponse {
  type: 'EMBASSY_RESPONSE';
  id: string;
  result?: any;
  error?: string;
}

// Handle install event
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Handle activate event
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  // Claim all clients immediately
  event.waitUntil(self.clients.claim());
});

// Handle messages from embassy-bridge.html
self.addEventListener('message', async (event: ExtendableMessageEvent) => {
  const data = event.data as EmbassyRequest;

  if (data.type === 'EMBASSY_REQUEST') {
    console.log('[ServiceWorker] Received EMBASSY_REQUEST:', data);

    try {
      // Find all active vault clients (tabs)
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });

      // Filter to vault tabs (not the bridge page)
      const vaultClients = clients.filter(client => {
        const url = new URL(client.url);
        return !url.pathname.includes('embassy-bridge.html');
      });

      if (vaultClients.length === 0) {
        console.warn('[ServiceWorker] No vault tab found');
        // Return error to bridge via MessagePort
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            type: 'EMBASSY_RESPONSE',
            id: data.id,
            error: 'VAULT_NOT_OPEN'
          });
        }
        return;
      }

      // Use the first available vault client
      const vaultClient = vaultClients[0];
      console.log('[ServiceWorker] Forwarding to vault tab:', vaultClient.url);

      // Create MessageChannel for response routing
      const channel = new MessageChannel();
      const port1 = channel.port1;
      const port2 = channel.port2;

      // Listen for response from vault tab
      port1.onmessage = (e: MessageEvent) => {
        console.log('[ServiceWorker] Received response from vault tab:', e.data);
        
        // Forward response back to bridge via the original port
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            type: 'EMBASSY_RESPONSE',
            id: data.id,
            result: e.data.result,
            error: e.data.error
          });
        }
      };

      // Forward request to vault tab
      vaultClient.postMessage({
        type: 'EMBASSY_REQUEST_FORWARD',
        id: data.id,
        method: data.method,
        params: data.params
      }, [port2]);

    } catch (error) {
      console.error('[ServiceWorker] Error handling EMBASSY_REQUEST:', error);
      
      // Return error to bridge
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
          type: 'EMBASSY_RESPONSE',
          id: data.id,
          error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
        });
      }
    }
  }
});

console.log('[ServiceWorker] Vault service worker loaded');

