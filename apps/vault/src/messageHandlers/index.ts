import { IframeMessenger } from '@nostrpass/messenger';
import { Msg, type PermissionLevel } from '@nostrpass/types';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';
import { authHandlers } from './authHandlers';
import { vaultHandlers } from './vaultHandlers';
import { permissionHandlers } from './permissionHandlers';
import { vaultError, ErrorCode } from './errors';

export function setupMessageHandlers(
  messenger: IframeMessenger,
  dependencies: MessageHandlerDependencies
) {
  console.error('🚨🚨🚨 setupMessageHandlers() CALLED AT', new Date().toISOString());
  console.error('🚨 messenger instance:', messenger);
  console.error('🚨 dependencies:', Object.keys(dependencies));
  
  // Global middleware: enrich context.metadata with origin details
  messenger.use(async (context, next) => {
    context.metadata = context.metadata || {};
    context.metadata.origin = context.origin;
    try {
      const u = new URL(context.origin);
      context.metadata.appHost = u.host;
      context.metadata.appKey = sanitizeDomain(u.host);
    } catch {
      context.metadata.appHost = context.origin;
      context.metadata.appKey = sanitizeDomain(context.origin);
    }
    return next();
  });

  // Global middleware: basic auth presence check for protected routes
  const protectedRoutes = new Set<string>([
    Msg.GET_PUBLIC_KEY,
    Msg.SIGN_EVENT,
    Msg.SIGN_DATA,
    Msg.ENCRYPT,
    Msg.DECRYPT,
    Msg.GET_RELAYS
  ]);

  messenger.use(async (context, next) => {
    if (protectedRoutes.has(context.type)) {
      const user = dependencies.getUser();
      if (!user) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'User not authenticated');
      }
    }
    return next();
  });

  // Global middleware: map route -> permission action for downstream checks/logging
  const routeToAction: Record<string, string> = {
    [Msg.GET_PUBLIC_KEY]: 'getPublicKey',
    [Msg.SIGN_EVENT]: 'signEvent',
    [Msg.SIGN_DATA]: 'signData',
    [Msg.ENCRYPT]: 'nip04',
    [Msg.DECRYPT]: 'nip04',
    [Msg.GET_RELAYS]: 'getRelays'
  };

  messenger.use(async (context, next) => {
    context.metadata = context.metadata || {};
    context.metadata.action = routeToAction[context.type] || context.type;
    return next();
  });

  // Global middleware: lock check for sensitive cryptographic operations
  const lockProtected = new Set<string>([
    Msg.SIGN_EVENT,
    Msg.SIGN_DATA,
    Msg.ENCRYPT,
    Msg.DECRYPT
  ]);

  messenger.use(async (context, next) => {
    if (lockProtected.has(context.type)) {
      if (dependencies.isVaultLocked()) {
        // Navigate to /:app/unlock-quick to show the minimal PIN UI inside the iframe
        try {
          const currentPath = window.location.pathname;
          const segments = currentPath.split('/').filter(Boolean);
          const appSegment = segments[0] || (context.metadata && (context.metadata as any).appKey) || '';
          const target = `/${appSegment}/unlock-quick`;
          if (currentPath !== target) {
            window.history.pushState({}, '', target);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
        } catch {}
        throw vaultError(ErrorCode.LOCKED, 'Vault is locked. Please unlock with PIN.');
      }
    }
    return next();
  });

  // Register all auth-related handlers
  console.error('🟢 Registering auth handlers:', authHandlers.map(h => h.route));
  authHandlers.forEach(({ route, handler }) => {
    messenger.route(route, {
      handler: (data: any, context: any) => {
        console.error(`🔵 Handler called for route: ${route}`);
        return handler(data, context, dependencies);
      }
    });
  });

  // Register vault UI handlers
  vaultHandlers.forEach(({ route, handler }) => {
    messenger.route(route, {
      handler: (data: any, context: any) => handler(data, context, dependencies)
    });
  });

  // Register permission handlers
  console.error('🟣 Registering permission handlers:', permissionHandlers.map(h => h.route));
  permissionHandlers.forEach(({ route, handler }) => {
    messenger.route(route, {
      handler: (data: any, context: any) => {
        console.error(`🟣 Permission handler called for route: ${route}`);
        return handler(data, context, dependencies);
      }
    });
  });

}

// Re-export types
export * from './types';

// Re-export handlers for testing
export { authHandlers, vaultHandlers, permissionHandlers };