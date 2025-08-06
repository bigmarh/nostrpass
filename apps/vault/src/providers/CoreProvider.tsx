import { ParentComponent, createContext, useContext, createSignal, onMount } from 'solid-js';
import { getCryptoWorker } from '../services/cryptoWorkerSingleton';
import { IframeMessenger } from '@nostrpass/messenger';
import { UsernameRegistry } from '@nostrpass/nostrHelpers';

// Simple environment detection
function getEnvironment(): string {
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  }
  
  if (hostname.includes('staging')) {
    return 'staging';
  }
  
  return 'production';
}

interface CoreContextValue {
  // Environment
  environment: string;
  relays: string[];
  // Messenger
  messenger: IframeMessenger | null;
  isMessengerReady: boolean;
  // Crypto Worker
  cryptoWorker: ReturnType<typeof getCryptoWorker>;
  isCryptoReady: boolean;
  // Nostr
  usernameRegistry: UsernameRegistry | null;
}

const CoreContext = createContext<CoreContextValue>();

export const CoreProvider: ParentComponent = (props) => {
  const [messenger, setMessenger] = createSignal<IframeMessenger | null>(null);
  const [isMessengerReady, setIsMessengerReady] = createSignal(false);
  const [isCryptoReady, setIsCryptoReady] = createSignal(false);
  const [usernameRegistry, setUsernameRegistry] = createSignal<UsernameRegistry | null>(null);

  const environment = getEnvironment();
  const relays = environment === 'production' 
    ? ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://relay.nostr.band']
    : ['wss://localhost:4848'];

  const cryptoWorker = getCryptoWorker();

  onMount(async () => {
    // Initialize messenger
    const messengerInstance = new IframeMessenger(window);
    
    // Configure allowed origins based on environment
    const allowedOrigins: string[] = [];
    if (environment === 'development') {
      allowedOrigins.push(
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:8080',
        'http://127.0.0.1:3000'
      );
    } else if (environment === 'production') {
      allowedOrigins.push(
        'https://nostrpass.com',
        'https://app.nostrpass.com'
      );
    }
    allowedOrigins.push(window.location.origin);
    
    messengerInstance.init(allowedOrigins);
    setMessenger(messengerInstance);
    setIsMessengerReady(true);

    // Initialize crypto worker (happens automatically on first call)
    getCryptoWorker();
    setIsCryptoReady(true);

    // Initialize Nostr registry
    const { getRegistrationKeypair } = await import('../services/userService');
    const registrationKeys = await getRegistrationKeypair();
    const registry = new UsernameRegistry(registrationKeys, relays);
    setUsernameRegistry(registry);
  });

  const value: CoreContextValue = {
    environment,
    relays,
    messenger: messenger(),
    isMessengerReady: isMessengerReady(),
    cryptoWorker,
    isCryptoReady: isCryptoReady(),
    usernameRegistry: usernameRegistry()
  };

  return (
    <CoreContext.Provider value={value}>
      {props.children}
    </CoreContext.Provider>
  );
};

export const useCore = () => {
  const context = useContext(CoreContext);
  if (!context) {
    throw new Error('useCore must be used within CoreProvider');
  }
  return context;
};

// Convenience hooks
export const useEnvironment = () => {
  const { environment, relays } = useCore();
  return { 
    environmentName: () => environment,
    getRelays: () => relays
  };
};

export const useMessenger = () => {
  const { messenger, isMessengerReady } = useCore();
  return {
    messenger,
    isReady: () => isMessengerReady
  };
};

export const useCryptoWorker = () => {
  const { cryptoWorker, isCryptoReady } = useCore();
  return {
    cryptoWorker,
    isReady: () => isCryptoReady
  };
};

export const useNostrComms = () => {
  const { usernameRegistry } = useCore();
  return { usernameRegistry };
};