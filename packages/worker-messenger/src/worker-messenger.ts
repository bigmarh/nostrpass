import type {
  WorkerRequest,
  WorkerResponse,
  WorkerMessageHandlers,
  WorkerMessengerOptions,
  WorkerError,
} from './types';

/**
 * Generate a UUID with fallback for environments without crypto.randomUUID
 * (e.g., non-secure contexts on mobile browsers)
 */
function generateUUID(): string {
  // Try native crypto.randomUUID first
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: Generate RFC4122 v4 UUID manually
  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const getRandomValues = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? (arr: Uint8Array) => crypto.getRandomValues(arr)
    : (arr: Uint8Array) => {
        // Final fallback using Math.random (less secure but works everywhere)
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      };

  const bytes = new Uint8Array(16);
  getRandomValues(bytes);

  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10

  // Convert to hex string with dashes
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export class WorkerMessenger {
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }>();

  private worker: Worker | null = null;
  private port: MessagePort | null = null;
  private ports: Set<MessagePort> = new Set();
  private requestPortMap: Map<string, MessagePort> = new Map();
  private handlers: WorkerMessageHandlers = {};
  private options: Required<WorkerMessengerOptions>;
  private isWorkerContext: boolean;
  private isSharedWorkerContext: boolean;
  private debugEnabled: boolean;

  constructor(options: WorkerMessengerOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 30000,
      onError: options.onError ?? console.error,
      debug: options.debug ?? false,
    } as Required<WorkerMessengerOptions>;

    this.debugEnabled = !!this.options.debug;

    // Check if we're in a worker context
    const hasWorkerGlobal = typeof self !== 'undefined' && typeof (globalThis as any).WorkerGlobalScope !== 'undefined';
    this.isWorkerContext = hasWorkerGlobal && self instanceof (globalThis as any).WorkerGlobalScope;
    this.isSharedWorkerContext = typeof (globalThis as any).SharedWorkerGlobalScope !== 'undefined' &&
      (typeof self !== 'undefined') && (self instanceof (globalThis as any).SharedWorkerGlobalScope);

    if (this.isWorkerContext && !this.isSharedWorkerContext) {
      // Dedicated worker
      self.addEventListener('message', this.handleMessage);
      self.addEventListener('error', this.handleError);
    }
    
    if (this.isSharedWorkerContext) {
      // Shared worker: listen for connections, attach per-port listeners
      (self as any).addEventListener('connect', (event: MessageEvent) => {
        const port: MessagePort = (event as any).ports[0];
        try { port.start(); } catch {}
        this.ports.add(port);
        const boundHandler = (ev: MessageEvent) => this.handleMessage(ev, port);
        port.addEventListener('message', boundHandler as any);
        // No explicit error API for MessagePort; rely on call timeouts
      });
    }
  }

  public setWorker(worker: Worker) {
    if (this.worker) {
      this.worker.removeEventListener('message', this.handleMessage);
      this.worker.removeEventListener('error', this.handleError);
    }

    this.worker = worker;
    this.worker.addEventListener('message', this.handleMessage);
    this.worker.addEventListener('error', this.handleError);
  }

  // For SharedWorker clients
  public setPort(port: MessagePort) {
    if (this.port) {
      this.port.removeEventListener('message', this.handleMessage as any);
    }
    this.port = port;
    // MessagePort requires start() before receiving messages in some browsers
    try { this.port.start(); } catch {}
    this.port.addEventListener('message', this.handleMessage as any);
  }

  public registerHandlers(handlers: WorkerMessageHandlers) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  public async call<TParams = unknown, TResult = unknown>(
    method: string,
    params?: TParams
  ): Promise<TResult> {
    if (!this.worker && !this.port) {
      throw new Error('Worker/Port not initialized. Call setWorker() or setPort() first.');
    }

    const id = generateUUID();
    const request: WorkerRequest<TParams> = {
      id,
      method,
      params,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Worker request timeout: ${method}`));
      }, this.options.timeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      if (this.worker) {
        this.worker.postMessage(request);
      } else if (this.port) {
        this.port.postMessage(request);
      }
    });
  }

  private handleMessage = async (event: MessageEvent, sourcePort?: MessagePort) => {
    if (this.debugEnabled) console.log('[WorkerMessenger] Received message:', event.data);
    const data = event.data;

    if (this.isRequest(data)) {
      if (this.debugEnabled) console.log('[WorkerMessenger] Processing as request');
      // Track which port this request came from (SharedWorker)
      if (sourcePort && data && typeof data.id === 'string') {
        this.requestPortMap.set(data.id, sourcePort);
      }
      await this.handleRequest(data);
    } else if (this.isResponse(data)) {
      if (this.debugEnabled) console.log('[WorkerMessenger] Processing as response');
      this.handleResponse(data);
    } else {
      if (this.debugEnabled) console.log('[WorkerMessenger] Unknown message type:', typeof data, data);
    }
  };

  private handleError = (error: ErrorEvent) => {
    this.options.onError(new Error(error.message));
  };

  private async handleRequest(request: WorkerRequest) {
    if (this.debugEnabled) console.log('[WorkerMessenger] Handling request:', request.method, request.id);
    const handler = this.handlers[request.method];
    
    if (!handler) {
      if (this.debugEnabled) console.log('[WorkerMessenger] Handler not found for method:', request.method);
      this.sendResponse(request.id, null, {
        code: 'METHOD_NOT_FOUND',
        message: `Method "${request.method}" not found`,
      });
      return;
    }

    try {
      if (this.debugEnabled) console.log('[WorkerMessenger] Calling handler for method:', request.method);
      const result = await handler(request.params);
      if (this.debugEnabled) console.log('[WorkerMessenger] Handler completed successfully for method:', request.method);
      this.sendResponse(request.id, result);
    } catch (error) {
      console.error('[WorkerMessenger] Handler error for method:', request.method, error);
      const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
      this.sendResponse(request.id, null, {
        code: 'HANDLER_ERROR',
        message,
        data: error,
      });
    }
  }

  private handleResponse(response: WorkerResponse) {
    if (this.debugEnabled) console.log('[WorkerMessenger] Received response for request:', response.id, 'error:', !!response.error);
    const pending = this.pendingRequests.get(response.id);
    
    if (!pending) {
      if (this.debugEnabled) console.log('[WorkerMessenger] No pending request found for response:', response.id);
      return;
    }

    if (this.debugEnabled) console.log('[WorkerMessenger] Resolving pending request:', response.id);
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.error) {
      if (this.debugEnabled) console.log('[WorkerMessenger] Rejecting request with error:', response.error.message);
      pending.reject(new Error(response.error.message));
    } else {
      if (this.debugEnabled) console.log('[WorkerMessenger] Resolving request with result');
      pending.resolve(response.result);
    }
  }

  private sendResponse(id: string, result: unknown, error?: WorkerError) {
    const response: WorkerResponse = {
      id,
      result,
      error,
      timestamp: Date.now(),
    };

    if (this.debugEnabled) console.log('[WorkerMessenger] Sending response for request:', id, 'error:', !!error);

    if (this.isSharedWorkerContext) {
      const targetPort = this.requestPortMap.get(id);
      if (targetPort) {
        targetPort.postMessage(response);
        this.requestPortMap.delete(id);
        return;
      }
      // Fallback: broadcast to all ports (shouldn't happen if request id mapping exists)
      this.ports.forEach((p) => p.postMessage(response));
    } else if (this.isWorkerContext) {
      (self as any).postMessage(response);
    } else if (this.worker) {
      this.worker.postMessage(response);
    } else if (this.port) {
      this.port.postMessage(response);
    }
  }

  private isRequest(data: any): data is WorkerRequest {
    return data && typeof data.id === 'string' && typeof data.method === 'string';
  }

  private isResponse(data: any): data is WorkerResponse {
    return data && typeof data.id === 'string' && 
           ('result' in data || 'error' in data);
  }

  public destroy() {
    if (this.worker) {
      this.worker.removeEventListener('message', this.handleMessage);
      this.worker.removeEventListener('error', this.handleError);
      this.worker = null;
    }

    if (this.isWorkerContext) {
      self.removeEventListener('message', this.handleMessage);
      self.removeEventListener('error', this.handleError);
    }

    for (const [_id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Worker messenger destroyed'));
    }
    
    this.pendingRequests.clear();
  }
}