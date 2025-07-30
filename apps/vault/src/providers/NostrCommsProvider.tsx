import { createContext, useContext, ParentComponent, createSignal, onMount, onCleanup } from 'solid-js';
import { SimplePool, Filter, Event as NostrEvent } from 'nostr-tools';
import { UsernameRegistry, getRegistrationKeypair, generateKeyPair } from '@nostrpass/nostrHelpers';
import { useEnvironment } from './EnvironmentProvider';

interface KeyPair {
  publicKey: string;
  privateKey: Uint8Array;
}

interface RelayStatus {
  url: string;
  connected: boolean;
  lastError?: string;
}

interface NostrCommsContextType {
  // Connection state
  isConnected: () => boolean;
  relays: () => RelayStatus[];
  
  // Username system
  usernameRegistry: () => UsernameRegistry | null;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
  registerUsername: (username: string, userPubkey: string, originatedBy?: string) => Promise<boolean>;
  
  // General Nostr operations
  publishEvent: (event: NostrEvent) => Promise<string[]>;
  queryEvents: (filter: Filter) => Promise<NostrEvent[]>;
  
  // Utility
  generateUserKeys: () => KeyPair;
}

const NostrCommsContext = createContext<NostrCommsContextType>();

export const NostrCommsProvider: ParentComponent = (props) => {
  const [isConnected, setIsConnected] = createSignal(false);
  const [relays, setRelays] = createSignal<RelayStatus[]>([]);
  const [usernameRegistry, setUsernameRegistry] = createSignal<UsernameRegistry | null>(null);
  
  const { getRelays, environmentName, isDebugMode } = useEnvironment();
  let pool: SimplePool | null = null;

  onMount(async () => {
    try {
      // Initialize connection pool
      pool = new SimplePool();
      
      // Get relays from environment config
      const envRelays = getRelays();
      
      // Set up relay status tracking
      const initialRelays = envRelays.map(url => ({
        url,
        connected: false
      }));
      setRelays(initialRelays);
      
      // Initialize username registry with environment-aware setup
      const registrationKeys = await getRegistrationKeypair();
      
      // Create a custom registry that adds environment tags
      const registry = new EnvironmentAwareUsernameRegistry(registrationKeys, envRelays, environmentName());
      setUsernameRegistry(registry);
      
      // Test connections
      await testConnections();
      
      if (isDebugMode()) {
        console.log('✅ NostrComms initialized for environment:', environmentName(), {
          relays: envRelays.length,
          registry: !!registry
        });
      }
    } catch (error) {
      console.error('❌ Failed to initialize NostrComms:', error);
    }
  });

  onCleanup(() => {
    const envRelays = getRelays();
    if (pool) {
      pool.close(envRelays);
    }
    if (usernameRegistry()) {
      usernameRegistry()?.close();
    }
  });

  const testConnections = async () => {
    if (!pool) return;
    
    try {
      // Simple test query to check relay connectivity
      const testFilter: Filter = { kinds: [1], limit: 1 };
      const envRelays = getRelays();
      await pool.querySync(envRelays, testFilter);
      
      setIsConnected(true);
      setRelays(prev => prev.map(relay => ({ ...relay, connected: true })));
    } catch (error) {
      if (isDebugMode()) {
        console.error('Connection test failed:', error);
      }
      setIsConnected(false);
    }
  };

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    const registry = usernameRegistry();
    if (!registry) {
      throw new Error('Username registry not initialized');
    }
    return registry.isUsernameAvailable(username);
  };

  const registerUsername = async (username: string, userPubkey: string, originatedBy?: string): Promise<boolean> => {
    const registry = usernameRegistry();
    if (!registry) {
      throw new Error('Username registry not initialized');
    }
    return registry.registerUsername(username, userPubkey, originatedBy || '');
  };

  const publishEvent = async (event: NostrEvent): Promise<string[]> => {
    if (!pool) {
      throw new Error('Nostr pool not initialized');
    }
    const envRelays = getRelays();
    return Promise.all(pool.publish(envRelays, event));
  };

  const queryEvents = async (filter: Filter): Promise<NostrEvent[]> => {
    if (!pool) {
      throw new Error('Nostr pool not initialized');
    }
    const envRelays = getRelays();
    return pool.querySync(envRelays, filter);
  };

  const generateUserKeys = (): KeyPair => {
    const keys = generateKeyPair();
    return {
      publicKey: keys.publicKey,
      privateKey: keys.privateKey
    };
  };

  const value: NostrCommsContextType = {
    isConnected,
    relays,
    usernameRegistry,
    checkUsernameAvailable,
    registerUsername,
    publishEvent,
    queryEvents,
    generateUserKeys
  };

  return (
    <NostrCommsContext.Provider value={value}>
      {props.children}
    </NostrCommsContext.Provider>
  );
};

// Environment-aware username registry that adds environment tags
class EnvironmentAwareUsernameRegistry extends UsernameRegistry {
  private environment: string;

  constructor(registrationKeys: KeyPair, relays: string[], environment: string) {
    super(registrationKeys, relays);
    this.environment = environment;
  }

  // Override the parent methods to add environment filtering
  async isUsernameAvailable(username: string): Promise<boolean> {
    // We'll call the parent method but need to add environment filtering
    // For now, let's add a simple prefix to isolate environments
    const envUsername = `${this.environment}_${username}`;
    return super.isUsernameAvailable(envUsername);
  }

  async registerUsername(username: string, userPubkey: string, originatedBy?: string): Promise<boolean> {
    // Add environment prefix to isolate registrations
    const envUsername = `${this.environment}_${username}`;
    return super.registerUsername(envUsername, userPubkey, originatedBy || '');
  }
}

export const useNostrComms = () => {
  const context = useContext(NostrCommsContext);
  if (!context) {
    throw new Error('useNostrComms must be used within NostrCommsProvider');
  }
  return context;
}; 