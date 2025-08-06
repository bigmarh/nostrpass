# NostrPass API Reference

## Overview

NostrPass implements the NIP-07 (window.nostr) specification for seamless integration with Nostr applications. This document details all available API methods, their request/response formats, and usage examples.

## Installation

```javascript
// Include the Embassy SDK in your application
<script src="https://nostrpass.com/embassy.js"></script>

// Or install via npm
npm install @nostrpass/embassy
```

## Initialization

```javascript
// Initialize Embassy (happens automatically when script loads)
const embassy = new Embassy({
  app: 'YourAppName',
  returnUrl: 'https://yourapp.com/callback'
});

// The window.nostr object is automatically available after initialization
```

## API Methods

### 1. getPublicKey()

Returns the hex-encoded public key of the current identity.

**Request:**
```javascript
const pubkey = await window.nostr.getPublicKey();
```

**Response:**
```javascript
// Returns: string (hex-encoded public key)
"d1d1747115d16751a97c239f46ec1703292c3b7e24e21e0e03b5b069fe58c7f9"
```

**Permission Required:** `getPublicKey` - defaults to `ALLOW` for apps user signs up through

**Internal Message Format:**
```typescript
{
  type: 'GET_PUBLIC_KEY',
  data: {
    appName: string,
    appDomain: string
  }
}
```

### 2. signEvent(event)

Signs a Nostr event with the current identity's private key.

**Request:**
```javascript
const event = {
  kind: 1,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: "Hello Nostr!"
};

const signedEvent = await window.nostr.signEvent(event);
```

**Response:**
```javascript
{
  id: "8c41f89f93f5b4d1fb87c60f5e4153b4f88c8d99d6e595dcfa8c3a5e2a5e72f7",
  pubkey: "d1d1747115d16751a97c239f46ec1703292c3b7e24e21e0e03b5b069fe58c7f9",
  created_at: 1707432000,
  kind: 1,
  tags: [],
  content: "Hello Nostr!",
  sig: "908a15e2b9f0c4d5f8ab2f4e3d9c7b6a5e4d3c2b1a0908a15e2b9f0c4d5f8ab2f4e3d9c7b6a5e4d3c2b1a09"
}
```

**Permission Required:** Based on event kind (e.g., kind 1 requires permission for kind 1)

**Internal Message Format:**
```typescript
{
  type: 'SIGN_EVENT',
  data: {
    event: {
      kind: number,
      created_at: number,
      tags: string[][],
      content: string,
      pubkey?: string // Optional, will be set to current identity's pubkey
    },
    appName: string,
    appDomain: string
  }
}
```

### 3. nip04.encrypt(pubkey, plaintext)

Encrypts a message for a recipient using NIP-04 encryption.

**Request:**
```javascript
const recipientPubkey = "recipient_hex_pubkey";
const plaintext = "Secret message";

const ciphertext = await window.nostr.nip04.encrypt(recipientPubkey, plaintext);
```

**Response:**
```javascript
// Returns: string (base64 encoded encrypted content)
"VGhpcyBpcyBhbiBlbmNyeXB0ZWQgbWVzc2FnZQ==?iv=abcdef1234567890"
```

**Permission Required:** `nip04`

**Internal Message Format:**
```typescript
{
  type: 'ENCRYPT',
  data: {
    plaintext: string,
    recipientPubkey: string,
    appName: string,
    appDomain: string
  }
}
```

### 4. nip04.decrypt(pubkey, ciphertext)

Decrypts a message from a sender using NIP-04 decryption.

**Request:**
```javascript
const senderPubkey = "sender_hex_pubkey";
const ciphertext = "VGhpcyBpcyBhbiBlbmNyeXB0ZWQgbWVzc2FnZQ==?iv=abcdef1234567890";

const plaintext = await window.nostr.nip04.decrypt(senderPubkey, ciphertext);
```

**Response:**
```javascript
// Returns: string (decrypted plaintext)
"Secret message"
```

**Permission Required:** `nip04`

**Internal Message Format:**
```typescript
{
  type: 'DECRYPT',
  data: {
    ciphertext: string,
    senderPubkey: string,
    appName: string,
    appDomain: string
  }
}
```

### 5. getRelays() [Optional]

Returns the user's preferred relay list.

**Request:**
```javascript
const relays = await window.nostr.getRelays();
```

**Response:**
```javascript
{
  "wss://relay.damus.io": {
    read: true,
    write: true
  },
  "wss://relay.nostr.band": {
    read: true,
    write: false
  }
}
```

**Permission Required:** `getRelays`

### 6. signSchnorr(data) [Extension]

Signs arbitrary data with Schnorr signature.

**Request:**
```javascript
const data = "Message to sign";
const signature = await window.nostr.signSchnorr(data);
```

