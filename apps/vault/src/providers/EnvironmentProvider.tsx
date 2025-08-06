import { createContext, useContext, ParentComponent, createSignal, onMount } from 'solid-js';

interface EnvironmentConfig {
  name: string;
  isProduction: boolean;
  isDevelopment: boolean;
  isStaging: boolean;
  relays: string[];
  apiBaseUrl?: string;
  debug: boolean;
}

interface EnvironmentContextType {
  environment: () => EnvironmentConfig;
  environmentName: () => string;
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
      // 'wss://relay.nostr.band', // Temporarily disabled - might be requiring PoW
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
    setEnvironment(envConfig);
    
    console.log(`🌍 Environment detected: ${envName}`, {
      relays: envConfig.relays.length,
      debug: envConfig.debug,
      apiUrl: envConfig.apiBaseUrl
    });
  });

  const value: EnvironmentContextType = {
    environment,
    environmentName: () => environment().name,
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