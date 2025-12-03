# NostrPass Security

This document covers the complete security model for NostrPass, including cryptographic design, permission system, and critical security requirements.

## Security Overview

NostrPass implements defense-in-depth security with multiple layers of protection:

1. **Isolation**: Components run in separate contexts (iframe, worker, WASM)
2. **Encryption**: All sensitive data encrypted at rest and in transit
3. **Authentication**: Multi-factor with password + optional PIN
4. **Authorization**: Granular permission system per app and identity
5. **Validation**: Origin checking and message verification

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Security Layers                         │
├─────────────────────────────────────────────────────────────┤
│  1. Origin Validation (Cross-Origin Security)               │
│     - Whitelist allowed origins                             │
│     - Validate every message                                │
│     - Reject unauthorized sources                           │
├─────────────────────────────────────────────────────────────┤
│  2. Iframe Sandbox (Process Isolation)                      │
│     - Restricted permissions                                │
│     - No access to parent DOM                               │
│     - Controlled communication only                         │
├─────────────────────────────────────────────────────────────┤
│  3. Worker Context (Thread Isolation)                       │
│     - Private keys never leave worker                       │
│     - Session-based access model                            │
│     - Automatic session expiry                              │
├─────────────────────────────────────────────────────────────┤
│  4. Encryption Layer (Data Protection)                      │
│     - AES-256-GCM for vault data                           │
│     - Argon2 key derivation                                │
│     - NIP-04 for Nostr messages                            │
├─────────────────────────────────────────────────────────────┤
│  5. Permission System (Access Control)                      │
│     - Per-identity permissions                              │
│     - Granular operation control                            │
│     - User consent required                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Critical Security Rules

These are non-negotiable security requirements that MUST be maintained.

### 1. Master Key (xpriv) Isolation

- **The xpriv (master private key) MUST NEVER leave the WASM module**
- The xpriv must be decrypted ONLY within the WASM module (not even in the JS worker)
- Neither the main thread nor the JavaScript worker should have access to the unencrypted xpriv
- All cryptographic operations using the xpriv must happen in WASM
- The WASM module should maintain secure sessions internally

### 2. Key Derivation and Storage

- The xpriv uses nested encryption: PIN-encrypted xpriv is then password-encrypted
- The PIN provides the first layer of encryption for daily access
- The password provides the outer layer of encryption for the entire vault
- Identity private keys should be derived in WASM and only the specific identity key should be returned

### 3. Worker and WASM Communication

- All sensitive cryptographic operations MUST happen in WASM
- The worker acts as a bridge but should NOT see sensitive data
- WASM should expose only high-level operations with session management
- Never pass raw keys between any contexts

### 4. Session Management

- The WASM module maintains the decrypted xpriv in memory during a session
- WASM should use opaque session tokens that cannot be used to extract the xpriv
- When the vault is locked, WASM MUST clear all sensitive data from memory
- No sensitive data should persist in the JavaScript worker or main thread
- Session tokens should expire after a timeout period

### 5. PIN Security in WASM

- PIN derivation and verification MUST happen in WASM
- PIN should never be logged or stored in plaintext
- PIN hash should be derived using PBKDF2 or similar in WASM
- Failed PIN attempts should be rate-limited in WASM

---

## Cryptographic Security

### Key Hierarchy

```
User Password
     │
     ├─── Argon2 ──► Encryption Key
     │                    │
     │                    └──► Encrypt Master Key (xpriv)
     │
     └─── SHA-256 ──► Password Verifier

User PIN (optional)
     │
     ├─── Argon2 ──► PIN Encryption Key
     │                    │
     │                    └──► Encrypt Master Key (xpriv)
     │
     └─── SHA-256 ──► PIN Hash (for verification)

Master Key (xpriv)
     │
     └─── BIP32 Derivation
              │
              ├──► Identity 0 (Personal)
              ├──► Identity 1 (Work)
              ├──► Identity N (Custom)
              └──► Identity 2^31-1 (Storage)
```

### Encryption Specifications

**Vault Data Encryption:**
- Algorithm: AES-256-GCM
- Key Derivation: Argon2id
  - Memory: 64MB
  - Iterations: 3
  - Parallelism: 4
  - Salt: 32 bytes (random)

