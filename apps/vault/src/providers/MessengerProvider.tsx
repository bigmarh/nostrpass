import { createContext, useContext, ParentComponent, createSignal, onMount, onCleanup } from 'solid-js';
import { IframeMessenger } from '@nostrpass/messenger';
import { setupMessageHandlers } from '../messageHandlers';

interface MessengerContextType {
  messenger: IframeMessenger | null;
  isReady: () => boolean;
  send: (type: string, data?: any) => void;
  request: (type: string, data?: any, timeout?: number) => Promise<any>;
}

const MessengerContext = createContext<MessengerContextType>();

export const MessengerProvider: ParentComponent = (props) => {
  const [isReady, setIsReady] = createSignal(false);
  const [messenger, setMessenger] = createSignal<IframeMessenger | null>(null);

  onMount(() => {
    // Initialize messenger
    const messengerInstance = new IframeMessenger(window);
    
    // Allow common development origins
    // TODO: Make this dynamic based on the 
    messengerInstance.init([
      'http://localhost:3000'   
    ]);

    // Set up ready signal handler
    messengerInstance.on('VAULT_READY', () => {
      setIsReady(true);
      return { acknowledged: true };
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

    // Set up all message handlers
    setupMessageHandlers(messengerInstance);

    // Send ready signal to parent
    messengerInstance.send('VAULT_READY', {
      timestamp: Date.now(),
      version: '1.0.0'
    });

    setMessenger(messengerInstance);
    console.log('✅ Messenger initialized');
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

  const value: MessengerContextType = {
    get messenger() { return messenger(); },
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