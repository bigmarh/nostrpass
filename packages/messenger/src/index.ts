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

  constructor(private isParent: boolean = false,public window: any = window) {
    this.window = window;
    this.setupMessageListener();
  }

  // Initialize with allowed origins
  init(allowedOrigins: string[] = ['*']): void {
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

    this.sendMessage(responseMessage);
  }

  // Internal message sending
  private sendMessage(message: MessagePayload): void {
    const targetWindow = this.isParent ? 
      (this.window as any).frames[0] || this.window.document.querySelector('iframe')?.contentWindow :
      this.window.parent;

    if (!targetWindow) {
      throw new Error('Target window not found');
    }

    // Send to all allowed origins or specific origin
    if (this.allowedOrigins.has('*')) {
      targetWindow.postMessage(message, '*');
    } else {
      this.allowedOrigins.forEach(origin => {
        targetWindow.postMessage(message, origin);
      });
    }
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
    } catch (error) {
      // Only send error response if this isn't already a response message
      if (!message.type.endsWith('_RESPONSE')) {
        await this.sendResponse(message, null, error instanceof Error ? error.message : String(error));
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
    if (message.data && message.data.error) {
      pending.reject(new Error(message.data.error));
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
    return this.allowedOrigins.has('*') || this.allowedOrigins.has(origin);
  }

  // Generate unique message ID
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
  constructor(windowObj: any = window) {
    super(false, windowObj);
  }

  // Initialize with parent origin
  initWithParent(allowedParentOrigins?: string[]): void {
    // If no origins specified, try to detect parent origin
    if (!allowedParentOrigins) {
      // In development, allow localhost
      if (this.window.location.hostname === 'localhost' || this.window.location.hostname === '127.0.0.1') {
        allowedParentOrigins = ['http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:3000'];
      } else {
        // In production, you should specify allowed origins explicitly
        throw new Error('Must specify allowed parent origins in production');
      }
    }

    this.init(allowedParentOrigins);

    // Send ready signal to parent
    this.send('IFRAME_READY', {
      origin: this.window.location.origin,
      timestamp: Date.now()
    });
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