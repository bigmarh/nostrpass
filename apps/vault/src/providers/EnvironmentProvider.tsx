import { createContext, useContext, ParentComponent, createSignal, onMount } from 'solid-js';

interface EnvironmentConfig {
  name: string;
  isProduction: boolean;
  isDevelopment: boolean;
  isStaging: boolean;
  relays: string[];
  apiBaseUrl?: string;
  debug: boolean;
  storageEnvironment?: string; // Override for where to save vault data
}

interface EnvironmentContextType {
  environment: () => EnvironmentConfig;
  environmentName: () => string;
  storageEnvironmentName: () => string; // Returns storage environment (from URL or detected)
  isProduction: () => boolean;
  isDevelopment: () => boolean;
  isStaging: () => boolean;
  getRelays: () => string[];
  isDebugMode: () => boolean;
}

const EnvironmentContext = createContext<EnvironmentContextType>();

// Environment-specific configurations
const ENVIRONMENT_CONFIGS: Record<string, EnvironmentConfig> = {
  development: {
    name: 'development',
    isProduction: false,
    isDevelopment: true,
    isStaging: false,
    relays: [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.primal.net',
      'wss://relay.nostr.band',
      'ws://localhost:8080' // Local relay for testing
    ],
    debug: true
  },
  staging: {
    name: 'staging',
    isProduction: false,
    isDevelopment: false,
    isStaging: true,
    relays: [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band'
    ],
    apiBaseUrl: 'https://staging-api.nostrpass.com',
    debug: true
  },
  production: {
    name: 'production',
    isProduction: true,
    isDevelopment: false,
    isStaging: false,
    relays: [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band'
    ],
    apiBaseUrl: 'https://api.nostrpass.com',
    debug: false
  }
};

// Helper function to get relays without context
export function getRelays(): string[] {
  const envName = detectEnvironment();
  const envConfig = ENVIRONMENT_CONFIGS[envName] || ENVIRONMENT_CONFIGS.development;
  return envConfig.relays;
}

// Detect current environment
function detectEnvironment(): string {
  // Check Vite environment first
  if (import.meta.env?.MODE) {
    return import.meta.env.MODE;
  }
  
  // Check hostname-based detection
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Development patterns
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
      return 'development';
    }
    
    // Staging patterns
    if (hostname.includes('staging') || hostname.includes('dev') || hostname.includes('test')) {
      return 'staging';
    }
    
    // Production (everything else)
    return 'production';
  }
  
  // Default fallback
  return 'development';
}

export const EnvironmentProvider: ParentComponent = (props) => {
  const [environment, setEnvironment] = createSignal<EnvironmentConfig>(ENVIRONMENT_CONFIGS.development);

  onMount(() => {
    const envName = detectEnvironment();
    const envConfig = ENVIRONMENT_CONFIGS[envName] || ENVIRONMENT_CONFIGS.development;

    // Check for storage environment override from URL params (passed by Embassy)
    const urlParams = new URLSearchParams(window.location.search);
    const storageEnvParam = urlParams.get('storageEnvironment');

    if (storageEnvParam) {
      console.log('[EnvironmentProvider] Storage environment override from URL:', storageEnvParam);
      envConfig.storageEnvironment = storageEnvParam;
    }

    setEnvironment(envConfig);
  });

  const value: EnvironmentContextType = {
    environment,
    environmentName: () => environment().name,
    storageEnvironmentName: () => environment().storageEnvironment || environment().name,
    isProduction: () => environment().isProduction,
    isDevelopment: () => environment().isDevelopment,
    isStaging: () => environment().isStaging,
    getRelays: () => environment().relays,
    isDebugMode: () => environment().debug
  };

  return (
    <EnvironmentContext.Provider value={value}>
      {props.children}
    </EnvironmentContext.Provider>
  );
};

export const useEnvironment = () => {
  const context = useContext(EnvironmentContext);
  if (!context) {
    throw new Error('useEnvironment must be used within EnvironmentProvider');
  }
  return context;
}; 