import { useMessaging, requireAuth, checkPermission, rateLimit, logger, validate } from '../services/messaging';

/**
 * Examples showing how the Express-style messaging API simplifies complex scenarios
 */

// Example 1: Simple handler
export const setupSimpleHandlers = () => {
  const msg = useMessaging();
  
  // Before: Complex setup with messenger.route()
  // After: Simple, clean handler
  msg.on('GET_PUBLIC_KEY', async () => {
    return localStorage.getItem('userPublicKey');
  });
  
  msg.on('GET_PROFILE', async (data) => {
    const { userId } = data;
    return await fetchUserProfile(userId);
  });
};

// Example 2: Protected endpoints with middleware
export const setupProtectedHandlers = () => {
  const msg = useMessaging();
  
  // Chain middleware for authentication and permissions
  msg.on('DELETE_ACCOUNT',
    requireAuth(),
    checkPermission('delete_account'),
    async (data, context) => {
      const user = context.metadata.user;
      console.log(`User ${user.username} deleting account`);
      return await deleteAccount(user.id);
    }
  );
  
  // Multiple middleware for complex scenarios
  msg.on('ADMIN_ACTION',
    requireAuth(),
    checkPermission('admin'),
    rateLimit(5, 60000), // 5 requests per minute
    logger(),
    async (data) => {
      return await performAdminAction(data);
    }
  );
};

// Example 3: Validation middleware
export const setupValidatedHandlers = () => {
  const msg = useMessaging();
  
  const userSchema = {
    username: 'required',
    email: 'required',
    age: (value: any) => value >= 18
  };
  
  msg.on('CREATE_USER',
    validate(userSchema),
    async (data) => {
      return await createUser(data);
    }
  );
};

// Example 4: Custom middleware
export const setupCustomMiddleware = () => {
  const msg = useMessaging();
  
  // Custom middleware to check subscription status
  const requireSubscription = async (data: any, context: any, next: () => Promise<any>) => {
    const user = context.metadata.user;
    const subscription = await checkSubscription(user.id);
    
    if (!subscription || subscription.status !== 'active') {
      throw new Error('Active subscription required');
    }
    
    context.metadata.subscription = subscription;
    return next();
  };
  
  // Custom middleware to log to external service
  const externalLogger = async (data: any, context: any, next: () => Promise<any>) => {
    const start = Date.now();
    try {
      const result = await next();
      await logToService({
        action: context.metadata.type,
        user: context.metadata.user?.id,
        duration: Date.now() - start,
        success: true
      });
      return result;
    } catch (error) {
      await logToService({
        action: context.metadata.type,
        user: context.metadata.user?.id,
        duration: Date.now() - start,
        success: false,
        error: error.message
      });
      throw error;
    }
  };
  
  msg.on('PREMIUM_FEATURE',
    requireAuth(),
    requireSubscription,
    externalLogger,
    async (data) => {
      return await usePremiumFeature(data);
    }
  );
};

// Example 5: Client-side usage
export const clientUsageExample = async () => {
  const msg = useMessaging();
  
  // Simple request
  const pubkey = await msg.request('GET_PUBLIC_KEY');
  
  // Request with data
  const profile = await msg.request('GET_PROFILE', { userId: '123' });
  
  // Request with timeout
  const result = await msg.request('LONG_OPERATION', { data: 'stuff' }, 60000); // 60 second timeout
  
  // One-way message (no response expected)
  msg.send('USER_LOGGED_IN', { timestamp: Date.now() });
  
  // Permission request to primary window
  const granted = await msg.callPrimary('REQUEST_PERMISSION', {
    origin: window.location.origin,
    method: 'signEvent',
    kinds: [1, 7]
  });
};

// Example 6: Error handling
export const setupErrorHandling = () => {
  const msg = useMessaging();
  
  // Middleware can throw errors that are automatically handled
  msg.on('SENSITIVE_ACTION',
    async (data, context, next) => {
      // Check some condition
      if (!isAllowed(context.origin)) {
        throw new Error('Origin not allowed');
      }
      return next();
    },
    async (data) => {
      // This won't run if middleware throws
      return await performSensitiveAction(data);
    }
  );
};

// Example 7: Conditional middleware
export const setupConditionalMiddleware = () => {
  const msg = useMessaging();
  
  // Middleware that only runs in production
  const productionOnly = async (data: any, context: any, next: () => Promise<any>) => {
    if (process.env.NODE_ENV !== 'production') {
      return next(); // Skip in development
    }
    
    // Production-only checks
    if (!context.origin.startsWith('https://')) {
      throw new Error('HTTPS required in production');
    }
    
    return next();
  };
  
  msg.on('SECURE_ACTION',
    productionOnly,
    requireAuth(),
    async (data) => {
      return await performSecureAction(data);
    }
  );
};

// Helper functions (would be implemented elsewhere)
async function fetchUserProfile(userId: string) { /* ... */ }
async function deleteAccount(userId: string) { /* ... */ }
async function performAdminAction(data: any) { /* ... */ }
async function createUser(data: any) { /* ... */ }
async function checkSubscription(userId: string) { /* ... */ }
async function logToService(data: any) { /* ... */ }
async function usePremiumFeature(data: any) { /* ... */ }
function isAllowed(origin: string) { /* ... */ }
async function performSensitiveAction(data: any) { /* ... */ }
async function performSecureAction(data: any) { /* ... */ }