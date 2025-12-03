# NostrPass API Reference

NostrPass implements the NIP-07 (window.nostr) specification for seamless integration with Nostr applications.

## Installation

```bash
# Install via npm/pnpm
npm install @nostrpass/provider
# or
pnpm add @nostrpass/provider
```

```html
<!-- Or use the IIFE build (self-host/CDN) -->
<script src="https://cdn.nostrpass.com/provider/index.iife.js"></script>
```

## Initialization

```javascript
import { initNostrPass } from '@nostrpass/provider';

const provider = initNostrPass({
  appName: 'YourAppName',
  vaultUrl: 'https://vault.nostrpass.com'
});

// window.nostr is now available
```

---

## API Methods

### getPublicKey()

Returns the hex-encoded public key of the current identity.

```javascript
const pubkey = await window.nostr.getPublicKey();
// Returns: "d1d1747115d16751a97c239f46ec1703292c3b7e24e21e0e03b5b069fe58c7f9"
```

**Permission Required:** `getPublicKey` - defaults to `ALLOW` for apps user signs up through

### signEvent(event)

Signs a Nostr event with the current identity's private key.

```javascript
const event = {
  kind: 1,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: "Hello Nostr!"
};

const signedEvent = await window.nostr.signEvent(event);
// Returns signed event with id, pubkey, and sig fields
```

**Permission Required:** Based on event kind

### nip04.encrypt(pubkey, plaintext)

Encrypts a message for a recipient using NIP-04 encryption.

```javascript
const recipientPubkey = "recipient_hex_pubkey";
const plaintext = "Secret message";

const ciphertext = await window.nostr.nip04.encrypt(recipientPubkey, plaintext);
// Returns: "VGhpcyBpcyBhbiBlbmNyeXB0ZWQgbWVzc2FnZQ==?iv=abcdef1234567890"
```

**Permission Required:** `nip04`

### nip04.decrypt(pubkey, ciphertext)

Decrypts a message from a sender using NIP-04 decryption.

```javascript
const senderPubkey = "sender_hex_pubkey";
const ciphertext = "VGhpcyBpcyBhbiBlbmNyeXB0ZWQgbWVzc2FnZQ==?iv=abcdef1234567890";

const plaintext = await window.nostr.nip04.decrypt(senderPubkey, ciphertext);
// Returns: "Secret message"
```

**Permission Required:** `nip04`

### getRelays() [Optional]

Returns the user's preferred relay list.

```javascript
const relays = await window.nostr.getRelays();
// Returns: { "wss://relay.damus.io": { read: true, write: true }, ... }
```

**Permission Required:** `getRelays`

### signSchnorr(data) [Extension]

Signs arbitrary data with Schnorr signature.

```javascript
const data = "Message to sign";
const signature = await window.nostr.signSchnorr(data);
// Returns: hex-encoded signature
```

**Permission Required:** `signData`

---

## Permission System

### Permission Levels

| Level | Description |
|-------|-------------|
| `ALLOW` | Always allow without prompting |
| `ASK_PER_SESSION` | Ask once per session, then remember |
| `ASK_EVERYTIME` | Ask for permission every time |
| `DENY` | Always deny the request |

### Permission Structure

```typescript
interface AppPermissions {
  kinds: Record<number, PermissionLevel>;      // Per event kind
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

---

## Error Codes

Standardized error codes surfaced by the provider and Vault:

| Code | Description |
|------|-------------|
| `E_LOCKED` | Vault is locked or session expired. Prompt user to unlock. |
| `E_PERMISSION_DENIED` | Operation was not authorized or user denied. |
| `E_TIMEOUT` | Request timed out. |
| `E_ORIGIN_REJECTED` | Message from unauthorized origin. |
| `E_INVALID_REQUEST` | Missing/invalid params or unauthenticated state. |
| `E_INTERNAL` | Unexpected internal error. |

### Error Handling

```typescript
try {
  await window.nostr.signEvent(evt);
} catch (e: any) {
  switch (e.code) {
    case 'E_LOCKED':
      // Show unlock prompt
      break;
    case 'E_PERMISSION_DENIED':
      // Explain and retry
      break;
    case 'E_TIMEOUT':
      // Retry with backoff
      break;
    default:
      // Fallback error handling
      break;
  }
}
```

### Common Error Messages

- `"User denied permission"` - User clicked deny on permission prompt
- `"User not authenticated"` - No user is currently logged in
- `"Vault not ready"` - NostrPass vault is still initializing
- `"Invalid event"` - Event structure is invalid
- `"Timeout"` - Operation timed out (default 30 seconds)

---

## Events

The provider emits events for various state changes:

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

---

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

---

## Internal Message Format

For implementers building custom integrations:

### Request Structure

```typescript
{
  id: "unique_request_id",
  type: "GET_PUBLIC_KEY",
  data: {
    appName: string,
    appDomain: string
  },
  timestamp: number,
  origin: string
}
```

### Response Structure

```typescript
{
  id: "unique_request_id",
  type: "GET_PUBLIC_KEY_RESPONSE",
  data: string,  // hex public key
  timestamp: number,
  origin: string
}
```

### Message Types

| Type | Description |
|------|-------------|
| `GET_PUBLIC_KEY` | Get public key for identity |
| `SIGN_EVENT` | Sign a Nostr event |
| `SIGN_DATA` | Sign arbitrary data |
| `ENCRYPT` | NIP-04 encrypt message |
| `DECRYPT` | NIP-04 decrypt message |
| `GET_RELAYS` | Get user's relay list |
| `VAULT_READY` | Vault initialization complete |
| `AUTH_STATUS` | Authentication state notification |

---

## Security Considerations

1. **Origin Validation**: All requests include the origin domain for security
2. **Iframe Isolation**: Vault runs in a sandboxed iframe
3. **No Private Key Access**: Private keys never leave the secure vault
4. **Permission Prompts**: Users must explicitly grant permissions
5. **Encrypted Storage**: All data is encrypted before storage

---

## Example Integration

```javascript
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

  } catch (error) {
    console.log('User not authenticated or denied permission');
  }
}

document.addEventListener('DOMContentLoaded', initializeNostr);
```

---

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

---

## Migration Guide

If migrating from another NIP-07 provider:

1. The API is fully compatible - no code changes needed
2. Users will need to import or recreate their identities
3. Permissions will need to be re-granted
4. Consider implementing a migration wizard for users
