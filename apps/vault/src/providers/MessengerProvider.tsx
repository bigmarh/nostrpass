import { createContext, useContext, ParentComponent, createSignal, onMount, onCleanup } from 'solid-js';
import { IframeMessenger } from '@nostrpass/messenger';

interface MessengerContextType {
  messenger: IframeMessenger | null;
  isReady: () => boolean;
  send: (type: string, data?: any) => void;
  request: (type: string, data?: any, timeout?: number) => Promise<any>;
}

const MessengerContext = createContext<MessengerContextType>();

export const MessengerProvider: ParentComponent = (props) => {
  const [isReady, setIsReady] = createSignal(false);
  let messenger: IframeMessenger | null = null;

  onMount(() => {
    // Initialize messenger
    messenger = new IframeMessenger(window);
    
    // Allow common development origins
    // TODO: Make this dynamic based on the 
    messenger.init([
      'http://localhost:3000'   
    ]);

    // Set up ready signal handler
    messenger.on('VAULT_READY', () => {
      setIsReady(true);
      return { acknowledged: true };
    });

    // Handle show/hide vault commands
    messenger.route('SHOW_VAULT_RESPONSE', {
      handler: (data: any) => {
        console.log('Show vault response handled:', data);
      }
    });

    messenger.route('HIDE_VAULT_RESPONSE', {
      handler: (data: any) => {
        console.log('Hide vault response handled:', data);
      }
    });

    // Send ready signal to parent
    messenger.send('VAULT_READY', {
      timestamp: Date.now(),
      version: '1.0.0'
    });

    console.log('✅ Messenger initialized');
  });

  onCleanup(() => {
    if (messenger) {
      messenger.destroy();
      messenger = null;
    }
  });

  const send = (type: string, data?: any) => {
    if (messenger) {
      messenger.send(type, data);
    } else {
      console.warn('Messenger not ready');
    }
  };

  const request = async (type: string, data?: any, timeout?: number) => {
    if (!messenger) {
      throw new Error('Messenger not ready');
    }
    return messenger.request(type, data, timeout);
  };

  const value: MessengerContextType = {
    messenger,
    isReady,
    send,
    request
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