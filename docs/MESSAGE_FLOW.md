# NostrPass Message Flow Documentation

## Overview

This document details the complete message flow between components in NostrPass, including initialization, authentication, and all NIP-07 operations.

## Component Communication Architecture

```
┌──────────────┐     postMessage      ┌──────────────┐     Worker API    ┌──────────────┐
│   Embassy    │ ◄─────────────────► │    Vault     │ ◄───────────────► │Crypto Worker │
│   (Parent)   │    Cross-Origin      │   (Iframe)   │    Same-Origin    │  (Worker)    │
└──────────────┘                      └──────────────┘                    └──────────────┘
      ▲                                      ▲
      │                                      │
      └──────────────────┬───────────────────┘
                         │
                   IndexedDB / Nostr
```

## 1. Initialization Flow

### 1.1 Embassy Initialization

```mermaid
sequenceDiagram
    participant App
    participant Embassy
    participant Vault
    participant Worker

    App->>Embassy: Include embassy.js
    Embassy->>Embassy: Create iframe element
    Embassy->>Vault: Load vault in iframe
    Vault->>Worker: Initialize crypto worker
    Worker-->>Vault: Worker ready
    Vault->>Vault: Setup message handlers
    Vault->>Embassy: VAULT_READY
    Embassy->>Embassy: Setup window.nostr
    Embassy->>App: nostr:ready event
```

**Detailed Steps:**

1. **App includes Embassy SDK**
```javascript
// In app HTML
<script src="https://nostrpass.com/embassy.js"></script>
```

2. **Embassy creates iframe**
```javascript
// embassy.ts
const iframe = document.createElement('iframe');
iframe.src = `${VAULT_URL}?${params}`;
iframe.style.display = 'none';
document.body.appendChild(iframe);
```

3. **Vault sends ready signal**
```javascript
// Vault MessengerProvider.tsx
messenger.send('VAULT_READY', {
  timestamp: Date.now(),
  version: '1.0.0'
});
```

4. **Embassy completes setup**
```javascript
// Creates window.nostr object
window.nostr = {
  getPublicKey: () => embassy.getPublicKey(),
  signEvent: (event) => embassy.signEvent(event),
  // ... other methods
};
```

## 2. Authentication Flows

### 2.1 New User Registration

```mermaid
sequenceDiagram
    participant User
    participant Vault
    participant Worker
    participant IndexedDB
    participant Nostr

    User->>Vault: Enter username/password/PIN
    Vault->>Worker: generateXpriv()
    Worker-->>Vault: Master key (xpriv)
    Vault->>Worker: Create identities
    Worker-->>Vault: Identity keypairs
    Vault->>Worker: Encrypt vault data
    Worker-->>Vault: Encrypted data
    Vault->>IndexedDB: Store vault
    Vault->>Worker: createSession()
    Worker-->>Vault: Session created
    Vault->>Nostr: Publish encrypted vault
    Vault->>Embassy: AUTH_STATUS (authenticated)
```

**Message Details:**

1. **Generate master key**
```javascript
// Worker message
{
  type: 'generateXpriv',
  data: {}
}
// Response
{
  xpriv: "xprv...",
  xpub: "xpub..."
}
```

2. **Create session**
```javascript
// Worker message
{
  type: 'createSession',
  data: {
    username: "alice",
    vaultData: { ... },
    privateKey: "hex_private_key"
  }
}
```

### 2.2 User Login

```mermaid
sequenceDiagram
    participant User
    participant Vault
    participant Worker
    participant Storage

    User->>Vault: Enter username/password
    Vault->>Storage: Get vault data
    Storage-->>Vault: Encrypted vault
    Vault->>Worker: deriveKey(password)
    Worker-->>Vault: Derived key
    Vault->>Worker: decryptData(vault)
    Worker-->>Vault: Vault data
    
    alt Has PIN
        Vault->>User: Request PIN
        User->>Vault: Enter PIN
        Vault->>Vault: Verify PIN hash
        Vault->>Worker: Decrypt with PIN
        Worker-->>Vault: Decrypted xpriv
    end
    
    Vault->>Worker: createSession()
    Vault->>Embassy: AUTH_STATUS
```

## 3. NIP-07 Operation Flows

### 3.1 Get Public Key