**NIP-04 Message Encryption:**
- Algorithm: AES-256-CBC
- Key Agreement: ECDH (secp256k1)
- IV: 16 bytes (random)
- Format: `base64(encrypted)?iv=hex(iv)`

**PIN Encryption:**
- Algorithm: AES-256-GCM
- Key Derivation: Argon2id (separate salt)
- Additional: PIN hash stored for verification

### Key Storage Security

```javascript
// Keys are NEVER stored in plaintext
// Storage hierarchy:

// 1. Master key (xpriv) - Encrypted with PIN or password
{
  encryptedXpriv: "encrypted_base64_data",
  salt: "hex_salt_for_password",
  pinSalt: "hex_salt_for_pin"
}

// 2. Session private key - Only in worker memory
// Never serialized or sent to main thread

// 3. Storage keys - Derived on demand
// Used for vault operations only
```

---

## Permission System

### Permission Model

```typescript
type PermissionLevel =
  | 'ALLOW'           // Always allow
  | 'ASK_PER_SESSION' // Ask once per session
  | 'ASK_EVERYTIME'   // Ask every time
  | 'DENY';           // Always deny

interface AppPermissions {
  // Operation permissions
  kinds: Record<number, PermissionLevel>;  // Per event kind
  signData: PermissionLevel;               // Arbitrary signing
  getPublicKey?: PermissionLevel;          // Pubkey access
  nip04?: PermissionLevel;                 // Encryption
  getRelays?: PermissionLevel;             // Relay access

  // Session state
  sessionPermissions?: {
    kinds: Record<number, boolean>;
    signData: boolean;
    expiresAt: number;
  };
}
```

### Permission Flow

```
┌─────────────────┐
│ Operation Request │
└────────┬────────┘
         ▼
┌─────────────────┐     No      ┌─────────────────┐
│ Permission Exists? │ ────────► │ Default: ASK    │
└────────┬────────┘             └────────┬────────┘
         │ Yes                           │
         ▼                               ▼
┌─────────────────┐             ┌─────────────────┐
│ Check Permission │             │ Show Permission │
│     Level        │             │       UI        │
└────────┬────────┘             └────────┬────────┘
         │                               │
    ┌────┼────┬────┬────┐               │
    ▼    ▼    ▼    ▼    ▼               ▼
  ALLOW DENY ASK   ASK_SESSION    User Decision
    │    │    │         │              │
    ▼    ▼    ▼         ▼              ▼
 Execute Reject Prompt Check       Grant/Deny
                        Session
```

### Default Permissions

When user signs up through an app:

```javascript
{
  kinds: {
    1: 'ALLOW'  // Text notes auto-granted
  },
  signData: 'DENY',
  getPublicKey: 'ALLOW',  // Auto-granted for signup app
  nip04: 'ASK_EVERYTIME',
  getRelays: 'ASK_EVERYTIME'
}
```

---

## Authentication Security

### Multi-Factor Authentication

```
[Start] → Username/Password → Check Vault
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
               Vault Found    New User       Not Found
                    │              │              │
                    ▼              ▼              ▼
               Has PIN?      Setup PIN      Fetch Nostr
                    │              │              │
              ┌─────┴─────┐        │              │
              ▼           ▼        ▼              ▼
          Request PIN  No PIN  Authenticated   Retry
              │           │
              ▼           ▼
          Verify PIN  Authenticated
              │
         ┌────┴────┐
         ▼         ▼
      Valid    Invalid (5x)
         │         │
         ▼         ▼
   Authenticated  Locked
```

### Session Management

**Session Properties:**
- Stored only in worker memory
- Automatic expiration (1 hour default)
- Cleared on logout or page refresh
- Contains decrypted private key

**Session Security:**
```javascript
// Session structure (in worker only)
{
  username: string,
  privateKey: string,      // Never leaves worker
  publicKey: string,
  identityIndex: number,
  expiresAt: number,
  createdAt: number
}
```

### PIN Security

**PIN Requirements:**
- Minimum 4 digits
- Maximum 8 digits
- Numbers only
- Different from username

