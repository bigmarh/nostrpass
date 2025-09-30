import { createContext, useContext, ParentComponent, createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { IframeMessenger } from '@nostrpass/messenger';
import { setupMessageHandlers } from '../messageHandlers';
import { useEnvironment } from './EnvironmentProvider';
import { useAuth } from './AuthProvider';

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

export const MessengerProvider: ParentComponent = (props) => {
  const [isReady, setIsReady] = createSignal(false);
  const [messenger, setMessenger] = createSignal<IframeMessenger | null>(null);
  const [handlersRegistered, setHandlersRegistered] = createSignal(false);
  const { isDevelopment, isStaging, isProduction } = useEnvironment();
  
  const getAuth = () => {
    try {
      return useAuth();
    } catch {
      return null;
    }
  };

  onMount(() => {
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
    
    // Mark as ready immediately after init
    setIsReady(true);

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

    setMessenger(messengerInstance);
  });

  onCleanup(() => {
    const m = messenger();
    if (m) {
      m.destroy();
      setMessenger(null);
    }
  });

  // Once auth and messenger are available, register message handlers with deps
  createEffect(() => {
    const m = messenger();
    const auth = getAuth();
    if (!m || !auth) return;

    const deps = {
      getUser: () => auth.user(),
      getCryptoWorker: () => (auth as any).cryptoWorker || null,
      checkPermission: async (action: string, origin: string, eventKind?: number) => {
        try {
          const cw = (auth as any).cryptoWorker;
          const current = auth.user();
          if (!cw || !current) return false;
          const appKey = origin; // already sanitized by middleware
          const result = await cw.checkPermission({
            username: current.profile.username,
            origin: appKey,
            action,
            eventKind
          });
          return !!result?.granted || result?.level === 'ALLOW' || result?.sessionGranted === true;
        } catch {
          return false;
        }
      },
      isVaultLocked: () => auth.isVaultLocked(),
      getAppIdentityIndex: async (origin: string) => {
        const cw = (auth as any).cryptoWorker;
        const current = auth.user();
        if (!cw || !current) throw new Error('Crypto not ready');
        const vaultData = await cw.getVaultData({ username: current.profile.username });
        const appKey = origin; // middleware provides sanitized key
        let activeIndex = vaultData.activeIdentityByApp?.[appKey];
        if (activeIndex === undefined || activeIndex === null) {
          activeIndex = vaultData.identities.findIndex((id: any) => id?.appPermissions && id.appPermissions[appKey]);
        }
        if (activeIndex === -1 || activeIndex === undefined || activeIndex === null) {
          throw new Error('No active identity selected for this application');
        }
        return activeIndex;
      }
    };

    setupMessageHandlers(m, deps);
    setHandlersRegistered(true);

    // Inform parent handlers are ready
    if (window.parent !== window) sendVaultReady();
  });

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