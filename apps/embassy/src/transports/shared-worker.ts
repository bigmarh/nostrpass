/**
 * SharedWorker Transport
 *
 * Desktop transport that connects directly to the vault's SharedWorker.
 * Provides low-latency communication for desktop browsers.
 */

import {
  VaultTransport,
  VAULT_ORIGIN,
  TransportError,
  TransportTimeoutError,
  TransportDisconnectedError
} from './index';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class SharedWorkerTransport implements VaultTransport {
  private worker: SharedWorker | null = null;
  private port: MessagePort | null = null;
  private connected = false;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestTimeout = 30000; // 30 seconds

  async connect(): Promise<void> {
    if (this.connected) {
      console.log('[SharedWorkerTransport] Already connected');
      return;
    }

    console.log('[SharedWorkerTransport] Connecting to vault SharedWorker...');

    try {
      // Create SharedWorker connection to vault's crypto worker
      const workerUrl = `${VAULT_ORIGIN}/crypto.worker.js`;
      this.worker = new SharedWorker(workerUrl, { name: 'nostrpass-vault-worker' });
      this.port = this.worker.port;

      // Set up message handler
      this.port.onmessage = this.handleMessage.bind(this);
      this.port.onmessageerror = this.handleMessageError.bind(this);

      // Start the port
      this.port.start();

      this.connected = true;
      console.log('[SharedWorkerTransport] Connected to vault SharedWorker');
    } catch (error) {
      console.error('[SharedWorkerTransport] Failed to connect:', error);
      throw new TransportError(
        'Failed to connect to vault SharedWorker',
        'CONNECTION_FAILED',
        error
      );
    }
  }

  async request<T = any>(method: string, params?: any): Promise<T> {
    if (!this.connected || !this.port) {
      throw new TransportDisconnectedError();
    }

    const requestId = this.generateRequestId();

    console.log(`[SharedWorkerTransport] Sending request ${requestId}:`, method, params);

    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new TransportTimeoutError(method, this.requestTimeout));
      }, this.requestTimeout);

      // Store pending request
      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Send request to worker
      try {
        this.port!.postMessage({
          id: requestId,
          type: 'request',
          method,
          params
        });
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
    console.log('[SharedWorkerTransport] Disconnecting...');

    // Reject all pending requests
    for (const [requestId, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new TransportDisconnectedError());
    }
    this.pendingRequests.clear();

    // Close port
    if (this.port) {
      this.port.close();
      this.port = null;
    }

    this.worker = null;
    this.connected = false;

    console.log('[SharedWorkerTransport] Disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  private handleMessage(event: MessageEvent): void {
    const { id, type, result, error } = event.data;

    console.log(`[SharedWorkerTransport] Received message:`, event.data);

    if (type === 'response' && id) {
      const pending = this.pendingRequests.get(id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(id);

        if (error) {
          pending.reject(new TransportError(
            error.message || 'Request failed',
            error.code || 'REQUEST_FAILED',
            error
          ));
        } else {
          pending.resolve(result);
        }
      }
    }
  }

  private handleMessageError(event: MessageEvent): void {
    console.error('[SharedWorkerTransport] Message error:', event);
    // Message errors typically indicate serialization issues
    // We can't easily map this back to a specific request, so we log it
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}
