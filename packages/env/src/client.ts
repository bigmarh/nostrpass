import { z } from 'zod';

const clientEnvironmentSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().optional(),
  NEXT_PUBLIC_NOSTR_RELAY_URL: z.string().url().optional(),
  NEXT_PUBLIC_ENABLE_ANALYTICS: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
});

export type ClientEnvironment = z.infer<typeof clientEnvironmentSchema>;

export function createClientEnv(env: Record<string, string | undefined>): ClientEnvironment {
  const parsed = clientEnvironmentSchema.safeParse(env);
  
  if (!parsed.success) {
    console.error('❌ Invalid client environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error('Invalid client environment variables');
  }
  
  return parsed.data;
}

export { clientEnvironmentSchema };