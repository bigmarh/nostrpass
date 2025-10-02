# Complete Vault Flow: Account Creation → Save → Restoration

This document explains the chronological flow of the NostrPass vault system from account creation through restoration.

## 📋 Overview

The system uses a **two-tier storage model**:
1. **LoginObj** (public) - Username registry mapping username → storagePublicKey
2. **VaultObj** (encrypted) - Actual vault data encrypted with NIP-04

## 🆕 Flow 1: Account Creation (Signup)

### Step 1: Generate Master Key (xpriv)
```typescript
// Location: userService.ts → createUser()
const { xpriv } = await cryptoWorker.generateXpriv();
// Creates BIP32 extended private key
```

**What's created:**
- **xpriv** = Master private key that can derive infinite identities

---

### Step 2: Create Initial "Personal" Identity
```typescript
// Location: userService.ts → createIdentity()
const personalIdentity = await createIdentity(xpriv, 'Personal', 0);
// Derives keypair at path m/44'/1237'/0'/0/0
```

**What's created:**
- **Personal Identity** at index 0
- Contains: nickname, path, publicKey, createdAt

---

### Step 3: Derive Storage Keypair
```typescript
// Location: userService.ts → getStorageKeypair()
const { publicKey: storagePublicKey, privateKey: storagePrivateKey } 
  = await getStorageKeypair(xpriv);
// Derives keypair at special path m/44'/1237'/2147483647'/0/0
```

**What's created:**
- **Storage Identity** at index 2^31-1 (hardened)
- This key is used to encrypt/decrypt vault data on Nostr
- This key signs the VaultObj events

**Why separate storage key?**
- User identities (0, 1, 2...) are for signing Nostr events
- Storage identity is ONLY for vault encryption/decryption
- Keeps vault access separate from identity usage

---

### Step 4: Derive Password Key
```typescript
// Location: AuthProvider.tsx → createAccount()
const { key: passwordKey, salt: passwordSalt } 
  = await cryptoWorker.deriveKey({ password });
// Uses PBKDF2 to derive key from password
```

**What's created:**
- **passwordKey** = Derived from user's password (for verification)
- **passwordSalt** = Random salt for password derivation

---

### Step 5: Encrypt xpriv with PIN
```typescript
// Location: AuthProvider.tsx → createAccount()
const xprivEncrypted = await cryptoWorker.encryptData({
  data: xpriv,
  password: pin
});
// Encrypts xpriv with PIN using AES-256-GCM
```

**What's created:**
- **xprivEncrypted** = Base64 encoded: salt(32) + iv(12) + ciphertext
- This is the ONLY way to recover the master key
- PIN is NOT stored anywhere

**🔐 Security Layer 1:** xpriv is PIN-encrypted

---

### Step 6: Create Password Verifier
```typescript
// Location: AuthProvider.tsx → createAccount()
const passwordVerifier = await cryptoWorker.encryptData({
  data: 'VERIFY_PASSWORD_NOSTRPASS',
  password: passwordKey
});
```

**What's created:**
- **passwordVerifier** = Known plaintext encrypted with password key
- Used to verify password WITHOUT storing it
- Password check: try to decrypt passwordVerifier

---

### Step 7: Build LoginObj (Username Registry Entry)
```typescript
// Location: AuthProvider.tsx → createAccount()
const loginObj: LoginObj = {
  storagePublicKey,
  username,
  createdAt: Date.now(),
  version: 1
};
```

**What's created:**
- Maps username → storagePublicKey
- Stored on Nostr with username as identifier
- NOT encrypted (public mapping)

---

### Step 8: Build VaultObj (Encrypted Vault Data)
```typescript
// Location: AuthProvider.tsx → createAccount()
const vaultObj = {
  username,
  publicKey: storagePublicKey,
  xprivEncrypted,        // PIN-encrypted xpriv
  salt: passwordSalt,     // Salt for password key derivation
  passwordVerifier,       // For password verification
  passwordSalt,           // For password derivation
  identities: [personalIdentity],
  activeIdentityByApp: {},
  recovery: recoveryData, // If recovery questions set
  updatedAt: Date.now(),
  version: 1
};
```

**What's in VaultObj:**
- All identities (starts with Personal)
- Encrypted xpriv
- Password verification data
- App permissions (per identity)
- Recovery configuration
- Metadata

---

### Step 9: Save to Local IndexedDB
```typescript
// Location: AuthProvider.tsx → createAccount()
await cryptoWorker.initSession({
  username,
  publicKey: storagePublicKey,
  vaultData: vaultObj
});
```

