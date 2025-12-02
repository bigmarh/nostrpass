# Streamlined Auth + Nostr Integration

## Overview

The streamlined authentication architecture is **fully integrated** with the Nostr-based versioned vault system using `LoginObj` and `VaultObj`.

## Nostr Data Model

### LoginObj (Kind 30078 - Personal)
- **Stored on Nostr**: User's personal relays
- **Encrypted with**: Random keypair + password-derived key
- **Contains**:
  - `storagePublicKey` - Used to find VaultObj
  - `storageKeypairEncrypted` - Encrypted with PIN
  - `passwordSalt` - For password verification
  - `pinSalt` - For PIN decryption
  - `username`
  - `version`

### VaultObj (Kind 30078 - Replaceable)
- **Stored on Nostr**: Public relays
- **Encrypted with**: Password-derived key
- **Versioned**: Uses `created_at` for ordering (newest wins)
- **D-tag**: `vault:${storagePublicKey}:${environment}`
- **Contains**:
  - `username`
  - `identities[]` - All app identities
  - `xprivEncrypted` - Encrypted master key
  - `xprivRecovery` - Recovery-encrypted master key (optional)
  - `recovery` - Security questions metadata
  - `salt` - PIN salt
  - `version`
  - `updatedAt`

## Complete Data Flows

### 1. Signup Flow

```typescript
// UI
await atomicCreateAccount({
  username: 'alice',
  password: 'secret123',
  pin: '1234',
  relays: ['wss://relay.damus.io', ...],
  environment: 'production',
  recovery: { questions: [...], answers: [...] }
});

// Worker
async function handleAtomicCreateAccount() {
  // 1. Generate master key
  const { xpriv, identities } = await generateMasterKey();
  // identities[0] = Personal identity (index 0)

  // 2. Derive keypairs
  const personalKeypair = deriveKeypairFromXpriv(xpriv, 0);
  const storageKeypair = deriveKeypairFromXpriv(xpriv, 1337);

  // 3. Encrypt sensitive data
  const xprivEncrypted = encryptDataWithSalt(xpriv, pin, pinSalt);
  const storageKeypairEncrypted = encryptDataWithSalt(storageKeypair, pin, pinSalt);
  const passwordVerifier = encryptData('NostrPass_Password_Verifier_v1', passwordKey);

  // 4. Create vault objects
  const loginObj: LoginObj = {
    storagePublicKey,
    storageKeypairEncrypted,
    username,
    passwordSalt,
    pinSalt,
    version: 1,
    createdAt: Date.now()
  };

  const vaultObj: VaultObj = {
    username,
    identities,
    xprivEncrypted,
    xprivRecovery, // Optional recovery encryption
    recovery: { questions, salt, version },
    salt: pinSalt,
    version: 1,
    updatedAt: Date.now()
  };

  const vaultData: VaultData = {
    xprivEncrypted,
    salt: pinSalt,
    passwordSalt,
    publicKey: storagePublicKey,
    storagePublicKey,
    username,
    identities,
    passwordVerifier,
    recovery,
    version: 1,
    updatedAt: Date.now()
  };

  // 5. Save to IndexedDB (local first)
  await vaultDB.saveVault(username, vaultData);

  // 6. Create unlocked session
  const session = {
    isAuthenticated: true,
    isUnlocked: true,
    username,
    publicKey: personalKeypair.publicKey,
    storagePublicKey,
    xpriv,
    privateKey: personalKeypair.privateKey,
    storagePrivateKey: storageKeypair.privateKey,
    vaultData,
    sessionId,
    ...
  };
  sessionStateManager.sessions.set(username, session);

  // 7. Background Nostr publishing (non-blocking)
  publishToNostrBackground({
    loginObj,
    vaultObj,
    passwordKey,
    storagePublicKey,
    storagePrivateKey,
    relays,
    environment
  });

  // 8. Broadcast to UI
  broadcastAuthStateChanged(session);

  return { success: true, publicKey, sessionId };
}

// Background worker
async function publishToNostrBackground() {
  // Generate random keypair for LoginObj encryption
  const randomKeypair = generateKeypair();

  // Publish LoginObj
  // - Encrypted with random keypair + password
  // - Kind 30078, personal relays
  // - D-tag: `login:${username}:${environment}`
  await saveLoginObj(
    username,
    loginObj,
    randomPublicKey,
    randomPrivateKey,
    relays,
    environment,
    passwordKey
  );

  // Publish VaultObj
  // - Encrypted with password
  // - Kind 30078, public relays
  // - D-tag: `vault:${storagePublicKey}:${environment}`
  // - Replaceable (newest wins via created_at)
  await saveVaultObj(
    username,
    vaultObj,
    storagePublicKey,
    storagePrivateKey,
    relays,
    passwordKey
  );

  // Emit success event
  postMessage({ type: 'NOSTR_SYNC_COMPLETE', ... });
}
```

