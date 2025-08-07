import type {
  WorkerRequest,
  WorkerResponse,
  WorkerMessageHandlers,
  WorkerMessengerOptions,
  WorkerError,
} from './types';

export class WorkerMessenger {
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }>();

  private worker: Worker | null = null;
  private handlers: WorkerMessageHandlers = {};
  private options: Required<WorkerMessengerOptions>;
  private isWorkerContext: boolean;

  constructor(options: WorkerMessengerOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 30000,
      onError: options.onError ?? console.error,
    };

    // Check if we're in a worker context
    this.isWorkerContext = typeof self !== 'undefined' && 
                                                       typeof (globalThis as any).WorkerGlobalScope !== 'undefined' && 
                            self instanceof (globalThis as any).WorkerGlobalScope;

    if (this.isWorkerContext) {
      self.addEventListener('message', this.handleMessage);
      self.addEventListener('error', this.handleError);
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

  public registerHandlers(handlers: WorkerMessageHandlers) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  public async call<TParams = unknown, TResult = unknown>(
    method: string,
    params?: TParams
  ): Promise<TResult> {
    if (!this.worker) {
      throw new Error('Worker not initialized. Call setWorker() first.');
    }

    const id = crypto.randomUUID();
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
      this.worker!.postMessage(request);
    });
  }

  private handleMessage = async (event: MessageEvent) => {
    console.log('[WorkerMessenger] Received message:', event.data);
    const data = event.data;

    if (this.isRequest(data)) {
      console.log('[WorkerMessenger] Processing as request');
      await this.handleRequest(data);
    } else if (this.isResponse(data)) {
      console.log('[WorkerMessenger] Processing as response');
      this.handleResponse(data);
    } else {
      console.log('[WorkerMessenger] Unknown message type:', typeof data, data);
    }
  };

  private handleError = (error: ErrorEvent) => {
    this.options.onError(new Error(error.message));
  };

  private async handleRequest(request: WorkerRequest) {
    console.log('[WorkerMessenger] Handling request:', request.method, request.id);
    const handler = this.handlers[request.method];
    
    if (!handler) {
      console.log('[WorkerMessenger] Handler not found for method:', request.method);
      this.sendResponse(request.id, null, {
        code: 'METHOD_NOT_FOUND',
        message: `Method "${request.method}" not found`,
      });
      return;
    }

    try {
      console.log('[WorkerMessenger] Calling handler for method:', request.method);
      const result = await handler(request.params);
      console.log('[WorkerMessenger] Handler completed successfully for method:', request.method);
      this.sendResponse(request.id, result);
    } catch (error) {
      console.error('[WorkerMessenger] Handler error for method:', request.method, error);
      this.sendResponse(request.id, null, {
        code: 'HANDLER_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        data: error,
      });
    }
  }

  private handleResponse(response: WorkerResponse) {
    console.log('[WorkerMessenger] Received response for request:', response.id, 'error:', !!response.error);
    const pending = this.pendingRequests.get(response.id);
    
    if (!pending) {
      console.log('[WorkerMessenger] No pending request found for response:', response.id);
      return;
    }

    console.log('[WorkerMessenger] Resolving pending request:', response.id);
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.error) {
      console.log('[WorkerMessenger] Rejecting request with error:', response.error.message);
      pending.reject(new Error(response.error.message));
    } else {
      console.log('[WorkerMessenger] Resolving request with result');
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

    console.log('[WorkerMessenger] Sending response for request:', id, 'error:', !!error);

    if (this.isWorkerContext) {
      self.postMessage(response);
    } else if (this.worker) {
      this.worker.postMessage(response);
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