**What's stored:**
- Entire VaultObj in IndexedDB (local cache)
- Field name mapped: `xprivEncrypted` → `encryptedVault` (internal DB name)
- Creates session in worker

---

### Step 10: Publish to Nostr

#### 10a: Save LoginObj (Username Registry)
```typescript
// Location: AuthProvider.tsx → createAccount() → vaultHelpers.ts
await saveLoginObj(username, loginObj, randomPublicKey, randomPrivateKey, relays);
```

**Nostr Event:**
```json
{
  "kind": 30078,
  "pubkey": "<random_key>",
  "tags": [
    ["d", "nostrpass.com_loginobj_<username_hash>_development"],
    ["client", "nostrpass.com"],
    ["subject", "login-object"]
  ],
  "content": "{\"storagePublicKey\":\"...\",\"username\":\"...\",\"createdAt\":...,\"version\":1}"
}
```

**Not encrypted** - this is intentional! It's a public username registry.

#### 10b: Save VaultObj (Encrypted Vault)
```typescript
// Location: AuthProvider.tsx → createAccount() → vaultHelpers.ts
await saveVaultObj(vaultObj, storagePublicKey, storagePrivateKey, relays);
```

**Nostr Event:**
```json
{
  "kind": 30078,
  "pubkey": "<storagePublicKey>",
  "tags": [
    ["d", "nostrpass.com_vault_<storagePublicKey>_development"],
    ["client", "nostrpass.com"],
    ["subject", "encrypted-vault"],
    ["encryption", "nip04"]  ← NEW!
  ],
  "content": "<NIP-04_ENCRYPTED_VAULTOBJ>"  ← ENCRYPTED!
}
```

**🔐 Security Layer 2:** Entire VaultObj NIP-04 encrypted with storage key

---

### Step 11: Create Session
```typescript
// Location: AuthProvider.tsx → createAccount()
// Session is already created in step 9 (initSession)
// User is now logged in with vault unlocked
```

---

## 🔓 Flow 2: Login (Existing User - Device with Cache)

### Step 1: Check Local IndexedDB
```typescript
// Location: AuthProvider.tsx → login()
let vaultData = await cryptoWorker.getVaultData({ username });
```

**If found locally:**
- Skip Nostr fetch
- Use cached vault data
- Proceed to step 3

**If not found locally:**
- Continue to step 2

---

### Step 2: Fetch from Nostr (Cold Start)
```typescript
// Location: AuthProvider.tsx → login()
const { getLoginObj, getVaultFromNostr } = await import('@nostrpass/nostrHelpers');

// 2a: Get LoginObj (username → storagePublicKey)
const loginObj = await getLoginObj(username, environment, relays);
// Returns: { storagePublicKey, username, createdAt, version }

// 2b: Get VaultObj (encrypted vault data)
const vaultData = await getVaultFromNostr(loginObj.storagePublicKey, relays, storagePrivateKey);
// DECRYPTS with NIP-04 using storage key
// Returns: { username, xprivEncrypted, identities, ... }
```

**Nostr queries:**
1. Query `kind: 30078` where `d` tag = `nostrpass.com_loginobj_<hash(username)>_<env>`
2. Parse LoginObj to get `storagePublicKey`
3. Query `kind: 30078` where `d` tag = `nostrpass.com_vault_<storagePublicKey>_<env>`
4. Decrypt VaultObj with NIP-04 (self-encryption with storage key)

---

### Step 3: Save to Local IndexedDB (if fetched from Nostr)
```typescript
// Location: AuthProvider.tsx → login()
await cryptoWorker.saveVault({
  username,
  publicKey: loginObj.storagePublicKey,
  xprivEncrypted: vaultData.xprivEncrypted,
  salt: vaultData.salt,
  identities: vaultData.identities,
  passwordVerifier: vaultData.passwordVerifier,
  passwordSalt: vaultData.passwordSalt,
  recovery: vaultData.recovery,
  // ... other fields
});
```

**Cached for next login on this device.**

---

### Step 4: Initialize Locked Session
```typescript
// Location: AuthProvider.tsx → login()
await cryptoWorker.initSession({
  username,
  publicKey: storagePublicKey,
  vaultData
});
```

**Session state:**
- Vault data saved
- Session is LOCKED (no xpriv in memory)
- User must enter PIN to unlock

---

