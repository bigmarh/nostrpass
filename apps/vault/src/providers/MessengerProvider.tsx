import { createContext, useContext, ParentComponent, createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { IframeMessenger } from '@nostrpass/messenger';
import { setupMessageHandlers } from '../messageHandlers';
import { useEnvironment } from './EnvironmentProvider';
import { useAuth } from './AuthProvider';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';
import type { PermissionLevel } from '@nostrpass/types';

interface MessengerContextType {
  messenger: IframeMessenger | null;
  isReady: () => boolean;
  send: (type: string, data?: any) => void;
  request: (type: string, data?: any, timeout?: number) => Promise<any>;
  sendVaultReady: () => void;
  areHandlersRegistered: () => boolean;
  setHandlersRegistered: (value: boolean) => void;
}

const MessengerContext = createContext<MessengerContextType>();

// Global messenger instance for use outside of components
let globalMessenger: IframeMessenger | null = null;

// Global registry for auth ready callback
let authReadyCallback: ((auth: any) => void) | null = null;

/**
 * Get the global messenger instance (for use outside of components)
 * Returns null if messenger is not yet initialized
 */
export function getMessenger(): IframeMessenger | null {
  return globalMessenger;
}

export function registerAuthReady(callback: (auth: any) => void) {
  authReadyCallback = callback;
}

export function notifyAuthReady(auth: any) {
  console.error('🔍 [MessengerProvider] notifyAuthReady called with auth:', !!auth);
  if (authReadyCallback) {
    console.error('🔍 [MessengerProvider] Calling registered callback');
    authReadyCallback(auth);
  } else {
    console.error('🔍 [MessengerProvider] No callback registered yet!');
  }
}

export const MessengerProvider: ParentComponent = (props) => {
  const [isReady, setIsReady] = createSignal(false);
  const [messenger, setMessenger] = createSignal<IframeMessenger | null>(null);
  const [handlersRegistered, setHandlersRegistered] = createSignal(false);
  const { isDevelopment, isStaging, isProduction } = useEnvironment();

  const toAppKey = (origin: string): string => {
    try {
      const url = new URL(origin);
      return sanitizeDomain(url.host);
    } catch {
      return sanitizeDomain(origin);
    }
  };

  onMount(() => {
    console.log('🔧 [MessengerProvider] Initializing messenger in iframe');

    // Initialize messenger
    const messengerInstance = new IframeMessenger(window);

    // Configure allowed origins based on environment
    const allowedOrigins: string[] = [];
    
    if (isDevelopment()) {
      // Development: Allow all origins for Embassy flexibility
      // The vault (iframe) needs to accept messages from any parent application
      allowedOrigins.push('*');
    }
    
    if (isStaging()) {
      // Staging: Add staging domains
      allowedOrigins.push(
        'https://staging.nostrpass.com',
        'https://app-staging.nostrpass.com'
      );
    }
    
    if (isProduction()) {
      // Production: Only allow production domains
      allowedOrigins.push(
        'https://nostrpass.com',
        'https://app.nostrpass.com',
        'https://www.nostrpass.com'
      );
    }
    
    // Always allow the current origin (self)
    if (window.parent !== window) {
      allowedOrigins.push(window.location.origin);
    }
    
    // For testing: always allow current origin even if not in iframe
    allowedOrigins.push(window.location.origin);
    
    messengerInstance.init(allowedOrigins);

    // Store in global variable for use outside components
    globalMessenger = messengerInstance;

    // Mark as ready immediately after init
    setIsReady(true);
    console.log('✅ [MessengerProvider] Messenger initialized and ready', {
      allowedOrigins,
      isInIframe: window.parent !== window
    });

    // Handle show/hide vault commands
    messengerInstance.route('SHOW_VAULT_RESPONSE', {
      handler: (data: any) => {
        console.log('Show vault response handled:', data);
      }
    });

    messengerInstance.route('HIDE_VAULT_RESPONSE', {
      handler: (data: any) => {
        console.log('Hide vault response handled:', data);
      }
    });

    // Handle navigation to unlock from embassy
    messengerInstance.route('NAVIGATE_TO_UNLOCK', {
      handler: async () => {
        console.log('📍 Navigation to unlock-quick requested by embassy');
        try {
          // Get current app segment from URL
          const currentPath = window.location.pathname;
          const segments = currentPath.split('/').filter(Boolean);
          const appSegment = segments[0] || '';
          const targetPath = `/${appSegment}/unlock-quick`;
          
          if (currentPath !== targetPath) {
            console.log('📍 Navigating to:', targetPath);
            window.history.pushState({}, '', targetPath);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
        } catch (err) {
          console.error('Failed to navigate to unlock:', err);
        }
        return { acknowledged: true };
      }
    });

    setMessenger(messengerInstance);
  });

  onCleanup(() => {
    const m = messenger();
    if (m) {
      m.destroy();
      setMessenger(null);
      globalMessenger = null;
    }
  });

  // Register callback for when AuthProvider is ready
  onMount(() => {
    console.error('🔍 [MessengerProvider] onMount - registering auth ready callback');

    authReadyCallback = (auth: any) => {
      console.error('🔍 [MessengerProvider] Auth ready callback fired!', { hasAuth: !!auth, hasMessenger: !!messenger() });
      const m = messenger();
      if (m && auth && !handlersRegistered()) {
        console.error('🔍 [MessengerProvider] Both ready, setting up handlers');
        setupHandlers(m, auth);
      }
    };
  });

  const setupHandlers = (m: IframeMessenger, auth: any) => {
    console.error('🔍 [MessengerProvider] setupHandlers called - messenger:', !!m, 'auth:', !!auth);

    // Don't return early - let the effect re-run when auth becomes available
    if (!m) {
      console.error('🔍 [MessengerProvider] Messenger not ready yet, will retry');
      return;
    }

    if (!auth) {
      console.error('🔍 [MessengerProvider] Auth not ready yet, will retry when auth becomes available');
      return;
    }

    // Skip if handlers already registered to avoid double registration
    if (handlersRegistered()) {
      console.error('🔍 [MessengerProvider] Handlers already registered, skipping');
      return;
    }

    console.error('🔍 [MessengerProvider] Both messenger and auth ready, proceeding with setup');

    const deps = {
      getUser: () => auth.user(),  // user is a signal (function)
      getCryptoWorker: () => auth.cryptoWorker,  // cryptoWorker is already the value
      checkPermission: async (action: string, origin: string, eventKind?: number, identityIndex?: number) => {
        const fallback: { allowed: boolean; level: PermissionLevel; sessionGranted?: boolean } = {
          allowed: false,
          level: 'ASK_EVERYTIME'
        };
        try {
          const cw = auth.cryptoWorker;  // cryptoWorker is already the value
          const current = auth.user();  // user is a signal (function)
          if (!cw || !current) return fallback;
          const appKey = toAppKey(origin);
          const result = await cw.checkPermission({
            username: current.profile.username,
            origin: appKey,
            action,
            eventKind,
            identityIndex
          });
          return {
            allowed: !!result?.allowed,
            level: (result?.level as PermissionLevel) ?? (result?.allowed ? 'ALLOW' : 'ASK_EVERYTIME'),
            sessionGranted: result?.sessionGranted === true
          };
        } catch {
          return fallback;
        }
      },
      isVaultLocked: () => auth.isVaultLocked(),  // isVaultLocked is a signal (function)
      getAppIdentityIndex: async (origin: string) => {
        const cw = auth.cryptoWorker;  // cryptoWorker is already the value
        const current = auth.user();  // user is a signal (function)
        if (!cw || !current) throw new Error('Crypto not ready');
        const vaultData = await cw.getVaultData({ username: current.profile.username });
        const appKey = toAppKey(origin);
        let activeIndex = vaultData.activeIdentityByApp?.[appKey];
        if (activeIndex === undefined || activeIndex === null) {
          activeIndex = vaultData.identities.findIndex((id: any) => id?.appPermissions && id.appPermissions[appKey]);
        }
        if (activeIndex === -1 || activeIndex === undefined || activeIndex === null) {
          // Instead of throwing, trigger account picker
          const requestId = `account-picker-${Date.now()}-${Math.random().toString(36).slice(2)}`;

          return new Promise((resolve, reject) => {
            const handleSelected = (e: Event) => {
              const ce = e as CustomEvent;
              if (ce.detail.requestId === requestId) {
                cleanup();
                resolve(ce.detail.identityIndex);
              }
            };

            const handleRejected = (e: Event) => {
              const ce = e as CustomEvent;
              if (ce.detail.requestId === requestId) {
                cleanup();
                reject(new Error(ce.detail.error || 'Account selection cancelled'));
              }
            };

            const cleanup = () => {
              window.removeEventListener('account-picker-selected', handleSelected as EventListener);
              window.removeEventListener('account-picker-rejected', handleRejected as EventListener);
            };

            window.addEventListener('account-picker-selected', handleSelected as EventListener);
            window.addEventListener('account-picker-rejected', handleRejected as EventListener);

            // Trigger account picker
            window.dispatchEvent(new CustomEvent('vault-account-picker', {
              detail: { appOrigin: origin, requestId }
            }));
          });
        }
        return activeIndex;
      }
    };

    setupMessageHandlers(m, deps);
    setHandlersRegistered(true);

    // Inform parent handlers are ready
    if (window.parent !== window) sendVaultReady();
  };

  const send = (type: string, data?: any) => {
    const m = messenger();
    if (m) {
      m.send(type, data);
    } else {
      console.warn('Messenger not ready');
    }
  };

  const request = async (type: string, data?: any, timeout?: number) => {
    const m = messenger();
    if (!m) {
      throw new Error('Messenger not ready');
    }
    return m.request(type, data, timeout);
  };

  const sendVaultReady = () => {
    const m = messenger();
    if (m && window.parent !== window && handlersRegistered()) {
      m.send('VAULT_READY', {
        timestamp: Date.now(),
        version: '1.0.0',
        handlersReady: true
      });
      console.log('📤 Sent VAULT_READY signal to parent (handlers registered)');
    } else {
      console.log('⚠️ Cannot send VAULT_READY:', {
        hasMessenger: !!m,
        inIframe: window.parent !== window,
        handlersRegistered: handlersRegistered()
      });
    }
  };

  const value: MessengerContextType = {
    get messenger() { return messenger(); },
    isReady,
    send,
    request,
    sendVaultReady,
    areHandlersRegistered: handlersRegistered,
    setHandlersRegistered
  };

  return (
    <MessengerContext.Provider value={value}>
      {props.children}
    </MessengerContext.Provider>
  );
};

export const useMessenger = () => {
  const context = useContext(MessengerContext);
  if (!context) {
    throw new Error('useMessenger must be used within MessengerProvider');
  }
  return context;
}; 