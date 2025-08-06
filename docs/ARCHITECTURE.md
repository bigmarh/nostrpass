# NostrPass Architecture Overview

## System Architecture

NostrPass is a decentralized identity and credential management system built on the Nostr protocol. It consists of two main components that work together to provide secure, user-controlled identity management.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Third-Party App                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     window.nostr API                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                               ▲                                 │
│                               │                                 │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                    Embassy (SDK)                           │  │
│  │  - NIP-07 Interface Implementation                         │  │
│  │  - Iframe Management                                       │  │
│  │  - Message Router                                          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ postMessage
                                  │ (Cross-Origin)
┌─────────────────────────────────▼───────────────────────────────┐
│                          Vault (Iframe)                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    SolidJS Application                     │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │   Router    │  │  Providers  │  │   Components    │   │  │
│  │  │             │  │             │  │                 │   │  │
│  │  │ /login      │  │ AuthProvider│  │ LoginForm       │   │  │
│  │  │ /unlock     │  │ CryptoWorker│  │ Dashboard       │   │  │
│  │  │ /dashboard  │  │ Messenger   │  │ PermissionUI    │   │  │
│  │  │ /settings   │  │ Environment │  │ IdentityList    │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │                    Services                          │  │  │
│  │  │  - UserService: User management                     │  │  │
│  │  │  - PermissionService: Permission checks             │  │  │
│  │  │  - NostrService: Nostr network operations           │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Crypto Worker                           │  │
│  │  ┌─────────────────┐  ┌─────────────────────────────┐    │  │
│  │  │  Web Worker     │  │    WASM Module (Rust)       │    │  │
│  │  │                 │  │                             │    │  │
│  │  │ - Key Derivation│  │ - secp256k1 operations     │    │  │
│  │  │ - Event Signing │  │ - BIP32/BIP44 derivation   │    │  │
│  │  │ - Encryption    │  │ - Schnorr signatures       │    │  │
│  │  │ - Sessions      │  │ - NIP-04 encryption        │    │  │
│  │  └─────────────────┘  └─────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Storage Layer                           │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐  │
│  │     IndexedDB       │  │        Nostr Network          │  │
│  │                     │  │                               │  │
│  │  - User vaults      │  │  - Encrypted vault backup     │  │
│  │  - Session data     │  │  - Cross-device sync          │  │
│  │  - Cache            │  │  - Event kind 30078           │  │
│  └─────────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Embassy (Parent App SDK)

The Embassy is a lightweight JavaScript SDK that third-party applications include to integrate NostrPass functionality.

**Key Responsibilities:**
- Implements the `window.nostr` interface for NIP-07 compatibility
- Creates and manages the Vault iframe
- Handles secure message passing between the app and Vault
- Manages authentication state
- Provides promise-based API for all operations

**File Structure:**
```
apps/embassy/src/
├── embassy.ts              # Main Embassy class
├── embassyMessageHandlers.ts # Message handling logic
├── types.ts               # TypeScript definitions
└── index.html             # Test harness
```

### 2. Vault (Iframe Application)

The Vault is a full SolidJS application that runs in an iframe and handles all sensitive operations.

**Key Responsibilities:**
- User authentication and session management
- Identity creation and management
- Permission system enforcement
- Cryptographic operations via Web Worker
- UI for user interactions (login, permissions, settings)

**File Structure:**
```
apps/vault/src/
├── components/            # UI components
│   ├── LoginForm.tsx
│   ├── Dashboard.tsx
│   ├── PermissionPrompt.tsx
│   └── IdentitySettings.tsx
├── providers/            # Context providers
│   ├── AuthProvider.tsx  # Auth state & NIP-07 handlers
│   ├── CryptoWorkerProvider.tsx
│   └── MessengerProvider.tsx
├── services/             # Business logic
│   ├── userService.ts
│   ├── permissionService.ts
│   └── nostrService.ts
├── workers/              # Web Workers
│   ├── crypto.worker.ts
│   └── wasm-rust/       # WASM module
└── routes/              # Page components
```

### 3. Crypto Worker

A Web Worker that isolates all cryptographic operations from the main thread.

**Key Features:**
- Never exposes private keys to main thread
- Session-based operation model
- Integrates with WASM module for performance
- Handles all signing, encryption, and key derivation

**Operation Categories:**
- **Key Management**: Generation, derivation, import/export
- **Signing**: Event signing, message signing, Schnorr signatures
- **Encryption**: NIP-04 encrypt/decrypt, vault data encryption
- **Session Management**: Create, unlock, clear sessions

### 4. Storage Layer

**IndexedDB (Local Storage):**
- Primary storage for encrypted vault data
- Fast access for active sessions
- Offline capability

**Nostr Network (Sync & Backup):**
- Encrypted vault backup using kind 30078 events
- Cross-device synchronization
- Decentralized storage
- No central server dependency

## Data Flow

### 1. Initial Load Flow
```
1. App includes Embassy SDK
2. Embassy creates hidden iframe with Vault
3. Vault initializes and sends VAULT_READY
4. Embassy sets up window.nostr interface
5. App can now use NostrPass features
```