### Step 5: User Enters PIN
```typescript
// Location: PinUnlock.tsx
await unlockVault(pin);
```

---

### Step 6: Decrypt xpriv with PIN
```typescript
// Location: AuthProvider.tsx → unlockVault()
const xpriv = await cryptoWorker.decryptData({
  data: vaultData.xprivEncrypted,
  password: pin
});
// Decrypts AES-256-GCM ciphertext with PIN
```

**If PIN correct:**
- xpriv decrypted successfully
- Continue to step 7

**If PIN wrong:**
- Decryption fails
- Show error
- Allow retry

---

### Step 7: Create Unlocked Session
```typescript
// Location: AuthProvider.tsx → unlockVault()
await cryptoWorker.unlockSession({
  username,
  xpriv,
  identityIndex: 0
});
```

**Session state:**
- xpriv in worker memory (secure)
- Can derive identity keys on demand
- Can sign events
- Session is UNLOCKED

---

### Step 8: Background Sync Check
```typescript
// Location: AuthProvider.tsx → login()
// Background async task (doesn't block login)
const remote = await getVaultFromNostr(loginObj.storagePublicKey, relays);

// Compare local vs remote
if (remote.identities.length > local.identities.length 
    || remote.updatedAt > local.updatedAt) {
  // Remote is newer or has more data
  await cryptoWorker.updateVaultData({ username, vaultData: remote });
  // Sync local with remote
}
```

