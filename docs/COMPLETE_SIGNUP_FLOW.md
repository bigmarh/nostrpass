# Complete Signup Flow - Step by Step

This document provides an exhaustive walkthrough of the entire signup flow with exact data transformations, encryption steps, and storage locations.

## User Input

```
Username: alice
Password: mySecretPassword123
PIN: 1234
Recovery: ["Favorite pet?", "Birth city?"], ["Fluffy", "Seattle"]
Relays: ["wss://relay.damus.io", "wss://nos.lol"]
Environment: production
```

---

## Worker Processing (`signup-handler-atomic.ts`)

### STEP 1: Generate Random Seed

```typescript
const seed = cryptoPrimitives.generateRandomBytes({ length: 32 });
```

**Output:**
```
seed = "a1b2c3d4e5f6789012345678abcdef01234567890abcdef1234567890abcdef"
       ↑ 32 bytes (256 bits) of cryptographically random data
```

---

### STEP 2: Derive Master Extended Private Key (xpriv)

```typescript
const xpriv = await cryptoPrimitives.deriveXprivFromSeed({ seed });
```

**Input:** `seed` (32 bytes)

**Process:** BIP32 hierarchical deterministic key derivation

**Output:**
```
xpriv = "xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi"
```

**What is xpriv?**
- Master key that can derive unlimited child keypairs
- Format: BIP32 extended key (base58 encoded)
- Can derive keys at any index: 0, 1, 2, ... 1337, ... 2^31-1
- Child key derivation path: `m/index`

---

### STEP 3: Derive Personal Identity Keypair (Index 0)

```typescript
const personalKeypair = await cryptoPrimitives.deriveKeypairFromXpriv({
  xpriv,
  index: 0
});
```

**Input:** xpriv + index 0

**Process:** BIP32 child key derivation at path `m/0`

**Output:**
```
personalKeypair = {
  privateKey: "5a3e8f9c2b4d6e1a7c9f0b2d4e6a8c0f1b3d5e7a9c0b2d4f6a8c0e2b4d6f8a0c",
  publicKey:  "02b4c1a3f5e7d9c1a3f5e7d9c1a3f5e7d9c1a3f5e7d9c1a3f5e7d9c1a3f5e7d9c1"
}
```

**Create Identity:**
```typescript
identities = [{
  index: 0,
  nickname: "Personal",
  publicKey: "02b4c1a3f5e7d9c1a3f5e7d9c1a3f5e7d9c1a3f5e7d9c1a3f5e7d9c1a3f5e7d9c1",
  npub: "npub1k3xc8g0hmrfux50a7nvu90640nwp8t4mu8xvk5a8ht0rjs74lkwq5k3t7u",
  createdAt: 1701234567890,
  appPermissions: {}
}];
```

---

### STEP 4: Derive Storage Keypair (Index 1337)

```typescript
const STORAGE_INDEX = 1337;
const storageKeypair = await cryptoPrimitives.deriveKeypairFromXpriv({
  xpriv,
  index: STORAGE_INDEX
});
```

**Input:** xpriv + index 1337

**Process:** BIP32 child key derivation at path `m/1337`

**Output:**
```
storageKeypair = {
  privateKey: "7f9a2b8d4c6e1a3f5b7d9c0e2a4f6b8d0c2e4a6f8b0d2c4e6a8f0c2e4b6d8a0f",
  publicKey:  "03e5d8c2b4f6a8d0c2e4f6a8d0c2e4f6a8d0c2e4f6a8d0c2e4f6a8d0c2e4f6a8"
}

storagePublicKey = "03e5d8c2b4f6a8d0c2e4f6a8d0c2e4f6a8d0c2e4f6a8d0c2e4f6a8d0c2e4f6a8"
storagePrivateKey = "7f9a2b8d4c6e1a3f5b7d9c0e2a4f6b8d0c2e4a6f8b0d2c4e6a8f0c2e4b6d8a0f"
```

**Why index 1337?**
- Convention for storage keypair (separate from identity keypairs)
- Used to sign/encrypt VaultObj events on Nostr
- Used to decrypt VaultObj when fetching from Nostr

---

### STEP 5: Derive Password Key + Salt

```typescript
const passwordDeriveResult = await cryptoPrimitives.deriveKey({
  password: "mySecretPassword123"
});
```

**Input:** password

**Process:** PBKDF2 with random salt
```
PBKDF2(
  password: "mySecretPassword123",
  salt: <random 16 bytes>,
  iterations: 100000,
  hashAlgorithm: SHA-256
) → key (32 bytes)
```

**Output:**
```
passwordKey = "e3f8a9b1c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9"
passwordSalt = "d4c7b2a8e6f9d1c3b5a7e9f1d3c5b7a9"
```

