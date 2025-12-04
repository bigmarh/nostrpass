/**
 * @nostrpass/messenger
 * Simple, secure iframe-to-parent messaging library with middleware support
 */

import { MessagePayload, PendingRequest, MiddlewareContext, MiddlewareHandler, RouteConfig } from './types';

export class SecureMessenger {
  protected pendingRequests = new Map<string, PendingRequest>();
  private messageHandlers = new Map<string, (data: any) => Promise<any> | any>();
  private allowedOrigins = new Set<string>();
  private isInitialized = false;
  private defaultTimeout = 30000; // 30 seconds
  protected verifiedResponseOrigin: string | null = null;

  constructor(private isParent: boolean = false,public window: any = window) {
    this.window = window;
    this.setupMessageListener();
  }

  // Initialize with allowed origins
  init(allowedOrigins: string[] = []): void {
    if (allowedOrigins.includes('*')) {
      console.warn('[SecureMessenger] WARNING: Using wildcard origin "*" is insecure. Messages will only be sent to verified origins.');
    }
    allowedOrigins.forEach(origin => this.allowedOrigins.add(origin));
    this.isInitialized = true;
  }

  // Add a message handler (simple mode)
  on(type: string, handler: (data: any) => Promise<any> | any): void {
    this.messageHandlers.set(type, handler);
  }

  // Remove a message handler
  off(type: string): void {
    this.messageHandlers.delete(type);
  }

