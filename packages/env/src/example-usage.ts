import { createEnv, type Environment } from './index';

// Development example
const devEnvironment = {
  NODE_ENV: 'development',
  APP_URL: 'http://localhost:3000',
  NOSTR_RELAY_URL: 'wss://relay.damus.io',
  DATABASE_URL: 'postgresql://localhost:5432/nostrpass_dev',
  ENABLE_DEBUG_MODE: 'true',
  ENABLE_ANALYTICS: 'false',
};

const devEnv = createEnv(devEnvironment);
console.log('Development environment:', {
  isDev: devEnv.NODE_ENV === 'development', // true
  debugEnabled: devEnv.ENABLE_DEBUG_MODE,    // true (boolean)
  appUrl: devEnv.APP_URL,                    // "http://localhost:3000"
});

// Production example
const prodEnvironment = {
  NODE_ENV: 'production',
  APP_URL: 'https://nostrpass.com',
  NOSTR_RELAY_URL: 'wss://relay.nostrpass.com',
  DATABASE_URL: process.env.DATABASE_URL, // From secure environment
  API_SECRET_KEY: process.env.API_SECRET_KEY,
  SESSION_SECRET: process.env.SESSION_SECRET,
  ENABLE_DEBUG_MODE: 'false',
  ENABLE_ANALYTICS: 'true',
  CORS_ORIGIN: 'https://nostrpass.com',
};

const prodEnv = createEnv(prodEnvironment);
console.log('Production environment:', {
  isProd: prodEnv.NODE_ENV === 'production', // true
  analyticsEnabled: prodEnv.ENABLE_ANALYTICS, // true (boolean)
  corsOrigin: prodEnv.CORS_ORIGIN,           // "https://nostrpass.com"
});

// Type-safe configuration usage
function setupApp(env: Environment) {
  // TypeScript knows all the types
  if (env.NODE_ENV === 'development') {
    console.log(`Starting ${env.APP_NAME} in development mode`);
    
    if (env.ENABLE_DEBUG_MODE) {
      // Enable verbose logging
      console.debug('Debug mode is ON');
    }
  }
  
  if (env.NODE_ENV === 'production') {
    console.log(`Starting ${env.APP_NAME} in production mode`);
    
    if (!env.SESSION_SECRET) {
      throw new Error('SESSION_SECRET is required in production');
    }
    
    if (env.ENABLE_ANALYTICS) {
      // Initialize analytics service
      console.log('Analytics enabled');
    }
  }
  
  // Optional values are typed as T | undefined
  if (env.DATABASE_URL) {
    console.log('Connecting to database...');
  }
}

// Example: Environment validation on startup
try {
  const env = createEnv(process.env);
  setupApp(env);
} catch (error) {
  console.error('Failed to start application:', error);
  process.exit(1);
}