**Usage:**
- `passwordKey` → Encrypt LoginObj for Nostr
- `passwordSalt` → Stored in LoginObj tags (plaintext) for password derivation on login

---

### STEP 6: Derive PIN Salt

```typescript
const pinDeriveResult = await cryptoPrimitives.deriveKey({
  password: "1234"
});
```

**Input:** PIN (treated as password)

**Process:** PBKDF2 with random salt

**Output:**
```
pinSalt = "a8e9d3c5b7f1a3e5d7c9f1b3e5a7d9c1"
```

**Usage:**
- `pinSalt` → Used with PIN to encrypt xpriv and storage keypair
- Ensures same PIN + salt always produces same encryption key
- Stored in VaultObj and LoginObj

---

### STEP 7: Encrypt xpriv with PIN

```typescript
const xprivEncrypted = await cryptoPrimitives.encryptDataWithSalt({
  data: "xprv9s21ZrQH143K...",
  password: "1234",
  salt: "a8e9d3c5b7f1a3e5d7c9f1b3e5a7d9c1"
});
```

**Input:**
- data: xpriv (plaintext)
- password: PIN
- salt: pinSalt

**Process:**
1. Derive encryption key: `PBKDF2("1234", pinSalt, 100000) → encKey`
2. Encrypt: `AES-256-GCM(encKey, xpriv, <random IV>) → ciphertext + authTag`
3. Encode: `base64(ciphertext + authTag)`

**Output:**
```
xprivEncrypted = "U2FsdGVkX1+8v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/..."
```

**Decryption (later, on unlock):**
```typescript
xpriv = decrypt(xprivEncrypted, PIN="1234", salt="a8e9d3c5...")
```

---

### STEP 8: Encrypt Storage Keypair with PIN

```typescript
const storageKeypairJson = JSON.stringify({
  privateKey: "7f9a2b8d4c6e1a3f...",
  publicKey: "03e5d8c2b4f6a8d0..."
});

const storageKeypairEncrypted = await cryptoPrimitives.encryptDataWithSalt({
  data: storageKeypairJson,
  password: "1234",
  salt: "a8e9d3c5b7f1a3e5d7c9f1b3e5a7d9c1"
});
```

**Input:**
- data: JSON-stringified storage keypair
- password: PIN
- salt: pinSalt (same as xpriv)

**Process:** Same AES-256-GCM encryption

**Output:**
```
storageKeypairEncrypted = "U2FsdGVkX1+9w8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PD..."
```

**Why encrypt storage keypair separately?**
- Stored in LoginObj (fetched during login with password)
- Allows unlocking with just PIN (decrypt storage keys → fetch VaultObj)
- No need for password after login

---

### STEP 9: Create Recovery Encryption (Optional)

```typescript
const concatenated = ["Fluffy", "Seattle"]
  .map(a => a.toLowerCase().trim())
  .join('|');
// concatenated = "fluffy|seattle"

const recoveryKeyResult = await cryptoPrimitives.deriveKey({
  password: "fluffy|seattle"
});

const xprivRecovery = await cryptoPrimitives.encryptData({
  data: "xprv9s21ZrQH143K...",
  password: recoveryKeyResult.key
});
```

**Output:**
```
recoveryData = {
  questions: ["Favorite pet?", "Birth city?"],
  xprivRecovery: "U2FsdGVkX1+5tbW1tbW1tbW1tbW1tbW1tbW1tbW1...",
  salt: "b9d4e2a6f8c0d2e4a6f8c0b2d4e6a8c0",
  version: 1
}
```

**Recovery process (later):**
```typescript
// User enters: ["fluffy", "seattle"]
const recoveryKey = deriveKey("fluffy|seattle");
const xpriv = decrypt(xprivRecovery, recoveryKey);
// User recovers xpriv without PIN!
```

---

### STEP 10: Assemble VaultObj (for Nostr)

```typescript
const vaultObj: VaultObj = {
  username: "alice",
  identities: [{
    index: 0,
    nickname: "Personal",
    publicKey: "02b4c1a3f5e7d9c1...",
    npub: "npub1k3xc8g0hmrfux...",
    createdAt: 1701234567890,
    appPermissions: {}
  }],
  xprivEncrypted: "U2FsdGVkX1+8v7+/...",
  xprivRecovery: "U2FsdGVkX1+5tbW1...",
  recovery: {
    questions: ["Favorite pet?", "Birth city?"],
    salt: "b9d4e2a6f8c0d2e4a6f8c0b2d4e6a8c0",
    version: 1
  },
  salt: "a8e9d3c5b7f1a3e5d7c9f1b3e5a7d9c1",  // pinSalt
  version: 1,
  updatedAt: 1701234567890
};
```

---

### STEP 11: Assemble LoginObj (for Nostr)

