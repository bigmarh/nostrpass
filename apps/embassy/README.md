# NostrPass Embassy

This app serves two purposes:

1. **Embassy Development App** - A SolidJS app for developing and testing the embassy integration
2. **Embassy SDK** - Builds the `embassy.js` library that third-party apps embed

## Embassy SDK (embassy.js)

The embassy SDK allows any website to integrate NostrPass authentication.

### Build the SDK

```bash
pnpm build:lib
```

This creates `dist-lib/embassy.js` - a standalone JavaScript file that third parties can use.

### Integration Guide

#### Basic Integration

```html
<!-- Auto-initialize with default settings -->
<script src="https://nostrpass.com/embassy.js" data-auto-init></script>
```

#### Advanced Integration

```html
<script src="https://nostrpass.com/embassy.js"></script>
<script>
  // Custom configuration
  window.initNostrPass({
    appName: 'My Nostr App',
    appDomain: 'myapp.com',
    permissions: ['getPublicKey', 'signEvent', 'nip04.encrypt'],
    theme: 'dark',
    size: 'large',
    button: {
      show: true,
      className: 'my-custom-class'
    }
  });
</script>
```

#### Using the Nostr API

Once integrated, the standard `window.nostr` API is available:

```javascript
// Get public key
const pubkey = await window.nostr.getPublicKey();

// Sign an event
const signedEvent = await window.nostr.signEvent({
  kind: 1,
  content: "Hello Nostr!",
  tags: [],
  created_at: Math.floor(Date.now() / 1000)
});

// NIP-04 encryption
const encrypted = await window.nostr.nip04.encrypt(recipientPubkey, "secret message");
```

#### NostrPass Button Component

Create a customizable authentication button similar to Clerk's user button:

```javascript
const button = window.nostr.createNostrPassButton({
  appendTo: '#auth-button',        // Element selector or HTMLElement
  theme: 'auto',                    // 'light', 'dark', or 'auto' (default)
  showNpub: true,                   // Show npub in dropdown
  showManageAccount: true,          // Show "Manage Account" option
  onSignIn: (user) => {
    console.log('User signed in:', user);
  },
  onSignOut: () => {
    console.log('User signed out');
  }
});
```

**Theme Options:**
- `'light'` - Always light theme (white background, dark text)
- `'dark'` - Always dark theme (dark background, light text)
- `'auto'` - Follow system preference (default)

The button automatically:
- Shows "Sign in with NostrPass" when logged out
- Shows user avatar and nickname when logged in
- Provides dropdown with identity switching and logout
- Syncs across all instances when vault data changes

#### Programmatic Control

```javascript
// Show/hide vault manually
await window.nostrPass.showVault();
window.nostrPass.hideVault();

// Check authentication
const isAuth = window.nostrPass.isAuthenticated();

// Logout
await window.nostrPass.logout();
```

### How It Works

1. **No Framework Dependencies** - Pure JavaScript, works with any site
2. **Secure iframe** - NostrPass vault runs in isolated iframe
3. **Provider Override** - Replaces `window.nostr` with NostrPass implementation
4. **Message Passing** - Secure postMessage communication with vault
5. **Request Queue** - Handles concurrent requests and retries

## Development App

The SolidJS app in this directory is for testing the embassy integration:

```bash
pnpm dev
```

This runs a development server where you can test the embassy functionality.