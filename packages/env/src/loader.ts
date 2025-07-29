import { config } from 'dotenv';
import { resolve } from 'path';
import { createEnv } from './index';

/**
 * Load environment variables from .env files
 * Priority order (highest to lowest):
 * 1. .env.local
 * 2. .env.[NODE_ENV].local
 * 3. .env.[NODE_ENV]
 * 4. .env
 */
export function loadEnv(options?: { path?: string }) {
  const rootPath = options?.path || process.cwd();
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // Load in reverse priority order (later loads override earlier ones)
  const envFiles = [
    '.env',
    `.env.${nodeEnv}`,
    `.env.${nodeEnv}.local`,
    '.env.local',
  ];
  
  for (const file of envFiles) {
    config({ path: resolve(rootPath, file) });
  }
  
  return createEnv(process.env);
}

/**
 * Example usage:
 * 
 * // At the top of your app entry point
 * import { loadEnv } from '@nostrpass/env/loader';
 * 
 * export const env = loadEnv();
 */