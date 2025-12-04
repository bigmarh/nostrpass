/**
 * ServiceWorker Transport
 *
 * Mobile transport that communicates with the vault via ServiceWorker and iframe bridge.
 * Flow: Embassy → Hidden iframe → ServiceWorker → Vault tab → ServiceWorker → iframe → Embassy
 *
 * This enables cross-tab communication on mobile browsers where SharedWorker is not available.
 */

import {
  VaultTransport,
  VAULT_ORIGIN,
  TransportError,
  TransportTimeoutError,
  TransportDisconnectedError,
  VaultNotOpenError
} from './index';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class ServiceWorkerTransport implements VaultTransport {
  private iframe: HTMLIFrameElement | null = null;
  private connected = false;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestTimeout = 30000; // 30 seconds
  private messageHandler: ((event: MessageEvent) => void) | null = null;

  async connect(): Promise<void> {
    if (this.connected) {
      console.log('[ServiceWorkerTransport] Already connected');
      return;
    }

    console.log('[ServiceWorkerTransport] Connecting via iframe bridge...');

    try {
      // Create hidden iframe that loads the embassy bridge page from vault origin
      this.iframe = document.createElement('iframe');
      this.iframe.src = `${VAULT_ORIGIN}/embassy-bridge.html`;
      this.iframe.style.display = 'none';
      this.iframe.style.position = 'absolute';
      this.iframe.style.width = '0';
      this.iframe.style.height = '0';
      this.iframe.style.border = 'none';

      // Wait for iframe to load
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new TransportError(
            'Iframe bridge failed to load',
            'IFRAME_LOAD_TIMEOUT'
          ));
        }, 10000);

        this.iframe!.onload = () => {
          clearTimeout(timeout);
          resolve();
        };

        this.iframe!.onerror = () => {
          clearTimeout(timeout);
          reject(new TransportError(
            'Failed to load iframe bridge',
            'IFRAME_LOAD_FAILED'
          ));
        };

        document.body.appendChild(this.iframe!);
      });

      // Set up message handler
      this.messageHandler = this.handleMessage.bind(this);
      window.addEventListener('message', this.messageHandler);

      this.connected = true;
      console.log('[ServiceWorkerTransport] Connected via iframe bridge');
    } catch (error) {
      console.error('[ServiceWorkerTransport] Failed to connect:', error);
      this.cleanup();
      throw new TransportError(
        'Failed to connect to vault via ServiceWorker',
        'CONNECTION_FAILED',
        error
      );
    }
  }

  async request<T = any>(method: string, params?: any): Promise<T> {
    if (!this.connected || !this.iframe) {
      throw new TransportDisconnectedError();
    }

    const requestId = this.generateRequestId();

    console.log(`[ServiceWorkerTransport] Sending request ${requestId}:`, method, params);

    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new TransportTimeoutError(method, this.requestTimeout));
      }, this.requestTimeout);

      // Store pending request
      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Send request to iframe bridge
      try {
        const message = {
          source: 'embassy',
          id: requestId,
          type: 'request',
          method,
          params
        };

        this.iframe!.contentWindow!.postMessage(message, VAULT_ORIGIN);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(new TransportError(
          'Failed to send request',
          'SEND_FAILED',
          error
        ));
      }
    });
  }

  disconnect(): void {
    console.log('[ServiceWorkerTransport] Disconnecting...');

    // Reject all pending requests
    for (const [requestId, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new TransportDisconnectedError());
    }
    this.pendingRequests.clear();

    this.cleanup();

    console.log('[ServiceWorkerTransport] Disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  private handleMessage(event: MessageEvent): void {
    // Only accept messages from the vault origin
    if (event.origin !== VAULT_ORIGIN) {
      return;
    }

    const { source, id, type, result, error } = event.data;

    // Only handle messages from the bridge iframe
    if (source !== 'embassy-bridge') {
      return;
    }

    console.log(`[ServiceWorkerTransport] Received message:`, event.data);

    if (type === 'response' && id) {
      const pending = this.pendingRequests.get(id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(id);

        if (error) {
          // Check for specific error codes
          if (error.code === 'VAULT_NOT_OPEN') {
            pending.reject(new VaultNotOpenError());
          } else {
            pending.reject(new TransportError(
              error.message || 'Request failed',
              error.code || 'REQUEST_FAILED',
              error
            ));
          }
        } else {
          pending.resolve(result);
        }
      }
    }
  }

  private cleanup(): void {
    // Remove message handler
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }

    // Remove iframe
    if (this.iframe) {
      if (this.iframe.parentNode) {
        this.iframe.parentNode.removeChild(this.iframe);
      }
      this.iframe = null;
    }

    this.connected = false;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}