**Purpose:**
- Keep local cache in sync with Nostr
- Handles multi-device scenarios
- Non-blocking (doesn't slow down login)

---

## 🔄 Flow 3: Adding New Identity

### Step 1: User Clicks "Add Identity"
```typescript
// Location: Dashboard.tsx
const nextIndex = vaultData().identities.length;
```

---

### Step 2: Derive New Identity from xpriv
```typescript
// Location: Dashboard.tsx → cryptoWorker.deriveKeypairFromXpriv()
const derived = await cryptoWorker.deriveKeypairFromXpriv({
  xpriv,
  index: nextIndex
});
// Returns: { path, publicKey, privateKey }
```

**New identity created:**
- Derived at path `m/44'/1237'/<nextIndex>'/0/0`
- Has unique keypair
- Can sign events independently

---

### Step 3: Add to Vault Data
```typescript
// Location: Dashboard.tsx
const identity = {
  nickname: newIdentityNickname,
  path: derived.path,
  publicKey: derived.publicKey,
  index: nextIndex,
  createdAt: Date.now()
};

await updateVaultData(
  (curr) => ({ identities: [...curr.identities, identity] }),
  { syncToNostr: false }  // Save locally first
);
```

**Updates:**
- Local IndexedDB updated immediately
- identities array now has new identity
- UI updates instantly

---

### Step 4: Sync to Nostr (Background)
```typescript
// Location: Dashboard.tsx
await syncToNostr();
// Calls: vaultDataService.syncToNostr(username)
// Which calls: cryptoWorker.saveVaultToNostr({ username })
```

**What happens:**
1. Read current vault from IndexedDB (now has new identity)
2. Map field names (`encryptedVault` → `xprivEncrypted`)
3. Serialize to JSON
4. **Encrypt with NIP-04** using storage key
5. Sign event with storage private key
6. Publish to Nostr relays

**Nostr event replaces old vault:**
- kind 30078 is "replaceable" (NIP-33)
- Same `d` tag = replaces previous vault
- New identity now on Nostr!

---

## 🔁 Flow 4: Restoration (Lost Device / New Device)

### Step 1: User Has Recovery Key
Recovery key = storage private key (64 hex characters)

---

### Step 2: Enter Recovery Key
```typescript
// Location: VaultRecovery.tsx
const privateKeyHex = recoveryKey().trim();
const publicKey = getPublicKey(hexToBytes(privateKeyHex));
```

---

### Step 3: Fetch Vault from Nostr
```typescript
// Location: VaultRecovery.tsx
const vaultData = await getVaultFromNostr(
  publicKey,         // Storage public key
  relays,
  privateKeyHex      // Storage private key for decryption
);
// DECRYPTS VaultObj with NIP-04
```

**No username needed!** 
- Recovery key IS the storage private key
- Can derive storage public key from it
- Can decrypt VaultObj directly

---

### Step 4: Save to Local IndexedDB
```typescript
// Location: VaultRecovery.tsx
await cryptoWorker.createSession({
  username: vaultData.username,
  publicKey,
  privateKey: privateKeyHex,
  vaultData,
  sessionTimeout: 60
});
```

**Vault restored:**
- All identities recovered
- All permissions recovered  
- All recovery settings recovered
- Can now login with PIN

---

### Step 5: Login Normally
User proceeds to login with PIN (same as Flow 2, steps 4-7)

---

## 🔐 Security Layers Summary

### Layer 1: PIN Encryption
- **xpriv** encrypted with PIN (AES-256-GCM)
- Stored in `xprivEncrypted` field
- **Even if VaultObj is decrypted, still need PIN to get xpriv**

### Layer 2: NIP-04 Vault Encryption  
- **Entire VaultObj** encrypted with NIP-04
- Uses storage keypair (self-encryption)
- **Nostr relays only see encrypted blob**

### Layer 3: Nostr Event Signature
- VaultObj event signed with storage private key
- **Proves authenticity** (only storage key owner can update)

### Defense in Depth
```
┌─────────────────────────────────────────┐
│  Nostr Relay (Public)                   │
│  ┌───────────────────────────────────┐  │
│  │ Encrypted Blob (NIP-04)           │  │ ← Layer 2: NIP-04 Encryption
│  │ ┌─────────────────────────────┐   │  │
│  │ │ VaultObj (JSON)             │   │  │ ← Layer 1 contains...
│  │ │ {                           │   │  │
│  │ │   xprivEncrypted: "..."  ← │─┼──┼──┼── Layer 1: PIN Encryption
│  │ │   identities: [...],        │   │  │
│  │ │   recovery: {...}           │   │  │
│  │ │ }                           │   │  │
│  │ └─────────────────────────────┘   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**To steal funds, attacker needs:**
1. Break NIP-04 encryption (get VaultObj)
2. Break AES-256-GCM (get xpriv)  
3. Or steal storage private key + PIN

---

## ❓ Potential Issues / Questions

### Issue 1: LoginObj Not Encrypted
- **Current:** LoginObj stored as plain JSON
- **Risk:** Username → storagePublicKey mapping is public
- **Impact:** Anyone can see which usernames exist
- **Fix?:** Could encrypt LoginObj too, but then how to find it?

### Issue 2: Storage Key Handling
- **Current:** Storage private key derived from xpriv
- **Recovery:** Storage key IS the recovery key
- **Question:** Should storage key be separate from xpriv derivation?
- **Pro:** If xpriv compromised, storage key still safe
- **Con:** More complexity, another thing to backup

### Issue 3: Field Name Mapping
- **Current:** `xprivEncrypted` (interface) ↔ `encryptedVault` (DB)
- **Why:** Historical/legacy reasons
- **Impact:** Causes confusion, requires mapping everywhere
- **Fix:** Standardize on one name throughout

### Issue 4: Multiple Encryption Implementations
- **Current:** NIP-04 done in both vaultHelpers.ts AND crypto.handlers.ts
- **Why:** Worker can't access nostr-tools/nip04 easily
- **Impact:** Code duplication, potential drift
- **Fix:** Use single crypto implementation (noble-secp256k1)

---

## ✅ Flow Validation

### Does the flow make sense chronologically?

**Account Creation:** ✅ YES
1. Generate xpriv
2. Create identity
3. Encrypt xpriv with PIN
4. Build VaultObj
5. Encrypt VaultObj with NIP-04
6. Save to Nostr

**Login:** ✅ YES  
1. Check local cache
2. If missing, fetch from Nostr
3. Decrypt VaultObj with storage key
4. Save locally
5. Enter PIN
6. Decrypt xpriv
7. Create unlocked session

**Adding Identity:** ✅ YES
1. Derive new identity from xpriv
2. Add to local vault
3. Sync encrypted vault to Nostr

**Restoration:** ✅ YES
1. Enter recovery key (storage private key)
2. Fetch encrypted VaultObj from Nostr
3. Decrypt with recovery key
4. Save locally
5. Login with PIN

### Overall Assessment

**✅ Flow is logically sound**
**✅ Security layers are appropriate**
**⚠️ Some implementation details need cleanup (field naming, duplication)**
**⚠️ LoginObj being unencrypted may be a privacy concern**

---

## 📝 Recommendations

1. **Standardize field names:** Use `xprivEncrypted` everywhere
2. **Consolidate encryption:** Single NIP-04 implementation
3. **Consider LoginObj encryption:** Protect username privacy
4. **Document recovery clearly:** Users need to save storage key
5. **Add vault versioning:** Handle schema migrations gracefully