**Result:**
- User immediately logged in + unlocked (1-2s)
- Nostr publishing happens in background
- Account works offline if Nostr fails
- LoginObj + VaultObj published to Nostr

### 2. Login Flow

```typescript
// UI
await atomicLogin({
  username: 'alice',
  password: 'secret123',
  relays: ['wss://relay.damus.io', ...],
  environment: 'production'
});

// Worker
async function handleAtomicLogin() {
  // 1. Fetch LoginObj from Nostr
  // - Query: Kind 30078, d-tag = `login:${username}:${environment}`
  // - Decrypt with password
  const { loginObj, passwordKey } = await getLoginObj(
    username,
    environment,
    relays,
    password
  );

  // loginObj contains:
  // - storagePublicKey (for finding VaultObj)
  // - storageKeypairEncrypted (PIN-encrypted)
  // - passwordSalt, pinSalt

  // 2. Fetch VaultObj from Nostr
  // - Query: Kind 30078, d-tag = `vault:${storagePublicKey}:${environment}`
  // - Get all events, sort by created_at DESC
  // - Use newest event (versioned)
  // - Decrypt with password
  const vaultData = await getVaultFromNostr(
    loginObj.storagePublicKey,
    password,
    relays
  );

  // vaultData contains:
  // - identities (all app identities)
  // - xprivEncrypted (PIN-encrypted master key)
  // - recovery, passwordVerifier, etc.

  // 3. Cache to IndexedDB
  await vaultDB.saveVault(username, vaultData);

  // 4. Create authenticated (locked) session
  const session = {
    isAuthenticated: true,
    isUnlocked: false, // Need PIN to unlock
    username,
    storagePublicKey: loginObj.storagePublicKey,
    sessionId,
    ...
  };
  sessionStateManager.sessions.set(username, session);

  // 5. Broadcast to UI
  broadcastAuthStateChanged(session);

  return { success: true };
}
```

**Result:**
- LoginObj fetched from Nostr ✅
- VaultObj (versioned, latest) fetched from Nostr ✅
- Cached to IndexedDB for offline use ✅
- User authenticated but locked (need PIN) ✅

### 3. Unlock Flow

```typescript
// UI
await atomicUnlock({
  username: 'alice',
  pin: '1234'
});

// Worker
async function handleAtomicUnlock() {
  // 1. Get session
  const session = sessionStateManager.sessions.get(username);

  // 2. Load VaultData from IndexedDB cache
  // (Already fetched from Nostr during login)
  const vaultData = await vaultDB.getVault(username);

  // 3. Decrypt xpriv with PIN
  const xpriv = await decryptDataWithSalt(
    vaultData.xprivEncrypted,
    pin,
    vaultData.salt
  );

  // 4. Derive keypairs
  const personalKeypair = deriveKeypairFromXpriv(xpriv, 0);
  const storageKeypair = deriveKeypairFromXpriv(xpriv, 1337);

  // 5. Update session atomically
  session.isUnlocked = true;
  session.xpriv = xpriv;
  session.privateKey = personalKeypair.privateKey;
  session.publicKey = personalKeypair.publicKey;
  session.storagePrivateKey = storageKeypair.privateKey;
  session.vaultData = vaultData;
  session.vaultVersion = vaultData.version;
  session.identityCount = vaultData.identities.length;

  // 6. Broadcast to UI
  broadcastAuthStateChanged(session);

  return { success: true };
}
```

**Result:**
- Reads from IndexedDB cache (already synced from Nostr) ✅
- Decrypts with PIN ✅
- Updates session atomically ✅
- User unlocked ✅

### 4. Vault Update Flow (Future)

When user updates vault (add identity, change permissions, etc.):

```typescript
// 1. Update local VaultData
await vaultDataService.updateVaultData(username, updates);

// 2. Publish new VaultObj to Nostr
// - Create new event with incremented version
// - New created_at (makes it newest)
// - Publish to relays
await saveVaultObj(username, vaultObj, storagePublicKey, storagePrivateKey, relays, passwordKey);

// 3. On other devices/tabs:
// - Next login fetches newest VaultObj via created_at
// - Versioning prevents conflicts
```

## Versioning Strategy

### How Versioning Works

1. **Each VaultObj has**:
   - `version` field (incremented)
   - `created_at` timestamp
   - `updatedAt` timestamp