  // Send a request and wait for response
  async request(type: string, data: any = null, timeout: number = this.defaultTimeout): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('SecureMessenger not initialized. Call init() first.');
    }

    const id = this.generateId();
    const message: MessagePayload = {
      id,
      type,
      data,
      timestamp: Date.now(),
      origin: this.window.location.origin
    };

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      // Store pending request
      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout: timeoutHandle
      });

      // Send message
      this.sendMessage(message);
    });
  }

  // Send a one-way message (no response expected)
  send(type: string, data: any = null): void {
    if (!this.isInitialized) {
      throw new Error('SecureMessenger not initialized. Call init() first.');
    }

    const message: MessagePayload = {
      id: this.generateId(),
      type,
      data,
      timestamp: Date.now(),
      origin: this.window.location.origin
    };

    this.sendMessage(message);
  }

  // Send a response to a request
  protected async sendResponse(originalMessage: MessagePayload, responseData: any, error?: string): Promise<void> {
    const responseMessage: MessagePayload = {
      id: originalMessage.id,
      type: `${originalMessage.type}_RESPONSE`,
      data: error ? { error } : responseData,
      timestamp: Date.now(),
      origin: this.window.location.origin
    };

    // Always use verified origin for responses
    this.sendMessage(responseMessage, this.verifiedResponseOrigin || undefined);
  }

  // Internal message sending
  private sendMessage(message: MessagePayload, targetOrigin?: string): void {
    const targetWindow = this.isParent ?
      (this.window as any).frames[0] || this.window.document.querySelector('iframe')?.contentWindow :
      this.window.parent;

    if (!targetWindow) {
      throw new Error('Target window not found');
    }

    // Determine the origin to use
    let origin: string;
    if (targetOrigin) {
      // Explicit target origin provided (preferred)
      origin = targetOrigin;
    } else if (this.verifiedResponseOrigin) {
      // Use verified origin from incoming message
      origin = this.verifiedResponseOrigin;
    } else if (this.allowedOrigins.size === 1 && !this.allowedOrigins.has('*')) {
      // Single allowed origin configured
      origin = Array.from(this.allowedOrigins)[0];
    } else {
      // Fallback: parent sends to iframe origin, iframe should have verified origin
      throw new Error('No verified origin available for sending message. Ensure handshake completed.');
    }

    targetWindow.postMessage(message, origin);
  }

  // Set up message listener
  private setupMessageListener(): void {
    this.window.addEventListener('message', async (event: MessageEvent) => {
      try {
        await this.handleMessage(event);
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });
  }

  // Handle incoming messages (can be overridden by subclasses)
  protected async handleMessage(event: MessageEvent): Promise<void> {
    // Validate origin
    if (!this.isOriginAllowed(event.origin)) {
      console.warn('Message from unauthorized origin:', event.origin);
      return;
    }

    // Store verified origin for responses (browser-guaranteed, cannot be spoofed)
    if (!this.verifiedResponseOrigin) {
      this.verifiedResponseOrigin = event.origin;
      console.log('[SecureMessenger] Locked to origin:', event.origin);
    } else if (this.verifiedResponseOrigin !== event.origin) {
      console.warn('Message from different origin than established:', event.origin);
      return;
    }

    const message = event.data as MessagePayload;

    // Validate message structure
    if (!this.isValidMessage(message)) {
      console.warn('Invalid message structure:', message);
      return;
    }

    // Check if this is a response to a pending request
    if (message.type.endsWith('_RESPONSE') && this.pendingRequests.has(message.id)) {
      this.handleResponse(message);
      return;
    }

    // Handle regular message with registered handler
    const handler = this.messageHandlers.get(message.type);
    if (!handler) {
      console.warn('No handler for message type:', message.type);
      return;
    }

    try {
      const result = await handler(message.data);
      // Only send response if this isn't already a response message
      if (!message.type.endsWith('_RESPONSE')) {
        await this.sendResponse(message, result);
      }
    } catch (error: any) {
      // Only send error response if this isn't already a response message
      if (!message.type.endsWith('_RESPONSE')) {
        const errMsg = error instanceof Error ? error.message : String(error);
        // Include optional error code if present on the error object
        const responseData: any = { error: errMsg };
        if (error && typeof error === 'object' && 'code' in error && error.code) {
          responseData.code = error.code;
        }
        const responseMessage = {
          id: message.id,
          type: `${message.type}_RESPONSE`,
          data: responseData,
          timestamp: Date.now(),
          origin: (this as any).window.location.origin
        };
        (this as any).sendMessage(responseMessage);
      }
    }
  }

  // Handle response messages
  protected handleResponse(message: MessagePayload): void {
    const pending = this.pendingRequests.get(message.id);
    if (!pending) return;

    // Clear timeout
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(message.id);

    // Resolve or reject based on response
    if (message.data && (message.data as any).error) {
      const errorObj: any = new Error((message.data as any).error);
      if ((message.data as any).code) {
        errorObj.code = (message.data as any).code;
      }
      pending.reject(errorObj);
    } else {
      pending.resolve(message.data);
    }
  }

  // Validate message structure
  protected isValidMessage(message: any): message is MessagePayload {
    return (
      message &&
      typeof message.id === 'string' &&
      typeof message.type === 'string' &&
      typeof message.timestamp === 'number' &&
      typeof message.origin === 'string' &&
      // Validate timestamp is recent (within 5 minutes)
      Math.abs(Date.now() - message.timestamp) < 5 * 60 * 1000
    );
  }

  // Check if origin is allowed
  protected isOriginAllowed(origin: string): boolean {
    if (!this.isInitialized) return false;
    // If wildcard is set, accept any origin (but we'll lock to first one)
    if (this.allowedOrigins.has('*')) return true;
    return this.allowedOrigins.has(origin);
  }

  // Generate unique message ID
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get the verified origin
  getVerifiedOrigin(): string | null {
    return this.verifiedResponseOrigin;
  }

  // Cleanup
  destroy(): void {
    // Clear all pending requests
    this.pendingRequests.forEach(({ timeout, reject }) => {
      clearTimeout(timeout);
      reject(new Error('Messenger destroyed'));
    });
    this.pendingRequests.clear();
    this.messageHandlers.clear();
    this.allowedOrigins.clear();
    this.verifiedResponseOrigin = null;
    this.isInitialized = false;
  }
}

// Enhanced messaging class with middleware support
export class SecureServerMessenger extends SecureMessenger {
  private routes = new Map<string, RouteConfig>();
  private globalMiddleware: MiddlewareHandler[] = [];

  constructor(isParent: boolean = false, windowObj: any = window) {
    super(isParent, windowObj);
  }

  // Add global middleware (runs for all routes)
  use(middleware: MiddlewareHandler): void {
    this.globalMiddleware.push(middleware);
  }

  // Register a route with optional middleware
  route(type: string, config: RouteConfig): void {
    this.routes.set(type, config);
  }

