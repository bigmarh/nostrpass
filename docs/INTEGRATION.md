# NostrPass Integration Guide

This guide covers everything you need to integrate NostrPass into your application, from quick start to advanced patterns.

## Table of Contents

1. [Quick Start](#quick-start)
2. [NostrPassButton Component](#nostrpassbutton-component)
3. [Framework Examples](#framework-examples)
4. [Advanced Integration](#advanced-integration)

---

## Quick Start

### Installation

```bash
# Install via npm/pnpm
pnpm add @nostrpass/provider
```

### Initialize (Bundlers)

```ts
import { initNostrPass } from '@nostrpass/provider';

const provider = initNostrPass({
  appName: 'MyApp',
  vaultUrl: 'https://vault.nostrpass.com'
});

const pubkey = await window.nostr.getPublicKey();
```

### Initialize (IIFE / CDN)

```html
<script src="https://cdn.nostrpass.com/provider/index.iife.js" crossorigin="anonymous"></script>
<script>
  window.initNostrPass({ appName: 'MyApp', vaultUrl: 'https://vault.nostrpass.com' });
</script>
```

### Security & CSP

Recommended Content Security Policy for host app:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; frame-src https://vault.nostrpass.com; connect-src 'self' https://vault.nostrpass.com wss:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';">
```

### API (NIP-07)

```javascript
// All NIP-07 methods available on window.nostr
await window.nostr.getPublicKey();
await window.nostr.signEvent(event);
await window.nostr.signData(message);
await window.nostr.nip04.encrypt(pubkey, plaintext);
await window.nostr.nip04.decrypt(pubkey, ciphertext);
```

---

## NostrPassButton Component

The NostrPass Button is a production-ready authentication widget similar to Clerk's user button pattern.

### Features

- **Beautiful UI**: Gradient button design with smooth animations
- **Theme Support**: Auto-detects system theme (light/dark)
- **User Avatar**: Shows user avatar or initials after sign-in
- **Dropdown Menu**: Clean dropdown with user info and account management
- **Session Persistence**: Automatically restores user sessions

### Basic Usage

```javascript
// 1. Initialize NostrPass
const nostr = window.initNostrPass({
  appName: 'My Awesome App',
  vaultUrl: 'https://vault.nostrpass.com/',
  debug: false
});

// 2. Create the Button
const nostrpassButton = nostr.createNostrPassButton({
  appendTo: '#auth-container',
  theme: 'auto', // 'light', 'dark', or 'auto'
  showNpub: true,
  showManageAccount: true,
  onSignIn: (user) => {
    console.log('User signed in:', user);
  },
  onSignOut: () => {
    console.log('User signed out');
  },
  onError: (error) => {
    console.error('Auth error:', error);
  }
});

// 3. Restore session on page load
nostrpassButton.restoreSession();
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `appendTo` | `string \| HTMLElement` | - | Where to append the button |
| `className` | `string` | - | Custom CSS class for container |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Theme preference |
| `showNpub` | `boolean` | `true` | Show npub in dropdown |
| `showManageAccount` | `boolean` | `true` | Show "Manage Account" option |
| `signInText` | `string` | `'Sign in with NostrPass'` | Custom sign-in button text |
| `onSignIn` | `(user: UserInfo) => void` | - | Called when user signs in |
| `onSignOut` | `() => void` | - | Called when user signs out |
| `onError` | `(error: unknown) => void` | - | Called on errors |

### User Info Interface

```typescript
interface UserInfo {
  identityIndex: number;
  publicKey: string;
  npub?: string;
  nickname?: string;
  avatar?: string;
  authorized: boolean;
}
```

### Methods

```javascript
// Restore session from storage
const restored = await nostrpassButton.restoreSession();

// Get current user
const user = nostrpassButton.getUser();

// Get button element
const element = nostrpassButton.getElement();

// Remove button from DOM
nostrpassButton.destroy();
```

### Styling

Override styles using CSS:

```css
/* Customize the sign-in button */
.nostrpass-signin-btn {
  background: linear-gradient(135deg, #your-color-1, #your-color-2) !important;
}

/* Customize the user avatar button */
.nostrpass-user-btn {
  background: linear-gradient(135deg, #your-color-1, #your-color-2) !important;
}

/* Customize the dropdown */
.nostrpass-dropdown {
  border-radius: 16px !important;
}
```

---

## Framework Examples

### React

```typescript
// useNostrPass.ts
import { useEffect, useState } from 'react';

interface NostrPassConfig {
  vaultUrl?: string;
  appName?: string;
  debug?: boolean;
}

export function useNostrPass(config?: NostrPassConfig) {
  const [isReady, setIsReady] = useState(false);
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

    script.onerror = () => setError('Failed to load NostrPass SDK');
    document.body.appendChild(script);

    return () => { document.body.removeChild(script); };
  }, []);

  const getPublicKey = async () => {
    const pk = await window.nostr.getPublicKey();
    setPubkey(pk);
    return pk;
  };

  const signEvent = async (event: any) => {
    return await window.nostr.signEvent(event);
  };

  return { isReady, pubkey, error, getPublicKey, signEvent };
}
```

```typescript
// App.tsx
import { useNostrPass } from './useNostrPass';

function App() {
  const { isReady, pubkey, getPublicKey, signEvent } = useNostrPass({
    vaultUrl: 'https://vault.example.com',
    appName: 'My React App'
  });

  if (!isReady) return <div>Loading NostrPass...</div>;

  return (
    <div>
      <h1>NostrPass React Example</h1>
      {!pubkey ? (
        <button onClick={() => getPublicKey()}>Login</button>
      ) : (
        <p>Connected: {pubkey}</p>
      )}
    </div>
  );
}
```

### Vue 3

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

    script.onerror = () => { error.value = 'Failed to load NostrPass SDK'; };
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

  return { isReady, pubkey, error, getPublicKey, signEvent };
}
```

```vue
<template>
  <div>
    <h1>NostrPass Vue Example</h1>
    <div v-if="!isReady">Loading...</div>
    <div v-else>
      <button v-if="!pubkey" @click="handleLogin">Login</button>
      <p v-else>Connected: {{ pubkey }}</p>
    </div>
  </div>
</template>

<script setup>
import { useNostrPass } from './useNostrPass';

const { isReady, pubkey, getPublicKey } = useNostrPass({
  vaultUrl: 'https://vault.example.com',
  appName: 'My Vue App'
});

const handleLogin = async () => { await getPublicKey(); };
</script>
```

### Svelte

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
      nostrpass.update(s => ({ ...s, error: 'Failed to load SDK' }));
      reject('Failed to load SDK');
    };

    document.body.appendChild(script);
  });
}

export async function getPublicKey() {
  const pubkey = await window.nostr.getPublicKey();
  nostrpass.update(s => ({ ...s, pubkey }));
  return pubkey;
}
```

```svelte
<script>
  import { onMount } from 'svelte';
  import { nostrpass, initNostrPass, getPublicKey } from './nostrpass';

  onMount(async () => {
    await initNostrPass({ vaultUrl: 'https://vault.example.com' });
  });
</script>

<h1>NostrPass Svelte Example</h1>

{#if !$nostrpass.isReady}
  <p>Loading...</p>
{:else if !$nostrpass.pubkey}
  <button on:click={getPublicKey}>Login</button>
{:else}
  <p>Connected: {$nostrpass.pubkey}</p>
{/if}
```

### Next.js

```typescript
// components/NostrPassProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const NostrContext = createContext<any>(null);

export function NostrPassProvider({ children, config = {} }) {
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
    return () => { document.body.removeChild(script); };
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

---

## Advanced Integration

### Self-Hosted Vault

```html
<script src="https://vault.mycompany.com/embassy.js" data-manual-init="true"></script>
<script>
  window.initNostrPass({
    vaultUrl: 'https://vault.mycompany.com',
    trustedOrigins: ['https://vault.mycompany.com'],
    appName: 'My Company App',
    theme: 'dark',
    debug: true
  });
</script>
```

### Multi-Vault Support

Allow users to choose their vault:

```javascript
const vaults = [
  { name: 'NostrPass (Official)', url: 'https://nostrpass.com' },
  { name: 'Community Vault', url: 'https://community-vault.io' },
  { name: 'Self-Hosted', url: 'custom' }
];

async function connectToVault(vaultUrl) {
  window.initNostrPass({
    vaultUrl,
    trustedOrigins: [new URL(vaultUrl).origin],
    appName: 'Multi-Vault App'
  });

  const pubkey = await window.nostr.getPublicKey();
  console.log('Connected:', pubkey);
}
```

### Fallback Vault Strategy

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
        trustedOrigins: [new URL(vaultUrl).origin]
      });

      await window.nostr.getPublicKey();
      console.log(`Connected to: ${vaultUrl}`);
      return true;
    } catch (err) {
      console.warn(`Failed: ${vaultUrl}`, err);
      continue;
    }
  }
  throw new Error('All vaults failed');
}
```

### Testing Your Integration

```javascript
async function testNostrPassIntegration() {
  console.log('Testing NostrPass integration...');

  // Test 1: SDK loaded
  if (!window.nostr) throw new Error('window.nostr not available');
  console.log('✓ SDK loaded');

  // Test 2: Get public key
  const pubkey = await window.nostr.getPublicKey();
  if (!pubkey || pubkey.length !== 64) throw new Error('Invalid public key');
  console.log('✓ Public key obtained:', pubkey);

  // Test 3: Sign event
  const event = {
    kind: 1,
    content: 'Test event',
    tags: [],
    created_at: Math.floor(Date.now() / 1000)
  };
  const signed = await window.nostr.signEvent(event);
  if (!signed.sig || !signed.id) throw new Error('Event signing failed');
  console.log('✓ Event signed');

  // Test 4: NIP-04 encryption
  if (window.nostr.nip04) {
    await window.nostr.nip04.encrypt(pubkey, 'secret message');
    console.log('✓ NIP-04 encryption works');
  }

  console.log('All tests passed! ✅');
}
```

---

## Complete Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Nostr App</title>
  <script defer src="https://cdn.nostrpass.com/embassy.js"></script>
</head>
<body>
  <div id="app">
    <h1>Welcome to My Nostr App</h1>
    <div id="auth-container"></div>
  </div>

  <script>
    window.addEventListener('DOMContentLoaded', () => {
      const nostr = window.initNostrPass({
        appName: 'My Nostr App',
        vaultUrl: 'https://vault.nostrpass.com/'
      });

      const authButton = nostr.createNostrPassButton({
        appendTo: '#auth-container',
        onSignIn: async (user) => {
          console.log('✅ Signed in:', user);
          const pubkey = await nostr.getPublicKey();
          console.log('Public key:', pubkey);
        },
        onSignOut: () => {
          console.log('👋 Signed out');
        }
      });

      authButton.restoreSession();
    });
  </script>
</body>
</html>
```

---

## Best Practices

1. **Always restore sessions on page load** for seamless UX
2. **Handle the `onError` callback** for user-friendly error messages
3. **Use the `onSignIn` callback** to initialize your app state
4. **Call `destroy()`** when unmounting the button in a SPA
5. **Test with multiple browsers** to ensure compatibility

## Need Help?

- **Protocol Spec**: See [PROTOCOL.md](PROTOCOL.md)
- **Self-Hosting**: See [SELF_HOSTING.md](SELF_HOSTING.md)
- **Issues**: Open a GitHub issue