```typescript
const loginObj: LoginObj = {
  storagePublicKey: "03e5d8c2b4f6a8d0...",
  storageKeypairEncrypted: "U2FsdGVkX1+9w8PDw8PD...",
  username: "alice",
  passwordSalt: "d4c7b2a8e6f9d1c3b5a7e9f1d3c5b7a9",
  pinSalt: "a8e9d3c5b7f1a3e5d7c9f1b3e5a7d9c1",
  version: 1,
  createdAt: 1701234567890
};
```

---

### STEP 12: Assemble VaultData (for IndexedDB)

```typescript
const vaultData: VaultData = {
  xprivEncrypted: "U2FsdGVkX1+8v7+/...",
  salt: "a8e9d3c5b7f1a3e5d7c9f1b3e5a7d9c1",
  passwordSalt: "d4c7b2a8e6f9d1c3b5a7e9f1d3c5b7a9",
  publicKey: "03e5d8c2b4f6a8d0...",
  storagePublicKey: "03e5d8c2b4f6a8d0...",
  username: "alice",
  identities: [/* same as vaultObj */],
  recovery: {/* same as vaultObj */},
  version: 1,
  updatedAt: 1701234567890
};
```

---

### STEP 13: Save to IndexedDB (Local First)

```typescript
await vaultDB.saveVault("alice", vaultData);
```

**IndexedDB Structure:**
```
Database: nostrpass-vault
ObjectStore: vaults
Key: "alice"
Value: vaultData object
```

**Result:** ✅ Vault cached locally (works offline)

---

### STEP 14: Create Unlocked Session (In-Memory)

```typescript
const session: CompleteSessionState = {
  isAuthenticated: true,
  isUnlocked: true,  // Already unlocked!
  username: "alice",
  publicKey: "02b4c1a3f5e7d9c1...",
  storagePublicKey: "03e5d8c2b4f6a8d0...",
  vaultVersion: 1,
  identityCount: 1,
  sessionId: "session_1701234567890_abc123",
  createdAt: 1701234567890,
  unlockedAt: 1701234567890,
  expiresAt: 1701236367890,  // +30 minutes

  // Sensitive data (in-memory only)
  xpriv: "xprv9s21ZrQH143K...",
  privateKey: "5a3e8f9c2b4d6e1a...",
  storagePrivateKey: "7f9a2b8d4c6e1a3f...",

  vaultData: { /* full vaultData */ }
};

sessionStateManager.sessions.set("alice", session);
```

**Result:** ✅ User immediately logged in AND unlocked

---

### STEP 15: Publish LoginObj to Nostr (Background)

```typescript
// Generate random keypair for LoginObj privacy
const randomKeypair = await cryptoPrimitives.generateKeypair();
// randomPrivateKey = "8c1d2e3f5a7b9c0d..."
// randomPublicKey = "04a7f3b1d5c9e7a3..."

await saveLoginObj(
  "alice",
  loginObj,
  "04a7f3b1d5c9e7a3...",  // randomPublicKey
  "8c1d2e3f5a7b9c0d...",  // randomPrivateKey
  ["wss://relay.damus.io", "wss://nos.lol"],
  "production",
  "e3f8a9b1c5d7e9f1..."   // passwordKey
);
```

**Process:**
1. Serialize LoginObj to JSON
2. Encrypt with passwordKey (NIP-04):
   ```typescript
   encrypt(passwordKey, randomPublicKey, JSON.stringify(loginObj))
   ```
3. Create Nostr event:
   ```json
   {
     "kind": 30078,
     "pubkey": "04a7f3b1d5c9e7a3...",
     "created_at": 1701234567,
     "tags": [
       ["d", "nostrpass_login_<hash(alice)>_production"],
       ["password-salt", "d4c7b2a8e6f9d1c3b5a7e9f1d3c5b7a9"]
     ],
     "content": "<encrypted loginObj>"
   }
   ```
4. Sign with randomPrivateKey
5. Publish to relays

**Result:** ✅ LoginObj on Nostr (encrypted, d-tag: `login:<hash(alice)>:production`)

---

### STEP 16: Publish VaultObj to Nostr (Background)

```typescript
await saveVaultObj(
  vaultObj,
  "03e5d8c2b4f6a8d0...",  // storagePublicKey
  "7f9a2b8d4c6e1a3f...",  // storagePrivateKey
  ["wss://relay.damus.io", "wss://nos.lol"]
);
```

**Process:**
1. Serialize VaultObj to JSON
2. Encrypt with STORAGE KEY (NIP-04):
   ```typescript
   encrypt(storagePrivateKey, storagePublicKey, JSON.stringify(vaultObj))
   ```
