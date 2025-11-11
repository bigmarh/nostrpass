# NostrPass Protocol Specification (NPS-01)

**Version:** 1.0.0
**Status:** Draft
**Authors:** NostrPass Contributors
**Last Updated:** 2025-11-11

## Abstract

NostrPass Protocol (NPS) is an open, decentralized authentication and identity management protocol built on Nostr (NIPs). It allows users to maintain cryptographic identities across multiple applications without relying on centralized services or browser extensions. Any party can implement a compatible vault or integrate the protocol into their applications.

## 1. Overview

### 1.1 Goals

- **Decentralization**: No single point of failure or control
- **Interoperability**: Any vault implementation can work with any application
- **User Sovereignty**: Users control their keys and data
- **Privacy**: Minimal data exposure, encrypted storage
- **Portability**: Users can migrate between vault providers

### 1.2 Architecture

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│              │         │              │         │              │
│  Third-Party │◄───────►│   Embassy    │◄───────►│    Vault     │
│     App      │  NIP-07 │     SDK      │ NPS-01  │ (Any Impl)   │
│              │   API   │              │ Protocol│              │
└──────────────┘         └──────────────┘         └──────────────┘
                                                          │
                                                          ▼
                                                   ┌──────────────┐
                                                   │    Nostr     │
                                                   │   Relays     │
                                                   └──────────────┘