  // Handle incoming messages with middleware pipeline
  protected async handleMessage(event: MessageEvent): Promise<void> {
    // Validate origin
    if (!this.isOriginAllowed(event.origin)) {
      console.warn('Message from unauthorized origin:', event.origin);
      return;
    }

    // Store verified origin for responses (browser-guaranteed, cannot be spoofed)
    if (!this.verifiedResponseOrigin) {
      this.verifiedResponseOrigin = event.origin;
      console.log('[SecureServerMessenger] Locked to parent origin:', event.origin);
    } else if (this.verifiedResponseOrigin !== event.origin) {
      console.warn('Message from different origin than established:', event.origin);
      return;
    }

    const message = event.data as MessagePayload;

    // Validate message structure
    if (!this.isValidMessage(message)) {
      console.warn('Invalid message structure:', message);
      return;
    }

    // Check if this is a response to a pending request
    if (message.type.endsWith('_RESPONSE') && this.pendingRequests.has(message.id)) {
      this.handleResponse(message);
      return;
    }

    // Look for route
    const route = this.routes.get(message.type);
    if (!route) {
      console.warn('No route for message type:', message.type);
      return;
    }

    // Create context
    const context: MiddlewareContext = {
      type: message.type,
      data: message.data,
      origin: message.origin,
      timestamp: message.timestamp,
      metadata: {}
    };

    try {
      // Build middleware chain
      const middlewareChain = [...this.globalMiddleware, ...(route.middleware || [])];
      
      // Execute middleware chain
      const result = await this.executeMiddlewareChain(
        middlewareChain,
        context,
        () => route.handler(message.data, context)
      );

      // Only send response if this isn't already a response message
      if (!message.type.endsWith('_RESPONSE')) {
        await this.sendResponse(message, result);
      }
    } catch (error) {
      // Only send error response if this isn't already a response message
      if (!message.type.endsWith('_RESPONSE')) {
        await this.sendResponse(message, null, error instanceof Error ? error.message : String(error));
      }
    }
  }

  // Execute middleware chain
  private async executeMiddlewareChain(
    middleware: MiddlewareHandler[],
    context: MiddlewareContext,
    finalHandler: () => Promise<any>
  ): Promise<any> {
    let index = 0;

    const next = async (): Promise<any> => {
      if (index >= middleware.length) {
        return finalHandler();
      }

      const currentMiddleware = middleware[index++];
      return currentMiddleware(context, next);
    };

    return next();
  }
}

// Convenience functions for common use cases

// Parent window helper
export class ParentMessenger extends SecureMessenger {
  private iframe: HTMLIFrameElement | null = null;

  constructor(windowObj: any = window) {
    super(true, windowObj);
  }

  // Create and setup iframe
  createIframe(src: string, container?: HTMLElement): HTMLIFrameElement {
    this.iframe = document.createElement('iframe');
    this.iframe.src = src;
    this.iframe.style.cssText = `
      width: 100%;
      height: 600px;
      border: none;
      border-radius: 8px;
    `;

    const target = container || document.body;
    target.appendChild(this.iframe);

    // Wait for iframe to load before allowing messages
    this.iframe.addEventListener('load', () => {
      // Extract origin from src for security
      const iframeOrigin = new URL(src).origin;
      this.init([iframeOrigin]);
    });

    return this.iframe;
  }

  // Create hidden iframe (for Embassy use case)
  createHiddenIframe(src: string): HTMLIFrameElement {
    this.iframe = document.createElement('iframe');
    this.iframe.src = src;
    this.iframe.style.cssText = `
      position: fixed;
      top: -1000px;
      left: -1000px;
      width: 1px;
      height: 1px;
      border: none;
      opacity: 0;
      pointer-events: none;
    `;

    document.body.appendChild(this.iframe);

    this.iframe.addEventListener('load', () => {
      const iframeOrigin = new URL(src).origin;
      this.init([iframeOrigin]);
    });

    return this.iframe;
  }

  destroy(): void {
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
      this.iframe = null;
    }
    super.destroy();
  }
}

// Iframe helper with middleware support
export class IframeMessenger extends SecureServerMessenger {
  private onOriginVerifiedCallbacks: Array<(origin: string) => void> = [];
  private pendingReadySignal = false;

