/**
 * Dedicated Worker Transport (Mobile)
 *
 * Connects directly to the vault's Dedicated Worker for low-latency communication.
 * This is identical to SharedWorkerTransport, except it uses a Dedicated Worker
 * instead of a SharedWorker.
 *
 * Flow: Embassy → Dedicated Worker → Embassy
 *
 * Note: Like SharedWorker, this is SAME-ORIGIN ONLY. For cross-origin scenarios,
 * use the existing iframe+postMessage flow.
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

export class ServiceWorkerTransport implements VaultTransport {
  private worker: Worker | null = null;
  private connected = false;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestTimeout = 30000; // 30 seconds

  async connect(): Promise<void> {
    if (this.connected) {
      console.log('[DedicatedWorkerTransport] Already connected');
      return;
    }

    console.log('[DedicatedWorkerTransport] Connecting to vault Dedicated Worker...');

    try {
      // Create Dedicated Worker connection to vault's crypto worker
      const workerUrl = `${VAULT_ORIGIN}/crypto.worker.js`;
      this.worker = new Worker(workerUrl, { name: 'nostrpass-vault-worker-mobile' });

      // Set up message handler
      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onmessageerror = this.handleMessageError.bind(this);

      this.connected = true;
      console.log('[DedicatedWorkerTransport] Connected to vault Dedicated Worker');
    } catch (error) {
      console.error('[DedicatedWorkerTransport] Failed to connect:', error);
      throw new TransportError(
        'Failed to connect to vault Dedicated Worker',
        'CONNECTION_FAILED',
        error
      );
    }
  }

  async request<T = any>(method: string, params?: any): Promise<T> {
    if (!this.connected || !this.worker) {
      throw new TransportDisconnectedError();
    }

    const requestId = this.generateRequestId();

    console.log(`[DedicatedWorkerTransport] Sending request ${requestId}:`, method, params);

    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new TransportTimeoutError(method, this.requestTimeout));
      }, this.requestTimeout);

      // Store pending request
      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Send request to worker (using worker-messenger protocol format)
      try {
        this.worker!.postMessage({
          id: requestId,
          method,
          params,
          timestamp: Date.now()
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
    console.log('[DedicatedWorkerTransport] Disconnecting...');

    // Reject all pending requests
    for (const [, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new TransportDisconnectedError());
    }
    this.pendingRequests.clear();

    // Terminate worker
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.connected = false;

    console.log('[DedicatedWorkerTransport] Disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  private handleMessage(event: MessageEvent): void {
    const { id, result, error } = event.data;

    console.log(`[DedicatedWorkerTransport] Received message:`, event.data);

    // worker-messenger responses have id + (result or error)
    if (id && ('result' in event.data || 'error' in event.data)) {
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
    console.error('[DedicatedWorkerTransport] Message error:', event);
    // Message errors typically indicate serialization issues
    // We can't easily map this back to a specific request, so we log it
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}