```mermaid
sequenceDiagram
    participant App
    participant Embassy
    participant Vault
    participant PermissionService
    participant Worker

    App->>Embassy: window.nostr.getPublicKey()
    Embassy->>Vault: GET_PUBLIC_KEY
    Vault->>PermissionService: checkPermission()
    
    alt Permission Denied
        PermissionService-->>Vault: needsPrompt: true
        Vault->>User: Show permission UI
        User->>Vault: Grant/Deny
        Vault->>PermissionService: savePermission()
    end
    
    Vault->>Worker: getSession()
    Worker-->>Vault: Current identity pubkey
    Vault->>Embassy: GET_PUBLIC_KEY_RESPONSE
    Embassy->>App: Return pubkey
```

**Messages:**

```javascript
// Request
{
  id: "msg_123",
  type: "GET_PUBLIC_KEY",
  data: {
    appName: "MyApp",
    appDomain: "https://myapp.com"
  },
  timestamp: 1234567890,
  origin: "https://myapp.com"
}

// Response
{
  id: "msg_123",
  type: "GET_PUBLIC_KEY_RESPONSE",
  data: "d1d1747115d16751a97c239f46ec1703292c3b7e24e21e0e03b5b069fe58c7f9",
  timestamp: 1234567891,
  origin: "https://vault.nostrpass.com"
}
```

### 3.2 Sign Event

```mermaid
sequenceDiagram
    participant App
    participant Embassy
    participant Vault
    participant Permissions
    participant Worker

    App->>Embassy: window.nostr.signEvent(event)
    Embassy->>Vault: SIGN_EVENT
    Vault->>Permissions: checkPermission(kind)
    
    alt Needs Permission
        Vault->>User: Show permission UI
        User->>Vault: Grant/Deny
        
        alt Denied
            Vault->>Embassy: Error response
            Embassy->>App: Throw error
        end
    end
    
    Vault->>Worker: signEventWithSession()
    Worker->>Worker: Sign with private key
    Worker-->>Vault: Signed event
    Vault->>Embassy: SIGN_EVENT_RESPONSE
    Embassy->>App: Return signed event
```

**Messages:**

```javascript
// Request
{
  id: "msg_456",
  type: "SIGN_EVENT",
  data: {
    event: {
      kind: 1,
      created_at: 1234567890,
      tags: [],
      content: "Hello Nostr!"
    },
    appName: "MyApp",
    appDomain: "https://myapp.com"
  }
}

// Response
{
  id: "msg_456",
  type: "SIGN_EVENT_RESPONSE",
  data: {
    id: "event_id_hash",
    pubkey: "public_key_hex",
    created_at: 1234567890,
    kind: 1,
    tags: [],
    content: "Hello Nostr!",
    sig: "signature_hex"
  }
}
```

### 3.3 Encrypt (NIP-04)

```mermaid
sequenceDiagram
    participant App
    participant Embassy
    participant Vault
    participant Permissions
    participant Worker

    App->>Embassy: window.nostr.nip04.encrypt()
    Embassy->>Vault: ENCRYPT
    Vault->>Permissions: checkPermission('nip04')
    
    alt Permission Check
        Vault->>User: May show UI
        User->>Vault: Response
    end
    
    Vault->>Worker: encryptWithSession()
    Worker->>Worker: Generate shared secret
    Worker->>Worker: Encrypt message
    Worker-->>Vault: Encrypted content
    Vault->>Embassy: ENCRYPT_RESPONSE
    Embassy->>App: Return ciphertext
```

## 4. Permission System Flow

### 4.1 Permission Check Flow

```mermaid
flowchart TD
    A[Operation Request] --> B{Check Identity Permissions}
    B -->|No Permissions| C[Return ASK_EVERYTIME]
    B -->|Has Permissions| D{Check Permission Level}
    
    D -->|ALLOW| E[Allow Operation]
    D -->|DENY| F[Deny Operation]
    D -->|ASK_EVERYTIME| G[Show Permission UI]
    D -->|ASK_PER_SESSION| H{Check Session}
    
    H -->|Active Session| E
    H -->|No Session| G
    
    G -->|User Grants| I[Save Permission]
    G -->|User Denies| F
    
    I --> J{Session Permission?}
    J -->|Yes| K[Grant Temporary]
    J -->|No| L[Save Permanent]
    
    K --> E
    L --> E
```

### 4.2 Permission Storage Update

```javascript
// Permission structure per identity
{
  "https://app.com": {
    appId: "https://app.com",
    appName: "Example App",
    grantedAt: 1234567890,
    lastUsedAt: 1234567890,
    kinds: {
      1: "ALLOW",        // Text notes
      7: "ASK_PER_SESSION",  // Reactions
      30023: "DENY"      // Long-form content
    },
    signData: "ASK_EVERYTIME",
    getPublicKey: "ALLOW",
    nip04: "ASK_PER_SESSION"
  }
}
```

