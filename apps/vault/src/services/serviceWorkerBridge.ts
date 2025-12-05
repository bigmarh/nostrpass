/**
 * Service Worker Bridge
 * 
 * Connects the Service Worker to the crypto worker instance.
 * Listens for EMBASSY_REQUEST_FORWARD messages from the Service Worker
 * and forwards them to the crypto worker.
 */

interface EmbassyRequestForward {
  type: 'EMBASSY_REQUEST_FORWARD';
  id: string;
  method: string;
  params: any;
}

interface EmbassyResponseForward {
  type: 'EMBASSY_RESPONSE_FORWARD';
  id: string;
  result?: any;
  error?: string;
}

/**
 * Setup the service worker bridge
 * @param cryptoWorker - The crypto worker client instance
 */
export function setupServiceWorkerBridge(cryptoWorker: any): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('[ServiceWorkerBridge] ServiceWorker not available');
    return;
  }

  console.log('[ServiceWorkerBridge] Setting up bridge');

  // Listen for messages from Service Worker (sent via postMessage to window)
  window.addEventListener('message', async (event: MessageEvent) => {
    const data = event.data as EmbassyRequestForward;

    if (data.type === 'EMBASSY_REQUEST_FORWARD') {
      console.log('[ServiceWorkerBridge] Received EMBASSY_REQUEST_FORWARD:', data);

      try {
        // Extract method and params
        const { method, params, id } = data;

        // Check if method exists on crypto worker
        if (typeof cryptoWorker[method] !== 'function') {
          throw new Error(`Method ${method} not found on crypto worker`);
        }

        // Call crypto worker method
        const result = await cryptoWorker[method](params);

        console.log('[ServiceWorkerBridge] Crypto worker result:', result);

        // Send result back via MessagePort
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            type: 'EMBASSY_RESPONSE_FORWARD',
            id,
            result
          });
        }
      } catch (error) {
        console.error('[ServiceWorkerBridge] Error processing request:', error);

        // Send error back via MessagePort
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            type: 'EMBASSY_RESPONSE_FORWARD',
            id: data.id,
            error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
          });
        }
      }
    }
  });

  console.log('[ServiceWorkerBridge] Bridge setup complete');
}