```

## 2. Core Concepts

### 2.1 Namespace

Each vault implementation uses a **namespace** to identify its events on Nostr. The namespace ensures event uniqueness and allows multiple vault implementations to coexist.

**Format:** Domain name (e.g., `nostrpass.com`, `myvault.io`, `self-hosted.local`)

**Default:** `nostrpass.com` (reference implementation)

### 2.2 Storage Keys

Each user has a **storage keypair** used to:
- Sign vault data events
- Identify the user's data on Nostr
- Encrypt/decrypt vault data (combined with password)

The storage key is derived from the user's master seed and is separate from their identity keypairs.

### 2.3 Identity Keys

Users can have multiple **identity keypairs** managed by the vault:
- Used for signing Nostr events
- Used for encryption (NIP-04, NIP-44)
- Derived from master seed using BIP32/BIP85 derivation paths

## 3. Data Storage (Nostr Events)

### 3.1 Login Object (Kind 30078)

Stores the public reference to locate a user's vault data.

**Event Structure:**
```json
{
  "kind": 30078,
  "tags": [
    ["d", "{namespace}_login_{username_hash}_{environment}"],
    ["client", "{namespace}"],
    ["subject", "login-lookup"]
  ],
  "content": "{encrypted_login_data}",
  "pubkey": "{random_public_key}",
  "created_at": 1234567890
}
```

**Content (encrypted):**
```json
{
  "storagePublicKey": "hex_pubkey",
  "username": "alice",
  "createdAt": 1234567890,
  "version": 1
}
```

**Purpose:** Privacy-preserving username → storage key lookup

### 3.2 Vault Object (Kind 30078)

Stores the encrypted vault data containing identities, permissions, and settings.

**Event Structure:**
```json
{
  "kind": 30078,
  "tags": [
    ["d", "{namespace}_vault_{storage_pubkey}_{environment}"],
    ["client", "{namespace}"],
    ["subject", "encrypted-vault"],
    ["encryption", "password-aes"]
  ],
  "content": "{password_encrypted_vault_data}",
  "pubkey": "{storage_public_key}",
  "created_at": 1234567890
}
```

**Content (decrypted):**
```json
{
  "username": "alice",
  "publicKey": "storage_pubkey",
  "xprivEncrypted": "pin_encrypted_master_key",
  "salt": "hex_salt",
  "identities": [
    {
      "index": 0,
      "publicKey": "identity_pubkey",
      "name": "Main Identity",
      "nip05": "alice@example.com"
    }
  ],
  "permissions": {
    "app.example.com": {
      "identityIndex": 0,
      "allowed": ["getPublicKey", "signEvent"],
      "grantedAt": 1234567890
    }
  },
  "customRelays": ["wss://relay.example.com"],
  "version": 1,
  "updatedAt": 1234567890
}
```

### 3.3 Environment Separation

Vaults support multiple environments with isolated namespaces:

- **production**: `{namespace}_login_{hash}_production`
- **staging**: `{namespace}_login_{hash}_staging`
- **development**: `{namespace}_login_{hash}_development`

This allows testing without affecting production data.

## 4. Vault Communication Protocol

### 4.1 Transport

Communication between Embassy SDK and Vault uses `postMessage` with:
- Origin validation (whitelist)
- Timestamp validation (5-minute window)
- Request/response correlation (unique IDs)

### 4.2 Message Format

**Request:**
```json
{
  "id": "unique_request_id",
  "type": "GET_PUBLIC_KEY",
  "payload": {
    "appName": "My App",
    "appDomain": "myapp.com",
    "identityIndex": 0
  },
  "timestamp": 1234567890000
}
```

**Response:**
```json
{
  "id": "unique_request_id",
  "type": "GET_PUBLIC_KEY_RESPONSE",
  "payload": {
    "publicKey": "hex_pubkey"
  },
  "timestamp": 1234567890001
}
```

**Error:**
```json
{
  "id": "unique_request_id",
  "type": "ERROR",
  "payload": {
    "code": "VAULT_LOCKED",
    "message": "Vault is locked, please unlock"
  },
  "timestamp": 1234567890001
}
```

### 4.3 Core Message Types

#### 4.3.1 Authentication
- `CHECK_PERMISSION` - Check if operation requires user approval
- `UNLOCK_WITH_PIN` - Unlock vault with PIN
- `LOCK_VAULT` - Lock the vault

#### 4.3.2 Identity Operations
- `GET_PUBLIC_KEY` - Get public key for identity
- `SIGN_EVENT` - Sign a Nostr event
- `SIGN_DATA` - Sign arbitrary data
- `ENCRYPT` - NIP-04 encrypt message
- `DECRYPT` - NIP-04 decrypt message

#### 4.3.3 Management
- `GET_RELAYS` - Get user's relay list
- `VAULT_READY` - Vault initialization complete
- `NAVIGATE_TO_UNLOCK` - Request vault show unlock UI

### 4.4 NIP-07 Compatibility

The Embassy SDK exposes a NIP-07 compatible `window.nostr` interface:

```javascript
window.nostr = {
  getPublicKey: () => Promise<string>,
  signEvent: (event) => Promise<Event>,
  getRelays: () => Promise<Relays>,
  nip04: {
    encrypt: (pubkey, plaintext) => Promise<string>,
    decrypt: (pubkey, ciphertext) => Promise<string>
  }
}
```

## 5. Security Model

### 5.1 Encryption Layers

**Double Encryption Model:**
1. **PIN Encryption**: Master key (xpriv) encrypted with PIN-derived key
2. **Password Encryption**: Entire vault object encrypted with password-derived key

This ensures:
- Offline access with PIN
- Cloud storage security with password
- Compromise of one doesn't expose the other

### 5.2 Key Derivation

```
User Password → PBKDF2 → Password Key → Encrypt VaultObj
User PIN → PBKDF2 → PIN Key → Encrypt Master Key
Master Key → BIP32 → Identity Keys
Master Key → BIP85 → Storage Key
```

### 5.3 Origin Validation

Vaults MUST validate:
- Message origin matches whitelist
- Timestamp within 5-minute window
- Request ID not replayed

Embassy SDK MUST validate:
- Response origin matches vault origin
- Response ID matches request ID
- Signature valid (if present)

### 5.4 Permission Model

Applications declare required permissions:
```javascript
{
  permissions: [
    'getPublicKey',
    'signEvent',
    'nip04.encrypt',
    'nip04.decrypt'
  ]
}
```

Vaults store per-app permissions and require user approval for new permissions.

## 6. Implementation Requirements

### 6.1 Vault Implementation MUST

1. Support namespace configuration
2. Implement all core message types
3. Validate message origins and timestamps
4. Encrypt data before storing on Nostr
5. Support environment separation
6. Provide user permission controls

### 6.2 Vault Implementation SHOULD

1. Support custom relay configuration
2. Implement PIN unlock for UX
3. Support biometric authentication
4. Provide backup/recovery mechanisms
5. Support multiple identities per user

### 6.3 Embassy SDK Implementation MUST

1. Support custom vault URL configuration
2. Implement request/response correlation
3. Validate response origins
4. Provide NIP-07 compatible interface
5. Handle vault offline/error states gracefully

## 7. Configuration

### 7.1 Vault Configuration

Vaults can be configured with:

```javascript
{
  namespace: "myvault.io",           // Vault namespace
  environment: "production",          // Environment name
  relays: [...],                      // Default Nostr relays
  trustedOrigins: [...],              // Allowed app origins
  features: {
    multiIdentity: true,
    biometric: true,
    recovery: true
  }
}
```

### 7.2 Embassy Configuration

Apps configure the embassy with:

```javascript
{
  vaultUrl: "https://vault.myvault.io",  // Vault origin
  appName: "My App",                      // Display name
  appDomain: "myapp.com",                 // App domain
  permissions: [...],                     // Required permissions
  theme: "dark",                          // UI theme
  parentPinOverlay: false                 // Show PIN in app
}
```

## 8. Relay Requirements

Vaults and Embassy SDKs SHOULD:
- Use at least 3 relays for redundancy
- Support NIP-01 (basic protocol)
- Support NIP-09 (event deletion)
- Support NIP-78 (arbitrary custom app data)

Default relay list (reference):
```javascript
[
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band"
]
```

## 9. Migration and Interoperability

### 9.1 Vault Migration

Users can migrate between vault implementations by:
1. Exporting encrypted vault data from current vault
2. Importing into new vault implementation
3. Re-publishing vault data with new namespace (optional)

### 9.2 Multi-Vault Support

Embassy SDK can support multiple vaults:
```javascript
{
  vaults: [
    { url: "https://vault1.com", priority: 1 },
    { url: "https://vault2.com", priority: 2 }
  ]
}
```

## 10. Testing and Compliance

### 10.1 Test Suite

Implementation MUST pass:
- Message protocol tests
- Encryption/decryption tests
- Origin validation tests
- Permission flow tests

### 10.2 Compliance Badge

Implementations passing the test suite can claim:
> **NostrPass Protocol (NPS-01) Compatible**

## 11. Future Extensions

Potential protocol extensions (separate NIPs):
- **NPS-02**: Hardware wallet integration
- **NPS-03**: Social recovery mechanisms
- **NPS-04**: Multi-device synchronization
- **NPS-05**: Vault capability discovery (NIP-89 extension)
- **NPS-06**: Advanced permission policies

## 12. Reference Implementation

The reference implementation is available at:
- Vault: [https://github.com/nostrpass/vault](https://github.com/nostrpass/vault)
- Embassy SDK: [https://github.com/nostrpass/embassy](https://github.com/nostrpass/embassy)
- Protocol Spec: [https://github.com/nostrpass/protocol](https://github.com/nostrpass/protocol)

## 13. License

This specification is released under CC0 (public domain). Implementations may use any license.

## 14. References

- NIP-01: Basic protocol flow
- NIP-04: Encrypted Direct Messages
- NIP-07: window.nostr capability for web browsers
- NIP-09: Event Deletion
- NIP-78: Arbitrary custom app data
- BIP-32: Hierarchical Deterministic Wallets
- BIP-85: Deterministic Entropy From BIP32 Keychains

## 15. Changelog

- **v1.0.0 (2025-11-11)**: Initial specification draft
