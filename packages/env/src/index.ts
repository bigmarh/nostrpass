import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  
  // Application
  APP_NAME: z.string().default('nostrpass'),
  APP_URL: z.string().url(),
  
  // Nostr Configuration
  NOSTR_RELAY_URL: z.string().url().optional(),
  NOSTR_PRIVATE_KEY: z.string().optional(),
  NOSTR_PUBLIC_KEY: z.string().optional(),
  
  // Database
  DATABASE_URL: z.string().optional(),
  
  // API
  API_SECRET_KEY: z.string().optional(),
  
  // Feature Flags
  ENABLE_DEBUG_MODE: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  ENABLE_ANALYTICS: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  
  // Security
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  SESSION_SECRET: z.string().optional(),
});

export type Environment = z.infer<typeof environmentSchema>;

export function createEnv(env: Record<string, string | undefined>): Environment {
  const parsed = environmentSchema.safeParse(env);
  
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }
  
  return parsed.data;
}

export function validateEnv(env: Record<string, string | undefined>): void {
  environmentSchema.parse(env);
}

export const envDefaults = {
  NODE_ENV: 'development',
  APP_NAME: 'nostrpass',
  ENABLE_DEBUG_MODE: false,
  ENABLE_ANALYTICS: false,
  CORS_ORIGIN: 'http://localhost:3000',
} as const;

export { environmentSchema };