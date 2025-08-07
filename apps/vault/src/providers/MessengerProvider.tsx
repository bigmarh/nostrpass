import { createContext, useContext, ParentComponent, createSignal, onMount, onCleanup } from 'solid-js';
import { IframeMessenger } from '@nostrpass/messenger';
import { setupMessageHandlers } from '../messageHandlers';
import { useEnvironment } from './EnvironmentProvider';

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

    // Set up all message handlers - commented out for now due to missing dependencies
    // setupMessageHandlers(messengerInstance);

    // Don't send ready signal here - wait for AuthProvider to set up handlers
    if (window.parent !== window) {
      console.log('📍 In iframe mode - will send VAULT_READY after auth handlers are set up');
    } else {
      console.log('📍 Running standalone (not in iframe), skipping VAULT_READY signal');
    }

    setMessenger(messengerInstance);
  });

  onCleanup(() => {
    const m = messenger();
    if (m) {
      m.destroy();
      setMessenger(null);
    }
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