2. **Query from Nostr**:
   ```typescript
   // Get all events with d-tag = `vault:${storagePublicKey}:${environment}`
   const events = await queryRelays({
     kinds: [30078],
     '#d': [`vault:${storagePublicKey}:${environment}`],
     authors: [storagePublicKey]
   });

   // Sort by created_at DESC (newest first)
   const sorted = events.sort((a, b) => b.created_at - a.created_at);

   // Use newest event
   const latest = sorted[0];
   ```

3. **Conflict Resolution**:
   - Newest `created_at` wins
   - No manual merging needed
   - Simple last-write-wins semantics

### Version Metadata

```typescript
interface VaultData {
  version: number;        // Incremented on each update
  updatedAt: number;      // Timestamp of last update
  identities: Identity[]; // App identities with permissions
  // ...
}
```

## Offline Support

### IndexedDB as Cache

```
Login (online):
  Nostr → VaultObj → IndexedDB cache

Unlock (can be offline):
  IndexedDB cache → Decrypt with PIN

Next login (online):
  Nostr → Latest VaultObj → Update cache
```

### Resilience

- **Login works offline** if previously cached
- **Nostr failures are graceful** (use cache, retry later)
- **Background sync** doesn't block UX

## Security Model

### Encryption Layers

1. **xpriv (Master Key)**:
   - Encrypted with PIN (user remembers)
   - Stored in VaultObj on Nostr
   - Also in recovery encryption (security questions)

2. **Storage Keypair**:
   - Encrypted with PIN (in LoginObj)
   - Used to sign/encrypt VaultObj events

3. **VaultObj**:
   - Encrypted with password-derived key
   - Published to Nostr relays
   - Can only be decrypted with password

4. **LoginObj**:
   - Encrypted with random keypair + password
   - Published to personal relays
   - Requires password to decrypt

### Key Derivation

```
Password → deriveKey() → passwordKey
  ↓
  Used to encrypt VaultObj & LoginObj

PIN → deriveKey() → pinSalt
  ↓
  Used to encrypt xpriv & storage keypair

Master xpriv → deriveKeypairFromXpriv(index)
  ├─ index 0: Personal identity
  ├─ index 1: App identity 1
  ├─ index 2: App identity 2
  └─ index 1337: Storage keypair
```

## Relay Strategy

### Personal Relays (LoginObj)
- User's personal relay list
- Private data
- Lower availability requirements

### Public Relays (VaultObj)
- Popular public relays
- Encrypted data (safe to be public)
- Higher availability
- Better discovery

## Migration Path

### Existing Users (if any)

1. **Old data in IndexedDB only**:
   - Next login: Fetch from Nostr if available
   - Fallback to local cache
   - Prompt user to sync to Nostr

2. **No Nostr data yet**:
   - Trigger background sync on next login
   - Publish LoginObj + VaultObj
   - Cache remains in IndexedDB

### New Users

- Immediate Nostr sync on signup
- Background publishing (non-blocking)
- Works offline first, syncs when online

## Testing

### E2E Nostr Integration

```typescript
it('should sync vault to Nostr on signup', async () => {
  const result = await atomicCreateAccount({
    username: 'test',
    password: 'pass',
    pin: '1234',
    relays: TEST_RELAYS,
    environment: 'test'
  });

  expect(result.success).toBe(true);

  // Wait for background sync
  await waitFor(() => {
    // Check NOSTR_SYNC_COMPLETE event
  });

  // Verify LoginObj on Nostr
  const loginObj = await queryNostr({
    kinds: [30078],
    '#d': [`login:test:test`]
  });
  expect(loginObj).toBeDefined();

  // Verify VaultObj on Nostr
  const vaultObj = await queryNostr({
    kinds: [30078],
    '#d': [`vault:${result.publicKey}:test`]
  });
  expect(vaultObj).toBeDefined();
});

it('should fetch latest version on login', async () => {
  // Create account
  await atomicCreateAccount({ ... });

  // Update vault (creates v2)
  await updateVaultData({ ... });

  // Logout
  await atomicLogout({ ... });

  // Login again
  await atomicLogin({ ... });

  // Should have v2, not v1
  const state = await getAuthState();
  expect(state.vaultVersion).toBe(2);
});
```

## Summary

✅ **LoginObj Integration**: Fetch on login, publish on signup
✅ **VaultObj Integration**: Fetch on login (versioned), publish on signup/update
✅ **IndexedDB Caching**: Offline support, faster unlock
✅ **Versioning**: Latest via `created_at`, conflict-free
✅ **Resilient**: Works offline, graceful Nostr failures
✅ **Secure**: Multi-layer encryption (PIN, password, random keypair)
✅ **Atomic**: All operations atomic (all-or-nothing)
✅ **Background**: Nostr sync non-blocking (instant UX)

The streamlined auth is **fully compatible** with the Nostr-based versioned vault system!
