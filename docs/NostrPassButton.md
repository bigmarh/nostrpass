# NostrPass Button - Production-Ready Auth Widget

The NostrPass Button is a production-ready authentication widget similar to Clerk's user button pattern. It provides a seamless sign-in/sign-out experience with a beautiful UI that automatically adapts to your app's theme.

## Features

- **🎨 Beautiful UI**: Gradient button design with smooth animations
- **🌓 Theme Support**: Auto-detects system theme (light/dark) or use manual override
- **👤 User Avatar**: Shows user avatar or initials after sign-in
- **📱 Dropdown Menu**: Clean dropdown with user info and account management
- **💾 Session Persistence**: Automatically restores user sessions across page loads
- **⚡ Easy Integration**: One line of code to add to your app

## Quick Start

### 1. Initialize NostrPass

```javascript
const nostr = window.initNostrPass({
  appName: 'My Awesome App',
  vaultUrl: 'https://vault.nostrpass.com/',
  debug: false
});
```

### 2. Create the Button

```javascript
const nostrpassButton = nostr.createNostrPassButton({
  appendTo: '#auth-container', // Element or selector
  theme: 'auto', // 'light', 'dark', or 'auto'
  showNpub: true,
  showManageAccount: true,
  onSignIn: (user) => {
    console.log('User signed in:', user);
    // user.identityIndex
    // user.publicKey
    // user.npub
    // user.nickname
  },
  onSignOut: () => {
    console.log('User signed out');
  },
  onError: (error) => {
    console.error('Auth error:', error);
  }
});
```

### 3. Session Management

```javascript
// Restore session on page load
nostrpassButton.restoreSession().then(restored => {
  if (restored) {
    const user = nostrpassButton.getUser();
    console.log('Session restored:', user);
  }
});
```

## Configuration Options

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

## User Info Interface

```typescript
interface UserInfo {
  identityIndex: number;
  publicKey: string;
  npub?: string;
  nickname?: string;
  avatar?: string; // Future: profile picture URL
  authorized: boolean;
}
```

## Methods

### `restoreSession()`

Attempts to restore a user session from sessionStorage.

```javascript
const restored = await nostrpassButton.restoreSession();
```

Returns: `Promise<boolean>` - `true` if session was restored

### `getUser()`

Gets the currently signed-in user.

```javascript
const user = nostrpassButton.getUser();
```

Returns: `UserInfo | null`

### `getElement()`

Gets the button container element.

```javascript
const element = nostrpassButton.getElement();
```

Returns: `HTMLDivElement`

### `destroy()`

Removes the button from the DOM.

```javascript
nostrpassButton.destroy();
```

## Styling

The button comes with built-in styles that automatically adapt to light/dark themes. You can override styles using CSS:

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
      // Initialize NostrPass
      const nostr = window.initNostrPass({
        appName: 'My Nostr App',
        vaultUrl: 'https://vault.nostrpass.com/'
      });

      // Create auth button
      const authButton = nostr.createNostrPassButton({
        appendTo: '#auth-container',
        onSignIn: async (user) => {
          console.log('✅ Signed in:', user);
          
          // Now you can use Nostr operations
          const pubkey = await nostr.getPublicKey();
          console.log('Public key:', pubkey);
        },
        onSignOut: () => {
          console.log('👋 Signed out');
        }
      });

      // Restore session if exists
      authButton.restoreSession();
    });
  </script>
</body>
</html>
```

## UI States

### 1. Sign In State (Unauthenticated)

- Shows a gradient button with "Sign in with NostrPass" text
- Clicking opens the account picker modal
- User selects an identity and authorizes your app

### 2. User Avatar State (Authenticated)

- Shows a circular avatar button with user initials or profile picture
- Clicking opens a dropdown menu with:
  - User profile info (name, npub)
  - "Manage Account" option (opens account picker to switch identities)
  - "Sign Out" option (clears session)

## Comparison with Other Auth Solutions

| Feature | NostrPass Button | Clerk | Auth0 |
|---------|------------------|-------|-------|
| Decentralized | ✅ | ❌ | ❌ |
| No Backend Required | ✅ | ❌ | ❌ |
| Privacy First | ✅ | ❌ | ❌ |
| Free Tier | ✅ Unlimited | Limited | Limited |
| Setup Time | < 5 minutes | 15-30 minutes | 15-30 minutes |

## Best Practices

1. **Always restore sessions on page load** to provide a seamless experience
2. **Handle the `onError` callback** to show user-friendly error messages
3. **Use the `onSignIn` callback** to initialize your app state
4. **Call `destroy()`** if you're unmounting the button in a SPA

## Advanced: Using with React

```jsx
import { useEffect, useRef } from 'react';

function AuthButton() {
  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!window.nostr || buttonRef.current) return;

    buttonRef.current = window.nostr.createNostrPassButton({
      appendTo: containerRef.current,
      onSignIn: (user) => {
        // Update your React state
        setUser(user);
      },
      onSignOut: () => {
        setUser(null);
      }
    });

    buttonRef.current.restoreSession();

    return () => {
      buttonRef.current?.destroy();
    };
  }, []);

  return <div ref={containerRef} />;
}
```

## Support

- 📚 [Full Documentation](https://docs.nostrpass.com)
- 💬 [Discord Community](https://discord.gg/nostrpass)
- 🐛 [Report Issues](https://github.com/nostrpass/nostrpass/issues)
- 📧 [Email Support](mailto:support@nostrpass.com)