3. Create Nostr event:
   ```json
   {
     "kind": 30078,
     "pubkey": "03e5d8c2b4f6a8d0...",
     "created_at": 1701234567,
     "tags": [
       ["d", "nostrpass_vault_03e5d8c2b4f6a8d0..._production"],
       ["encryption", "nip04-storage"]
     ],
     "content": "<encrypted vaultObj>"
   }
   ```
4. Sign with storagePrivateKey
5. Publish to relays

**Result:** ✅ VaultObj on Nostr (encrypted with storage key, replaceable/versioned)

---

## Complete Login Flow

```typescript
// Step 1: User enters password
await atomicLogin({
  username: "alice",
  password: "mySecretPassword123",
  relays: ["wss://relay.damus.io"],
  environment: "production"
});

// Worker:
// 1. Fetch LoginObj from Nostr (query by username hash)
// 2. Extract passwordSalt from event tags
// 3. Derive passwordKey from password + passwordSalt
// 4. Decrypt LoginObj with passwordKey
// 5. Store loginObj + relays in session
// 6. Create locked session (no keys yet)

// Result: Authenticated but LOCKED (needs PIN to unlock)
```

---

## Complete Unlock Flow

```typescript
// Step 1: User enters PIN
await atomicUnlock({
  username: "alice",
  pin: "1234"
});

// Worker:
// 1. Get loginObj from session
// 2. Decrypt storageKeypairEncrypted with PIN + pinSalt
// 3. Parse storage keypair JSON → storagePrivateKey, storagePublicKey
// 4. Fetch VaultObj from Nostr using storagePrivateKey
// 5. Cache VaultObj to IndexedDB
// 6. Decrypt xprivEncrypted with PIN + pinSalt
// 7. Derive personal keypair (index 0)
// 8. Derive storage keypair (index 1337) and VERIFY it matches LoginObj
// 9. Update session with all keys

// Result: Authenticated AND UNLOCKED (all keys in memory)
```

---

## Update Vault Flow (Realtime)

```typescript
// User adds new identity or changes permissions
const updatedVaultObj = {
  ...vaultObj,
  identities: [...identities, newIdentity],
  version: vaultObj.version + 1,
  updatedAt: Date.now()
};

// Encrypt with STORAGE KEY (already in memory!)
await saveVaultObj(
  updatedVaultObj,
  storagePublicKey,    // In memory
  storagePrivateKey,   // In memory
  relays
);

// NO PASSWORD NEEDED! 🎉
// Storage keys are already in memory after unlock
```

---

## Encryption Summary

| Data | Encrypted With | Decrypts To | Stored In |
|------|---------------|-------------|-----------|
| **xpriv** | PIN + pinSalt | Master key | VaultObj (Nostr), VaultData (IndexedDB) |
| **xpriv (recovery)** | Recovery answers + recoverySalt | Master key | VaultObj (Nostr) |
| **Storage keypair** | PIN + pinSalt | Storage keys | LoginObj (Nostr) |
| **LoginObj** | passwordKey (NIP-04) | LoginObj plaintext | Nostr event content |
| **VaultObj** | **storagePrivateKey (NIP-04)** | VaultObj plaintext | Nostr event content |

---

## Key Insights

### 1. Layered Encryption
```
LoginObj: password → decrypt → PIN-encrypted storage keys
VaultObj: storage key → decrypt → PIN-encrypted xpriv
```

### 2. Password Only Needed Once
```
Login: password → LoginObj → storage keys (encrypted)
Unlock: PIN → storage keys (decrypted) + xpriv
Update: storage keys (in memory) → VaultObj
```

### 3. Checks and Balances
```
PIN → xpriv → derive storage keys → verify match with LoginObj
✅ Ensures PIN is correct
✅ Ensures xpriv is valid
✅ Ensures data integrity
```

### 4. Realtime Updates
```
Update vault → encrypt with storage keys (in memory) → publish
No password prompt! Fast, seamless updates.
```

### 5. Versioning
```
Each VaultObj has created_at timestamp
Query Nostr → get all events → sort by created_at DESC → use newest
Newest wins, conflict-free
```

---

## Summary

✅ **xpriv** is master key (derives all keypairs)
✅ **Storage keypair** (index 1337) encrypts/signs VaultObj
✅ **Personal keypair** (index 0) is default identity
✅ **PIN** encrypts xpriv + storage keypair
✅ **Password** encrypts LoginObj only (one-time use)
✅ **LoginObj** contains storage keys (PIN-encrypted)
✅ **VaultObj** contains xpriv (PIN-encrypted)
✅ **Updates** use storage keys (no password!)
✅ **Checks and balances** verify PIN correctness

This architecture enables:
- Password-free vault updates
- Offline unlock (IndexedDB cache)
- Cross-device sync (Nostr)
- Conflict-free versioning
- Strong encryption (layered)
- Recovery without PIN (security questions)
