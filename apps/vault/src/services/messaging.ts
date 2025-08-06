import { useMessenger } from '../providers/MessengerProvider';
import type { IframeMessenger } from '@nostrpass/messenger';

/**
 * Express-style messaging API
 * 
 * Example usage:
 * 
 * const msg = useMessaging();
 * 
 * // Simple handler
 * msg.on('GET_PUBLIC_KEY', async () => {
 *   return user.publicKey;
 * });
 * 
 * // Handler with middleware
 * msg.on('SIGN_EVENT', 
 *   requireAuth,
 *   checkPermission('signEvent'),
 *   async (data) => {
 *     return await signEvent(data.event);
 *   }
 * );
 * 
 * // Send request
 * const pubkey = await msg.request('GET_PUBLIC_KEY');
 * 
 * // Send one-way message
 * msg.send('USER_LOGGED_IN', { username: 'alice' });
 */

type Handler<T = any, R = any> = (data: T, context?: MessageContext) => Promise<R> | R;
type Middleware<T = any> = (data: T, context: MessageContext, next: () => Promise<any>) => Promise<any>;

interface MessageContext {
  origin: string;
  timestamp: number;
  metadata: Record<string, any>;
}

class MessagingAPI {
  constructor(private messenger: IframeMessenger) {}

  /**
   * Register a message handler with optional middleware
   * 
   * @example
   * msg.on('GET_USER', async (data) => {
   *   return await getUser(data.id);
   * });
   * 
   * @example with middleware
   * msg.on('DELETE_USER', requireAuth, requireAdmin, async (data) => {
   *   return await deleteUser(data.id);
   * });
   */
  on<T = any, R = any>(
    type: string, 
    ...args: [...Middleware<T>[], Handler<T, R>] | [Handler<T, R>]
  ): void {
    const handlers = args as any[];
    const mainHandler = handlers[handlers.length - 1] as Handler<T, R>;
    const middlewares = handlers.slice(0, -1) as Middleware<T>[];

    this.messenger.route(type, {
      middleware: middlewares.map(mw => 
        async (context: any, next: any) => {
          return mw(context.data, context, next);
        }
      ),
      handler: async (data: T, context: any) => {
        return mainHandler(data, context);
      }
    });
  }

  /**
   * Send a request and wait for response
   * 
   * @example
   * const result = await msg.request('GET_USER', { id: 123 });
   */
  async request<T = any, R = any>(type: string, data?: T, timeout?: number): Promise<R> {
    return this.messenger.request(type, data, timeout);
  }

  /**
   * Send a one-way message
   * 
   * @example
   * msg.send('USER_UPDATED', { id: 123, name: 'Alice' });
   */
  send<T = any>(type: string, data?: T): void {
    this.messenger.send(type, data);
  }

  /**
   * Remove a handler
   */
  off(type: string): void {
    // This would need to be implemented in the base messenger
    // For now, we can track handlers separately if needed
  }

  /**
   * Call the primary window (useful for permission requests)
   * 
   * @example
   * const granted = await msg.callPrimary('REQUEST_PERMISSION', {
   *   origin: 'https://app.com',
   *   method: 'signEvent'
   * });
   */
  async callPrimary<T = any, R = any>(type: string, data?: T): Promise<R> {
    return this.messenger.callPrimary(type, data);
  }
}

// Common middleware factories

/**
 * Require authentication middleware
 * 
 * @example
 * msg.on('PROTECTED_ACTION', requireAuth(), async (data) => { ... });
 */
export const requireAuth = (getCurrentUser?: () => any) => {
  return async (data: any, context: MessageContext, next: () => Promise<any>) => {
    const user = getCurrentUser ? getCurrentUser() : (window as any).currentUser;
    if (!user) {
      throw new Error('Authentication required');
    }
    context.metadata.user = user;
    return next();
  };
};

/**
 * Check permission middleware
 * 
 * @example
 * msg.on('SIGN_EVENT', checkPermission('signEvent'), async (data) => { ... });
 */
export const checkPermission = (permission: string, checkFn?: (origin: string, permission: string) => Promise<boolean>) => {
  return async (data: any, context: MessageContext, next: () => Promise<any>) => {
    const allowed = checkFn 
      ? await checkFn(context.origin, permission)
      : true; // Default implementation would go here
    
    if (!allowed) {
      throw new Error(`Permission denied for ${permission}`);
    }
    
    return next();
  };
};

/**
 * Rate limiting middleware
 * 
 * @example
 * msg.on('EXPENSIVE_OP', rateLimit(10, 60000), async (data) => { ... });
 */
export const rateLimit = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, number[]>();
  
  return async (data: any, context: MessageContext, next: () => Promise<any>) => {
    const key = `${context.origin}_${context.metadata.type || 'default'}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get existing requests for this key
    const keyRequests = requests.get(key) || [];
    
    // Filter out old requests
    const recentRequests = keyRequests.filter(time => time > windowStart);
    
    if (recentRequests.length >= maxRequests) {
      throw new Error('Rate limit exceeded');
    }
    
    // Add current request
    recentRequests.push(now);
    requests.set(key, recentRequests);
    
    return next();
  };
};

/**
 * Logging middleware
 * 
 * @example
 * msg.on('ANY_ACTION', logger(), async (data) => { ... });
 */
export const logger = (logFn?: (message: string) => void) => {
  const log = logFn || console.log;
  
  return async (data: any, context: MessageContext, next: () => Promise<any>) => {
    const start = Date.now();
    log(`[${new Date().toISOString()}] ${context.origin} -> ${context.metadata.type || 'unknown'}`);
    
    try {
      const result = await next();
      log(`[${new Date().toISOString()}] Success (${Date.now() - start}ms)`);
      return result;
    } catch (error) {
      log(`[${new Date().toISOString()}] Error (${Date.now() - start}ms): ${error}`);
      throw error;
    }
  };
};

/**
 * Validation middleware
 * 
 * @example
 * msg.on('CREATE_USER', validate(userSchema), async (data) => { ... });
 */
export const validate = (schema: any) => {
  return async (data: any, context: MessageContext, next: () => Promise<any>) => {
    // Simple validation - could be replaced with Zod, Yup, etc.
    if (!schema || typeof schema !== 'object') {
      throw new Error('Invalid schema');
    }
    
    // Basic validation implementation
    for (const [key, rule] of Object.entries(schema)) {
      if (typeof rule === 'string' && rule === 'required' && !data[key]) {
        throw new Error(`${key} is required`);
      }
      // Add more validation rules as needed
    }
    
    return next();
  };
};

// Hook for easy usage in components
let messagingInstance: MessagingAPI | null = null;

export const useMessaging = (): MessagingAPI => {
  const { messenger } = useMessenger();
  
  if (!messenger) {
    throw new Error('Messenger not initialized');
  }
  
  // Create singleton instance
  if (!messagingInstance) {
    messagingInstance = new MessagingAPI(messenger);
  }
  
  return messagingInstance;
};

// Standalone function for non-component usage
export const createMessaging = (messenger: IframeMessenger): MessagingAPI => {
  return new MessagingAPI(messenger);
};