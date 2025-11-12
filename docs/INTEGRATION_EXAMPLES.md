# NostrPass Integration Examples

This document provides practical examples for integrating NostrPass into your applications, whether you're using the reference implementation (nostrpass.com) or a self-hosted vault.

## Table of Contents

1. [Basic Integration](#basic-integration)
2. [Self-Hosted Vault Integration](#self-hosted-vault-integration)
3. [React Integration](#react-integration)
4. [Vue Integration](#vue-integration)
5. [Svelte Integration](#svelte-integration)
6. [Next.js Integration](#nextjs-integration)
7. [Custom Vault Implementation](#custom-vault-implementation)
8. [Multi-Vault Support](#multi-vault-support)

---

## Basic Integration

### Using Default Vault (nostrpass.com)

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Nostr App</title>
</head>
<body>
  <button id="login">Login with NostrPass</button>
  <button id="sign">Sign Event</button>
  <div id="status"></div>

  <!-- Include Embassy SDK -->
  <script src="https://nostrpass.com/embassy.js"></script>

  <script>
    // Auto-initialized with default settings
    // window.nostr is now available

    document.getElementById('login').addEventListener('click', async () => {
      try {
        const pubkey = await window.nostr.getPublicKey();
        document.getElementById('status').textContent =
          `Logged in! Public Key: ${pubkey}`;
      } catch (err) {
        document.getElementById('status').textContent =
          `Error: ${err.message}`;
      }
    });

    document.getElementById('sign').addEventListener('click', async () => {
      const event = {
        kind: 1,
        content: 'Hello from my app!',
        tags: [],
        created_at: Math.floor(Date.now() / 1000)
      };

      try {
        const signedEvent = await window.nostr.signEvent(event);
        console.log('Signed event:', signedEvent);
        document.getElementById('status').textContent = 'Event signed!';
      } catch (err) {
        document.getElementById('status').textContent =
          `Error: ${err.message}`;
      }
    });
  </script>
</body>
</html>
```

---

## Self-Hosted Vault Integration

### Using Custom Vault Instance

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App with Custom Vault</title>
</head>
<body>
  <h1>Using Self-Hosted Vault</h1>
  <button id="connect">Connect</button>
  <pre id="output"></pre>

  <!-- Include Embassy SDK from your vault -->
  <script src="https://vault.mycompany.com/embassy.js" data-manual-init="true"></script>

  <script>
    // Custom configuration
    window.initNostrPass({
      vaultUrl: 'https://vault.mycompany.com',
      trustedOrigins: [
        'https://vault.mycompany.com',
        'https://backup-vault.mycompany.com'
      ],
      appName: 'My Company App',
      appDomain: 'mycompany.com',
      theme: 'dark',
      debug: true
    });

    document.getElementById('connect').addEventListener('click', async () => {
      try {
        const pubkey = await window.nostr.getPublicKey();
        document.getElementById('output').textContent =
          JSON.stringify({ success: true, pubkey }, null, 2);
      } catch (err) {
        document.getElementById('output').textContent =
          JSON.stringify({ success: false, error: err.message }, null, 2);
      }
    });
  </script>
</body>
</html>
```

---

## React Integration

### React Hook for NostrPass

```typescript
// useNostrPass.ts
import { useEffect, useState } from 'react';

interface NostrPassConfig {
  vaultUrl?: string;
  trustedOrigins?: string[];
  appName?: string;
  debug?: boolean;
}

export function useNostrPass(config?: NostrPassConfig) {
  const [isReady, setIsReady] = useState(false);
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load Embassy SDK
    const script = document.createElement('script');
    script.src = config?.vaultUrl
      ? `${config.vaultUrl}/embassy.js`
      : 'https://nostrpass.com/embassy.js';
    script.setAttribute('data-manual-init', 'true');

    script.onload = () => {
      if (window.initNostrPass) {
        window.initNostrPass(config || {});
        setIsReady(true);
      }
    };

    script.onerror = () => {
      setError('Failed to load NostrPass SDK');
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const getPublicKey = async () => {
    if (!window.nostr) {
      throw new Error('NostrPass not initialized');
    }
    const pk = await window.nostr.getPublicKey();
    setPubkey(pk);
    return pk;
  };

  const signEvent = async (event: any) => {
    if (!window.nostr) {
      throw new Error('NostrPass not initialized');
    }
    return await window.nostr.signEvent(event);
  };

  return {
    isReady,
    pubkey,
    error,
    getPublicKey,
    signEvent,
    nostr: window.nostr
  };
}
```

### React Component Example

```typescript
// App.tsx
import React from 'react';
import { useNostrPass } from './useNostrPass';

function App() {
  const { isReady, pubkey, error, getPublicKey, signEvent } = useNostrPass({
    vaultUrl: 'https://vault.example.com',
    appName: 'My React App',
    debug: true
  });

  const handleLogin = async () => {
    try {
      await getPublicKey();
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  const handleSign = async () => {
    const event = {
      kind: 1,
      content: 'Hello from React!',
      tags: [],
      created_at: Math.floor(Date.now() / 1000)
    };

    try {
      const signed = await signEvent(event);
      console.log('Signed:', signed);
    } catch (err) {
      console.error('Sign failed:', err);
    }
  };

  if (!isReady) return <div>Loading NostrPass...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>NostrPass React Example</h1>
      {!pubkey ? (
        <button onClick={handleLogin}>Login</button>
      ) : (
        <>
          <p>Connected: {pubkey}</p>
          <button onClick={handleSign}>Sign Event</button>
        </>
      )}
    </div>
  );
}

export default App;
```

---

## Vue Integration

### Vue 3 Composable

```typescript
// useNostrPass.ts
import { ref, onMounted } from 'vue';

export function useNostrPass(config = {}) {
  const isReady = ref(false);
  const pubkey = ref<string | null>(null);
  const error = ref<string | null>(null);

  onMounted(() => {
    const script = document.createElement('script');
    script.src = config.vaultUrl
      ? `${config.vaultUrl}/embassy.js`
      : 'https://nostrpass.com/embassy.js';
    script.setAttribute('data-manual-init', 'true');

    script.onload = () => {
      if (window.initNostrPass) {
        window.initNostrPass(config);
        isReady.value = true;
      }
    };

    script.onerror = () => {
      error.value = 'Failed to load NostrPass SDK';
    };

    document.body.appendChild(script);
  });

  const getPublicKey = async () => {
    const pk = await window.nostr.getPublicKey();
    pubkey.value = pk;
    return pk;
  };

  const signEvent = async (event: any) => {
    return await window.nostr.signEvent(event);
  };

  return {
    isReady,
    pubkey,
    error,
    getPublicKey,
    signEvent
  };
}
```

### Vue Component

```vue
<template>
  <div>
    <h1>NostrPass Vue Example</h1>
    <div v-if="!isReady">Loading...</div>
    <div v-else-if="error">Error: {{ error }}</div>
    <div v-else>
      <button v-if="!pubkey" @click="handleLogin">Login</button>
      <div v-else>
        <p>Connected: {{ pubkey }}</p>
        <button @click="handleSign">Sign Event</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useNostrPass } from './useNostrPass';

const { isReady, pubkey, error, getPublicKey, signEvent } = useNostrPass({
  vaultUrl: 'https://vault.example.com',
  appName: 'My Vue App'
});

const handleLogin = async () => {
  await getPublicKey();
};

const handleSign = async () => {
  const event = {
    kind: 1,
    content: 'Hello from Vue!',
    tags: [],
    created_at: Math.floor(Date.now() / 1000)
  };

  const signed = await signEvent(event);
  console.log('Signed:', signed);
};
</script>
```

---

## Svelte Integration

### Svelte Store

```typescript
// nostrpass.ts
import { writable } from 'svelte/store';

export const nostrpass = writable({
  isReady: false,
  pubkey: null,
  error: null
});

export async function initNostrPass(config = {}) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = config.vaultUrl
      ? `${config.vaultUrl}/embassy.js`
      : 'https://nostrpass.com/embassy.js';
    script.setAttribute('data-manual-init', 'true');

    script.onload = () => {
      if (window.initNostrPass) {
        window.initNostrPass(config);
        nostrpass.update(s => ({ ...s, isReady: true }));
        resolve(window.nostr);
      }
    };

    script.onerror = () => {
      const error = 'Failed to load NostrPass SDK';
      nostrpass.update(s => ({ ...s, error }));
      reject(error);
    };

    document.body.appendChild(script);
  });
}

export async function getPublicKey() {
  const pubkey = await window.nostr.getPublicKey();
  nostrpass.update(s => ({ ...s, pubkey }));
  return pubkey;
}

export async function signEvent(event) {
  return await window.nostr.signEvent(event);
}
```

### Svelte Component

```svelte
<script>
  import { onMount } from 'svelte';
  import { nostrpass, initNostrPass, getPublicKey, signEvent } from './nostrpass';

  onMount(async () => {
    await initNostrPass({
      vaultUrl: 'https://vault.example.com',
      appName: 'My Svelte App'
    });
  });

  async function handleLogin() {
    await getPublicKey();
  }

  async function handleSign() {
    const event = {
      kind: 1,
      content: 'Hello from Svelte!',
      tags: [],
      created_at: Math.floor(Date.now() / 1000)
    };

    const signed = await signEvent(event);
    console.log('Signed:', signed);
  }
</script>

<h1>NostrPass Svelte Example</h1>

{#if !$nostrpass.isReady}
  <p>Loading...</p>
{:else if $nostrpass.error}
  <p>Error: {$nostrpass.error}</p>
{:else if !$nostrpass.pubkey}
  <button on:click={handleLogin}>Login</button>
{:else}
  <p>Connected: {$nostrpass.pubkey}</p>
  <button on:click={handleSign}>Sign Event</button>
{/if}
```

---

## Next.js Integration

### Client Component

```typescript
// components/NostrPassProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const NostrContext = createContext<any>(null);

export function NostrPassProvider({
  children,
  config = {}
}: {
  children: React.ReactNode;
  config?: any;
}) {
  const [isReady, setIsReady] = useState(false);
  const [nostr, setNostr] = useState<any>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = config.vaultUrl
      ? `${config.vaultUrl}/embassy.js`
      : 'https://nostrpass.com/embassy.js';
    script.setAttribute('data-manual-init', 'true');

    script.onload = () => {
      if (window.initNostrPass) {
        const provider = window.initNostrPass(config);
        setNostr(provider);
        setIsReady(true);
      }
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <NostrContext.Provider value={{ isReady, nostr }}>
      {children}
    </NostrContext.Provider>
  );
}

export function useNostr() {
  return useContext(NostrContext);
}
```

### App Layout

```typescript
// app/layout.tsx
import { NostrPassProvider } from '@/components/NostrPassProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <NostrPassProvider
          config={{
            vaultUrl: 'https://vault.example.com',
            appName: 'My Next.js App'
          }}
        >
          {children}
        </NostrPassProvider>
      </body>
    </html>
  );
}
```

### Page Component

```typescript
// app/page.tsx
'use client';

import { useNostr } from '@/components/NostrPassProvider';

export default function Home() {
  const { isReady, nostr } = useNostr();

  const handleLogin = async () => {
    if (nostr) {
      const pubkey = await nostr.getPublicKey();
      console.log('Logged in:', pubkey);
    }
  };

  if (!isReady) return <div>Loading NostrPass...</div>;

  return (
    <main>
      <h1>Next.js + NostrPass</h1>
      <button onClick={handleLogin}>Login</button>
    </main>
  );
}
```

---

## Custom Vault Implementation

### Building a Minimal Compatible Vault

```typescript
// minimal-vault/src/main.ts
import { ChildMessenger } from '@nostrpass/messenger';
import { configureNostrPass } from '@nostrpass/nostrHelpers';

// Configure your namespace
configureNostrPass({
  namespace: 'myvault.io',
  environment: 'production',
  relays: ['wss://relay.damus.io', 'wss://nos.lol']
});

// Initialize messenger
const messenger = new ChildMessenger(window);

// Handle incoming messages
messenger.on('GET_PUBLIC_KEY', async (payload) => {
  // Your logic to get public key
  const pubkey = await getStoredPublicKey();
  return { publicKey: pubkey };
});

messenger.on('SIGN_EVENT', async (payload) => {
  const { event } = payload;
  // Your signing logic
  const signedEvent = await signEventWithStoredKey(event);
  return { signedEvent };
});

// Initialize with trusted origins
messenger.init([
  'https://myapp.com',
  'https://partner-app.com'
]);

// Signal ready
messenger.send('VAULT_READY', {});
```

### Publishing Your Custom Vault

1. Build your vault implementation
2. Deploy to your domain
3. Document your namespace
4. Provide embassy SDK integration instructions
5. Submit to NPS-01 compliance registry (optional)

---

## Multi-Vault Support

### Allowing Users to Choose Vault

```html
<!DOCTYPE html>
<html>
<head>
  <title>Multi-Vault Support</title>
</head>
<body>
  <h1>Choose Your Vault</h1>

  <select id="vault-selector">
    <option value="https://nostrpass.com">NostrPass (Official)</option>
    <option value="https://vault.example.com">Example Vault</option>
    <option value="https://community-vault.io">Community Vault</option>
    <option value="custom">Custom URL...</option>
  </select>

  <input id="custom-vault" type="text" placeholder="https://your-vault.com" style="display:none;" />
  <button id="connect">Connect</button>

  <script src="https://nostrpass.com/embassy.js" data-manual-init="true"></script>
  <script>
    const selector = document.getElementById('vault-selector');
    const customInput = document.getElementById('custom-vault');

    selector.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        customInput.style.display = 'block';
      } else {
        customInput.style.display = 'none';
      }
    });

    document.getElementById('connect').addEventListener('click', async () => {
      let vaultUrl = selector.value;

      if (vaultUrl === 'custom') {
        vaultUrl = customInput.value;
      }

      // Initialize with selected vault
      window.initNostrPass({
        vaultUrl: vaultUrl,
        trustedOrigins: [new URL(vaultUrl).origin],
        appName: 'Multi-Vault App'
      });

      // Connect
      try {
        const pubkey = await window.nostr.getPublicKey();
        alert(`Connected! Public Key: ${pubkey}`);
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });
  </script>
</body>
</html>
```

---

## Advanced: Fallback Vault Strategy

### Primary + Backup Vaults

```javascript
const vaults = [
  'https://vault.mycompany.com',
  'https://backup-vault.mycompany.com',
  'https://nostrpass.com'  // Public fallback
];

async function connectWithFallback() {
  for (const vaultUrl of vaults) {
    try {
      window.initNostrPass({
        vaultUrl,
        trustedOrigins: [new URL(vaultUrl).origin],
        debug: true
      });

      // Test connection
      await window.nostr.getPublicKey();

      console.log(`Connected to: ${vaultUrl}`);
      return true;
    } catch (err) {
      console.warn(`Failed to connect to ${vaultUrl}:`, err);
      continue;
    }
  }

  throw new Error('All vaults failed');
}

connectWithFallback();
```

---

## Testing Your Integration

### Integration Test

```javascript
async function testNostrPassIntegration() {
  console.log('Testing NostrPass integration...');

  // Test 1: SDK loaded
  if (!window.nostr) {
    throw new Error('window.nostr not available');
  }
  console.log('✓ SDK loaded');

  // Test 2: Get public key
  const pubkey = await window.nostr.getPublicKey();
  if (!pubkey || pubkey.length !== 64) {
    throw new Error('Invalid public key');
  }
  console.log('✓ Public key obtained:', pubkey);

  // Test 3: Sign event
  const event = {
    kind: 1,
    content: 'Test event',
    tags: [],
    created_at: Math.floor(Date.now() / 1000)
  };

  const signed = await window.nostr.signEvent(event);
  if (!signed.sig || !signed.id) {
    throw new Error('Event signing failed');
  }
  console.log('✓ Event signed');

  // Test 4: NIP-04 encryption (if supported)
  if (window.nostr.nip04) {
    const encrypted = await window.nostr.nip04.encrypt(
      pubkey,
      'secret message'
    );
    console.log('✓ NIP-04 encryption works');
  }

  console.log('All tests passed! ✅');
}

testNostrPassIntegration();
```

---

## Need Help?

- **Protocol Spec**: See [PROTOCOL_SPECIFICATION.md](PROTOCOL_SPECIFICATION.md)
- **Self-Hosting**: See [SELF_HOSTING_GUIDE.md](SELF_HOSTING_GUIDE.md)
- **Issues**: Open a GitHub issue
- **Community**: Find us on Nostr

---

**Happy Building! 🚀**