**Response:**
```javascript
// Returns: string (hex-encoded signature)
"5de5b87c942c7e899e5fd0b272c5a8d6f4a6a1b7..."
```

**Permission Required:** `signData`

## Permission System

### Permission Levels

Each operation can have one of four permission levels:

- **`ALLOW`**: Always allow without prompting
- **`ASK_PER_SESSION`**: Ask once per session, then remember
- **`ASK_EVERYTIME`**: Ask for permission every time
- **`DENY`**: Always deny the request

### Permission Structure

```typescript
interface AppPermissions {
  kinds: Record<number, PermissionLevel>;      // Per event kind permissions
  signData: PermissionLevel;                   // Arbitrary data signing
  getPublicKey?: PermissionLevel;              // Public key access
  nip04?: PermissionLevel;                     // Encryption/decryption
  getRelays?: PermissionLevel;                 // Relay list access
  sessionPermissions?: {                       // Temporary session grants
    kinds: Record<number, boolean>;
    signData: boolean;
    expiresAt: number;
  };
}
```

### Default Permissions

When a user signs up through an app:
- `getPublicKey`: `ALLOW`
- `kinds[1]`: `ALLOW` (text notes)
- All others: `ASK_EVERYTIME`

## Error Handling

All methods may throw errors in the following cases:

```javascript
try {
  const pubkey = await window.nostr.getPublicKey();
} catch (error) {
  // Possible errors:
  // - User denied permission
  // - User not logged in
  // - Vault not initialized
  // - Network error
  console.error('Failed to get public key:', error.message);
}
```

### Common Error Messages

- `"User denied permission"` - User clicked deny on permission prompt
- `"User not authenticated"` - No user is currently logged in
- `"Vault not ready"` - NostrPass vault is still initializing
- `"Invalid event"` - Event structure is invalid
- `"Timeout"` - Operation timed out (default 30 seconds)

## Events

The Embassy emits events for various state changes:

```javascript
// Listen for authentication state changes
window.addEventListener('nostr:auth', (event) => {
  console.log('Auth state changed:', event.detail);
  // event.detail = { isAuthenticated: boolean, publicKey?: string }
});

// Listen for vault visibility changes
window.addEventListener('nostr:vault:shown', () => {
  console.log('Vault UI is now visible');
});

window.addEventListener('nostr:vault:hidden', () => {
  console.log('Vault UI is now hidden');
});
```

## Advanced Usage

### Custom Timeout

```javascript
// Set custom timeout for operations (in milliseconds)
window.nostr.setTimeout(60000); // 60 seconds
```

### Multiple Identities

Users can switch between different identities in the NostrPass UI. Each identity has its own:
- Public/private keypair
- App permissions
- Settings and preferences

The active identity determines which keys are used for all operations.

### Session Management

Session permissions (`ASK_PER_SESSION`) expire when:
- User logs out
- Browser is closed
- Session timeout is reached (configurable)
- User manually revokes permissions

## Security Considerations

1. **Origin Validation**: All requests include the origin domain for security
2. **Iframe Isolation**: Vault runs in a sandboxed iframe
3. **No Private Key Access**: Private keys never leave the secure vault
4. **Permission Prompts**: Users must explicitly grant permissions
5. **Encrypted Storage**: All data is encrypted before storage

## Example Integration

```javascript
// Complete example of NostrPass integration
async function initializeNostr() {
  // Wait for Embassy to be ready
  if (!window.nostr) {
    await new Promise(resolve => {
      window.addEventListener('nostr:ready', resolve);
    });
  }

  // Check authentication status
  try {
    const pubkey = await window.nostr.getPublicKey();
    console.log('User authenticated with pubkey:', pubkey);
    
    // Sign a test event
    const event = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: "My first Nostr message!"
    };
    
    const signedEvent = await window.nostr.signEvent(event);
    console.log('Signed event:', signedEvent);
    
    // Send to relay
    // ... relay publishing code ...
    
  } catch (error) {
    console.log('User not authenticated or denied permission');
    // Show login UI or handle error
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeNostr);
```

## Troubleshooting

### Embassy not loading
- Check Content Security Policy allows iframes from nostrpass.com
- Ensure cookies are enabled for third-party contexts
- Check browser console for specific error messages

### Permission denied errors
- User may have previously denied permission
- Direct user to NostrPass settings to manage permissions
- Consider implementing a permission explanation UI

### Timeout errors
- Increase timeout for slow connections
- Implement retry logic for transient failures
- Check if NostrPass servers are accessible

## Migration Guide

If migrating from another NIP-07 provider:

1. The API is fully compatible - no code changes needed
2. Users will need to import or recreate their identities
3. Permissions will need to be re-granted
4. Consider implementing a migration wizard for users