  constructor(windowObj: any = window) {
    super(false, windowObj);
  }

  // Initialize with parent origin - accepts '*' for dynamic origin locking
  initWithParent(allowedParentOrigins?: string[]): void {
    // Default to '*' which means "accept first message and lock to that origin"
    // This is safe because we use event.origin (browser-guaranteed) not message content
    const origins = allowedParentOrigins || ['*'];

    if (origins.includes('*')) {
      console.log('[IframeMessenger] Dynamic origin mode: will lock to first message origin');
    }

    this.init(origins);

    // For wildcard mode, defer IFRAME_READY until we receive first message
    // For specific origins, we can send immediately since we know the target
    if (!origins.includes('*') && origins.length === 1) {
      // Single specific origin - can send immediately
      this.send('IFRAME_READY', {
        origin: this.window.location.origin,
        timestamp: Date.now()
      });
    } else {
      // Wildcard or multiple origins - defer until origin is verified
      this.pendingReadySignal = true;
      console.log('[IframeMessenger] Ready signal deferred until origin established');
    }
  }

  // Override handleMessage to send pending ready signal after origin is verified
  protected async handleMessage(event: MessageEvent): Promise<void> {
    const wasUnverified = this.verifiedResponseOrigin === null;

    // Call parent handleMessage which will set verifiedResponseOrigin
    await super.handleMessage(event);

    // If origin was just verified and we have a pending ready signal, send it now
    if (wasUnverified && this.verifiedResponseOrigin !== null) {
      console.log('[IframeMessenger] Origin verified:', this.verifiedResponseOrigin);

      // Call any registered callbacks
      this.onOriginVerifiedCallbacks.forEach(cb => {
        try {
          cb(this.verifiedResponseOrigin!);
        } catch (e) {
          console.error('[IframeMessenger] Error in onOriginVerified callback:', e);
        }
      });
      this.onOriginVerifiedCallbacks = [];

      // Send deferred ready signal
      if (this.pendingReadySignal) {
        this.pendingReadySignal = false;
        try {
          this.send('IFRAME_READY', {
            origin: this.window.location.origin,
            timestamp: Date.now()
          });
          console.log('[IframeMessenger] Sent deferred IFRAME_READY signal');
        } catch (e) {
          console.error('[IframeMessenger] Failed to send deferred ready signal:', e);
        }
      }
    }
  }

  // Register a callback to be called when origin is verified
  onOriginVerified(callback: (origin: string) => void): void {
    if (this.verifiedResponseOrigin !== null) {
      // Origin already verified, call immediately
      callback(this.verifiedResponseOrigin);
    } else {
      // Defer until origin is verified
      this.onOriginVerifiedCallbacks.push(callback);
    }
  }

  // Verify that we're locked to an origin
  isOriginLocked(): boolean {
    return this.verifiedResponseOrigin !== null;
  }

  // Get the locked parent origin
  getParentOrigin(): string | null {
    return this.verifiedResponseOrigin;
  }
}

// Usage Examples:

/*
// Basic usage (without middleware):
const messenger = new ParentMessenger();
messenger.createHiddenIframe('https://identity-manager.com');

const pubkey = await messenger.request('GET_PUBLIC_KEY');

// Iframe side (without middleware):
const iframe = new IframeMessenger();
iframe.initWithParent(['https://app.com']);
iframe.on('GET_PUBLIC_KEY', () => currentUser.pubkey);

// Advanced usage (with middleware):
const identityManager = new IframeMessenger();

// Global middleware
identityManager.use(async (context, next) => {
  console.log(`Request: ${context.type} from ${context.origin}`);
  return next();
});

// Route with middleware
identityManager.route('SIGN_EVENT', {
  middleware: [
    async (context, next) => {
      if (!context.metadata.isLoggedIn) {
        throw new Error('Authentication required');
      }
      return next();
    },
    async (context, next) => {
      const confirmed = await showConfirmation(context.data);
      if (!confirmed) throw new Error('User denied');
      return next();
    }
  ],
  handler: async (data, context) => {
    return await signEvent(data);
  }
});
*/