**PIN Protection:**
- 5 attempt limit
- 5 minute lockout after max attempts
- Separate salt from password
- Hash stored for verification

---

## Origin Security

### Origin Validation

```javascript
// Every message validated
function validateOrigin(event: MessageEvent): boolean {
  const allowedOrigins = [
    'https://app.example.com',
    'https://trusted-app.com'
  ];

  return allowedOrigins.includes(event.origin);
}
```

### Development vs Production

**Development:**
```javascript
const devOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000'
];
```

**Production:**
```javascript
const prodOrigins = [
  'https://nostrpass.com',
  'https://app.nostrpass.com'
];
```

---

## Attack Mitigation

### Common Attack Vectors

**Cross-Site Scripting (XSS):**
- Content Security Policy enforced
- No inline scripts
- Input sanitization

**Clickjacking:**
- X-Frame-Options header
- Frame ancestors restricted
- UI overlay detection

**Message Injection:**
- Origin validation
- Message structure verification
- Timestamp validation (5 min window)

### Defense Mechanisms

```javascript
// Message validation
function isValidMessage(message: any): boolean {
  return (
    message &&
    typeof message.id === 'string' &&
    typeof message.type === 'string' &&
    typeof message.timestamp === 'number' &&
    typeof message.origin === 'string' &&
    // Timestamp within 5 minutes
    Math.abs(Date.now() - message.timestamp) < 300000
  );
}
```

---

## Data Security

### Storage Security

**IndexedDB:**
- Encrypted before storage
- No plaintext sensitive data
- Automatic cleanup on logout

**Nostr Network:**
- Vault encrypted before publishing
- Kind 30078 (replaceable)
- Signed with storage identity

### Memory Security

**Sensitive Data Handling:**
```javascript
// Good: Data stays in worker
worker.postMessage({ type: 'sign', data: eventData });

// Bad: Private key in main thread
const privateKey = getPrivateKey(); // Never do this!
```

**Automatic Cleanup:**
- Sessions expire after timeout
- Memory cleared on logout
- No persistent decrypted data

---

## Security Best Practices

### For Developers

**Integration Security:**
```javascript
// Good: Check authentication state
try {
  const pubkey = await window.nostr.getPublicKey();
  // User is authenticated
} catch (error) {
  // Handle unauthenticated state
}

// Good: Handle permission denials
try {
  const signed = await window.nostr.signEvent(event);
} catch (error) {
  if (error.message === 'User denied permission') {
    // Show explanation to user
  }
}
```

**Origin Configuration:**
```javascript
// Always specify exact origins in production
const embassy = new Embassy({
  vaultUrl: 'https://vault.nostrpass.com',
  allowedOrigins: ['https://myapp.com']
});
```

### For Users

**Account Security:**
1. Use strong, unique password
2. Enable PIN for additional security
3. Set up recovery questions
4. Review app permissions regularly

**Permission Management:**
1. Only grant necessary permissions
2. Use session permissions for temporary access
3. Revoke unused app permissions
4. Check permission requests carefully

---

## Security Audit Checklist

- [ ] No xpriv in main thread code
- [ ] No xpriv in JavaScript worker code
- [ ] All crypto operations in WASM
- [ ] WASM maintains secure sessions with opaque tokens
- [ ] PIN operations happen in WASM
- [ ] Proper session cleanup in WASM
- [ ] Encrypted storage only
- [ ] Minimal data exposure between contexts
- [ ] No key material in console logs
- [ ] Secure memory cleanup on lock/logout
- [ ] Rate limiting for PIN attempts
- [ ] Constant-time comparisons for secrets

---

## Future Security Enhancements

### Planned Features

**Hardware Security:**
- WebAuthn support
- Hardware wallet integration
- Biometric authentication

**Advanced Permissions:**
- Time-based restrictions
- Amount limits for financial operations
- Geolocation restrictions
- Device-specific permissions

**Enhanced Recovery:**
- Social recovery (M-of-N)
- Threshold signatures
- Dead man's switch

### Continuous Improvement

- Regular security audits
- Penetration testing
- Bug bounty program
- Community security reviews
