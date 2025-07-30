import { createEnv } from '@nostrpass/env';

export const env = createEnv({
  NEXT_PUBLIC_APP_URL: import.meta.env.VITE_APP_URL,
  NEXT_PUBLIC_APP_NAME: import.meta.env.VITE_APP_NAME,
  NEXT_PUBLIC_NOSTR_RELAY_URL: import.meta.env.VITE_NOSTR_RELAY_URL,
  NEXT_PUBLIC_ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS,
});