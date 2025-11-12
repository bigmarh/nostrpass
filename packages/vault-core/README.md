# @nostrpass/vault-core

Framework-agnostic core library for NostrPass vault operations.

## Overview

`@nostrpass/vault-core` provides the business logic layer for NostrPass vault functionality, completely independent of any UI framework. Use it with React, Vue, Svelte, SolidJS, or vanilla JavaScript.

## Features

- 🔐 **Authentication Management** - Login, logout, session handling
- 🗄️ **Vault Operations** - CRUD operations for vault data
- 🔑 **Identity Management** - Create, manage, and derive Nostr identities
- ✅ **Permission System** - Granular permission management
- 🔄 **Nostr Sync** - Backup and restore vaults via Nostr relays
- 🎯 **Framework Agnostic** - Works with any UI framework
- 📦 **TypeScript First** - Full type safety
- 🧪 **Fully Tested** - Comprehensive test coverage

## Installation

```bash
pnpm add @nostrpass/vault-core
```

## Quick Start

```typescript
import { VaultCore } from '@nostrpass/vault-core';

// Initialize vault core
const vault = new VaultCore({
  workerUrl: '/crypto.worker.js',
  environment: 'production'
});

// Listen to auth state changes
vault.auth.onAuthStateChanged((user) => {
  console.log('User:', user);
});

// Login
await vault.auth.login('username', 'password');

// Create identity
await vault.identity.createIdentity({
  name: 'My Identity',
  purpose: 'general'
});

// Sign event
const signedEvent = await vault.identity.signEvent(event);
```

## Architecture

```
VaultCore
├── AuthManager      - Authentication and sessions
├── VaultManager     - Vault CRUD operations
├── IdentityManager  - Identity and key management
├── PermissionManager - Permission system
└── NostrSyncManager - Relay synchronization
```

## API Documentation

### AuthManager

```typescript
// Login
await vault.auth.login(username, password);

// Logout
await vault.auth.logout();

// Unlock vault with PIN
await vault.auth.unlockVault(pin);

// Lock vault
await vault.auth.lockVault();

// Listen to auth state
vault.auth.onAuthStateChanged((user) => {
  // Handle user state change
});

// Listen to lock state
vault.auth.onLockStateChanged((isLocked) => {
  // Handle lock state change
});
```

### VaultManager

```typescript
// Get vault data
const vaultData = await vault.vault.getVaultData();

// Update vault data
await vault.vault.updateVaultData(vaultData);

// Delete vault
await vault.vault.deleteVault();
```

### IdentityManager

```typescript
// Create identity
const identity = await vault.identity.createIdentity({
  name: 'My Identity',
  purpose: 'general'
});

// List identities
const identities = vault.identity.getIdentities();

// Sign event
const signed = await vault.identity.signEvent(event, identityIndex);

// Encrypt/decrypt (NIP-04)
const encrypted = await vault.identity.encrypt(plaintext, recipientPubkey);
const decrypted = await vault.identity.decrypt(ciphertext, senderPubkey);
```

## Framework Integration

### React

```typescript
import { useEffect, useState } from 'react';
import { VaultCore } from '@nostrpass/vault-core';

function useAuth(vault: VaultCore) {
  const [user, setUser] = useState(null);
  const [isLocked, setIsLocked] = useState(true);

  useEffect(() => {
    const unsubAuth = vault.auth.onAuthStateChanged(setUser);
    const unsubLock = vault.auth.onLockStateChanged(setIsLocked);
    return () => {
      unsubAuth();
      unsubLock();
    };
  }, [vault]);

  return { user, isLocked };
}
```

### SolidJS

```typescript
import { createSignal, createEffect, onCleanup } from 'solid-js';
import { VaultCore } from '@nostrpass/vault-core';

function useAuth(vault: VaultCore) {
  const [user, setUser] = createSignal(null);
  const [isLocked, setIsLocked] = createSignal(true);

  createEffect(() => {
    const unsubAuth = vault.auth.onAuthStateChanged(setUser);
    const unsubLock = vault.auth.onLockStateChanged(setIsLocked);
    onCleanup(() => {
      unsubAuth();
      unsubLock();
    });
  });

  return { user, isLocked };
}
```

### Svelte

```typescript
import { writable } from 'svelte/store';
import { VaultCore } from '@nostrpass/vault-core';

function createVaultStore(vault: VaultCore) {
  const user = writable(null);
  const isLocked = writable(true);

  vault.auth.onAuthStateChanged(u => user.set(u));
  vault.auth.onLockStateChanged(l => isLocked.set(l));

  return { user, isLocked };
}
```

## Events

All managers extend EventEmitter and emit the following events:

### AuthManager Events
- `auth-state-changed` - User login/logout
- `lock-state-changed` - Vault locked/unlocked
- `session-expired` - Session timeout

### VaultManager Events
- `vault-updated` - Vault data changed
- `vault-synced` - Synced with Nostr

### IdentityManager Events
- `identity-created` - New identity created
- `identity-updated` - Identity modified
- `identity-deleted` - Identity removed

## Development

```bash
# Install dependencies
pnpm install

# Type check
pnpm typecheck

# Run tests
pnpm test

# Lint
pnpm lint
```

## License

See project root LICENSE file.
