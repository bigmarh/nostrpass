# @nostrpass/env

Environment configuration and validation for the nostrpass monorepo.

## Usage Examples

### Development Setup

Create a `.env.local` file in your app:
```env
NODE_ENV=development
APP_URL=http://localhost:3000
NOSTR_RELAY_URL=wss://relay.damus.io
DATABASE_URL=postgresql://user:pass@localhost:5432/nostrpass_dev
ENABLE_DEBUG_MODE=true
```

### Production Setup

Set environment variables in your hosting platform:
```env
NODE_ENV=production
APP_URL=https://nostrpass.com
NOSTR_RELAY_URL=wss://relay.nostrpass.com
DATABASE_URL=postgresql://prod_connection_string
API_SECRET_KEY=your-secret-key
SESSION_SECRET=your-session-secret
ENABLE_ANALYTICS=true
CORS_ORIGIN=https://nostrpass.com
```

### In Your Application

```typescript
// app/src/env.ts
import { createEnv } from '@nostrpass/env';

export const env = createEnv(process.env);

// Now use with full type safety
console.log(env.APP_URL); // string
console.log(env.ENABLE_DEBUG_MODE); // boolean
console.log(env.DATABASE_URL); // string | undefined
```

### For Client-Side (Next.js)

```typescript
// app/src/env.client.ts
import { createClientEnv } from '@nostrpass/env/client';

export const clientEnv = createClientEnv({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_NOSTR_RELAY_URL: process.env.NEXT_PUBLIC_NOSTR_RELAY_URL,
  NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
});
```

### Environment-Specific Logic

```typescript
import { env } from './env';

if (env.NODE_ENV === 'development') {
  // Development-only features
  if (env.ENABLE_DEBUG_MODE) {
    console.log('Debug mode enabled');
  }
}

if (env.NODE_ENV === 'production') {
  // Production-only features
  if (env.ENABLE_ANALYTICS) {
    // Initialize analytics
  }
}
```

### Testing

```typescript
// In tests, you can mock the environment
import { createEnv } from '@nostrpass/env';

const testEnv = createEnv({
  NODE_ENV: 'test',
  APP_URL: 'http://test.local',
  // ... other test values
});
```