### 2. Authentication Flow
```
1. User clicks login in Vault UI
2. Vault checks IndexedDB for existing data
3. If not found, queries Nostr network
4. User enters password (and PIN if set)
5. Vault derives keys and creates session
6. Worker unlocks with private key
7. AUTH_STATUS sent to Embassy
8. App notified of auth state change
```

### 3. Operation Flow (e.g., Sign Event)
```
1. App calls window.nostr.signEvent(event)
2. Embassy sends SIGN_EVENT message to Vault
3. Vault checks permissions for origin + event kind
4. If needed, shows permission prompt
5. On approval, sends to Crypto Worker
6. Worker signs with session private key
7. Signed event returned through chain
8. App receives completed event
```

## Security Architecture

### Isolation Boundaries

1. **Process Isolation:**
   - Vault runs in sandboxed iframe
   - Different origin from parent app
   - Restricted permissions

2. **Thread Isolation:**
   - Crypto operations in Web Worker
   - Main thread never sees private keys
   - Session-based access model

3. **Memory Isolation:**
   - WASM module for crypto primitives
   - Separate memory space
   - No JavaScript access to internals

### Security Measures

1. **Origin Validation:**
   - All messages validate sender origin
   - Whitelist of allowed origins
   - Prevents unauthorized access

2. **Permission System:**
   - Per-app, per-identity permissions
   - Granular control by operation type
   - User consent required

3. **Encryption:**
   - All stored data encrypted
   - Keys derived from user password/PIN
   - No plaintext storage

4. **Session Security:**
   - Time-limited sessions
   - Automatic expiry
   - Clear on logout

## Identity System

### Hierarchical Deterministic (HD) Keys

NostrPass uses BIP32/BIP44 for deterministic key derivation:

```
Master Key (BIP39 Seed)
    │
    └── m/44'/1237'/0'/0  (Nostr purpose)
            │
            ├── /0  (Personal Identity)
            ├── /1  (Work Identity)
            ├── /2  (Anonymous Identity)
            └── /2^31-1  (Storage Identity)
```

### Identity Properties

Each identity has:
- Unique keypair derived from master
- Separate app permissions
- Individual settings
- Nickname for user recognition

### Storage Identity

Special identity at maximum index (2^31-1) used for:
- Signing vault storage events
- Vault encryption operations
- Never exposed to apps

## Message Protocol

### Message Structure
```typescript
{
  id: "msg_1234567890_abc",      // Unique ID
  type: "SIGN_EVENT",            // Operation type
  data: { ... },                 // Operation data
  timestamp: 1634567890123,      // Message time
  origin: "https://app.com"      // Sender origin
}
```

### Response Structure
```typescript
{
  id: "msg_1234567890_abc",      // Same ID as request
  type: "SIGN_EVENT_RESPONSE",   // Type + _RESPONSE
  data: { ... },                 // Response data
  timestamp: 1634567890456,      // Response time
  origin: "https://vault.nostrpass.com"
}
```

### Error Handling
```typescript
{
  id: "msg_1234567890_abc",
  type: "SIGN_EVENT_RESPONSE",
  data: { 
    error: "User denied permission" 
  },
  timestamp: 1634567890456,
  origin: "https://vault.nostrpass.com"
}
```

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading:**
   - Vault components loaded on demand
   - WASM module loaded when needed
   - Reduces initial load time

2. **Caching:**
   - IndexedDB for vault data
   - Memory cache for active sessions
   - Reduces Nostr queries

3. **Web Worker:**
   - Crypto operations off main thread
   - Prevents UI blocking
   - Parallel processing capability

4. **Batch Operations:**
   - Group similar operations
   - Reduce message passing overhead
   - Optimize worker utilization

### Scalability

- **Horizontal:** Multiple identities per user
- **Vertical:** Unlimited apps per identity
- **Network:** Decentralized Nostr storage
- **Local:** IndexedDB size limits considered

## Development Environment

### Technology Stack

- **Frontend:** SolidJS (reactive, performant)
- **Build:** Vite (fast development)
- **Language:** TypeScript (type safety)
- **Crypto:** Rust/WASM (performance)
- **Testing:** Vitest (unit tests)
- **Monorepo:** Turborepo (build orchestration)

### Package Structure
```
packages/
├── @nostrpass/types        # Shared TypeScript types
├── @nostrpass/messenger    # Message passing library
├── @nostrpass/nostrHelpers # Nostr utilities
└── @nostrpass/env          # Environment helpers

apps/
├── @nostrpass/embassy      # Parent app SDK
└── @nostrpass/vault        # Main vault application
```

## Future Enhancements

### Planned Features

1. **Multi-Device Sync:**
   - Real-time sync via Nostr
   - Conflict resolution
   - Device management

2. **Hardware Wallet Support:**
   - Sign with hardware devices
   - Cold storage integration
   - Enhanced security

3. **Social Recovery:**
   - Threshold signatures
   - Trusted contacts
   - Key recovery options

4. **Advanced Permissions:**
   - Time-based permissions
   - Amount limits for zaps
   - Conditional access rules

This architecture provides a secure, scalable foundation for decentralized identity management while maintaining compatibility with existing Nostr applications.