## 5. Worker Communication

### 5.1 Worker Message Pattern

All worker operations follow this pattern:

```javascript
// Main thread -> Worker
postMessage({
  type: 'operationName',
  data: { /* operation data */ }
});

// Worker -> Main thread
postMessage({
  success: true,
  data: { /* result data */ }
});
// OR
postMessage({
  success: false,
  error: "Error message"
});
```

### 5.2 Session-Based Operations

```mermaid
sequenceDiagram
    participant Vault
    participant Worker
    participant Session

    Note over Worker: Session must exist
    
    Vault->>Worker: signEventWithSession(data)
    Worker->>Session: getSession(username)
    
    alt No Session
        Worker-->>Vault: Error: No active session
    else Has Session
        Worker->>Worker: Use session private key
        Worker->>Worker: Perform operation
        Worker-->>Vault: Success response
    end
```

## 6. Error Handling Flow

### 6.1 Error Propagation

```mermaid
flowchart LR
    A[Worker Error] --> B[Vault Handler]
    B --> C[Embassy Handler]
    C --> D[App Promise Rejection]
    
    E[Permission Denied] --> B
    F[Timeout] --> C
    G[Network Error] --> B
```

### 6.2 Error Message Format

```javascript
// Error response
{
  id: "msg_789",
  type: "OPERATION_RESPONSE",
  data: {
    error: "User denied permission"
  },
  timestamp: 1234567890,
  origin: "https://vault.nostrpass.com"
}
```

## 7. Special Flows

### 7.1 Vault Visibility Control

```mermaid
sequenceDiagram
    participant User
    participant App
    participant Embassy
    participant Vault

    User->>App: Click "Manage Identity"
    App->>Embassy: Custom show vault call
    Embassy->>Vault: SHOW_VAULT
    Vault->>Vault: Display UI
    Vault->>Embassy: SHOW_VAULT_RESPONSE
    
    User->>Vault: Click close
    Vault->>Embassy: HIDE_VAULT
    Embassy->>Embassy: Hide iframe
    Embassy->>App: Vault hidden event
```

### 7.2 Authentication State Sync

```mermaid
sequenceDiagram
    participant Vault
    participant Embassy
    participant App

    Note over Vault: User logs in/out
    
    Vault->>Embassy: AUTH_STATUS
    Embassy->>Embassy: Update internal state
    Embassy->>App: nostr:auth event
    App->>App: Update UI
    
    Note over App: Can react to auth changes
```

## 8. Timeout and Retry Mechanisms

### 8.1 Request Timeout

```javascript
// Embassy timeout handling
const timeout = setTimeout(() => {
  pendingRequests.delete(messageId);
  reject(new Error('Request timeout'));
}, 30000); // 30 second default

// Clear on response
clearTimeout(timeout);
```

### 8.2 Retry Logic

```javascript
// App-level retry
async function retryOperation(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await wait(1000 * Math.pow(2, i)); // Exponential backoff
    }
  }
}
```

## 9. Performance Optimizations

### 9.1 Message Batching

Multiple operations can be batched:

```javascript
// Instead of multiple calls
await nostr.getPublicKey();
await nostr.signEvent(event1);
await nostr.signEvent(event2);

// Batch operation (future enhancement)
await nostr.batch([
  { method: 'getPublicKey' },
  { method: 'signEvent', params: [event1] },
  { method: 'signEvent', params: [event2] }
]);
```

### 9.2 Caching Strategies

```mermaid
flowchart TD
    A[Operation Request] --> B{Cacheable?}
    B -->|Yes| C{In Cache?}
    B -->|No| D[Execute Operation]
    
    C -->|Yes| E{Cache Valid?}
    C -->|No| D
    
    E -->|Yes| F[Return Cached]
    E -->|No| D
    
    D --> G[Update Cache]
    G --> H[Return Result]
    F --> H
```

## Summary

The message flow in NostrPass is designed to be:

1. **Secure**: All messages validate origin and use typed contracts
2. **Async**: All operations are promise-based with proper error handling
3. **Stateless**: Each message is self-contained with all needed context
4. **Traceable**: Unique IDs allow tracking request/response pairs
5. **Extensible**: New operations can be added without breaking existing flows

This architecture ensures reliable, secure communication between all components while maintaining clear separation of concerns.