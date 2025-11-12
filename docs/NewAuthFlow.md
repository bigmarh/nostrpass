# NostrPass Authentication Flow Migration Project

## Project Overview
Migrate NostrPass from current double-encryption auth flow to new privacy-focused auth flow with separate LoginObj and VaultObj storage.

## Current State Analysis
- **Current**: Double encryption (PIN → Password) with local storage during signup
- **Target**: Single encryption with separate LoginObj (random key) and VaultObj (storage key) on Nostr

## Migration Strategy
**No backward compatibility** - clean break to new architecture.

---

## Phase 1: Core Infrastructure Updates

### 1.1 Update Vault Data Structure
**Files to modify:**
- `apps/vault/src/workers/db.ts` - VaultData interface
- `apps/vault/src/types/index.ts` - Type definitions

**Changes:**
- Remove `xprivEncryptedForPin` (old double encryption)
- Add `xprivEncrypted` (PIN-encrypted only)
- Add `xprivRecovery` (recovery-encrypted)
- Update VaultData interface to match new structure

### 1.2 Create New Event Types
**Files to create/modify:**
- `packages/types/src/index.ts` - Add new event types
- `packages/nostrHelpers/src/vaultHelpers.ts` - Update helpers

**New structures:**
```typescript
interface LoginObj {
  storagePublicKey: string;
  username: string;
  createdAt: number;
  version: number;
}

interface VaultObj {
  username: string;
  identities: Identity[];
  xprivEncrypted: string; // PIN-encrypted
  xprivRecovery: string;  // Recovery-encrypted
  recovery: RecoveryData;
  salt: string;
  version: number;
  updatedAt: number;
}
```

---

## Phase 2: Authentication Provider Migration

### 2.1 Update AuthProvider Signup Flow
**File:** `apps/vault/src/providers/AuthProvider.tsx`

**Current flow to replace:**
```typescript
// OLD: Double encryption
const xprivEncryptedWithPin = await cryptoWorker.encryptData({
  data: userMasterKey.xpriv,
  password: pin
});
const xprivEncrypted = await cryptoWorker.encryptData({
  data: xprivEncryptedWithPin,
  key: passwordKey
});
```

**New flow:**
```typescript
// NEW: Single encryption + separate storage
const xprivEncrypted = await cryptoWorker.encryptData({
  data: userMasterKey.xpriv,
  password: pin
});

const vaultObj = {
  username,
  identities: userMasterKey.identities,
  xprivEncrypted,
  xprivRecovery,
  recovery: recoveryData,
  salt: passwordSalt,
  version: 1,
  updatedAt: Date.now()
};

const encryptedVaultObj = await cryptoWorker.encryptData({
  data: JSON.stringify(vaultObj),
  key: passwordKey
});

const loginObj = {
  storagePublicKey,
  username,
  createdAt: Date.now(),
  version: 1
};

const encryptedLoginObj = await cryptoWorker.encryptData({
  data: JSON.stringify(loginObj),
  key: passwordKey
});
```

### 2.2 Update Login Flow
**Replace current login logic:**
- Remove double decryption logic
- Add LoginObj lookup by hashed username
- Add VaultObj lookup by storage public key
- Update PIN unlock to use single encryption

### 2.3 Update PIN Unlock Flow
**Simplify PIN unlock:**
- Remove storage key encryption update logic
- Use single PIN decryption
- Remove backward compatibility checks

---

## Phase 3: Storage Layer Migration

### 3.1 Update Crypto Worker
**File:** `apps/vault/src/workers/crypto.worker.ts`

**Changes:**
- Remove `saveVault` method (replaced by Nostr storage)
- Update `saveVaultToNostr` to handle both LoginObj and VaultObj
- Add `getLoginObj` method for username lookup
- Update `getVaultFromNostr` to use storage key author

### 3.2 Update Vault Data Service
**File:** `apps/vault/src/services/vaultDataService.ts`

**Changes:**
- Remove local storage dependency
- Add LoginObj retrieval logic
- Update vault data loading to use new flow
- Remove backward compatibility methods

### 3.3 Update Nostr Helpers
**File:** `packages/nostrHelpers/src/vaultHelpers.ts`

**New functions needed:**
```typescript
export async function saveLoginObj(
  username: string,
  loginObj: LoginObj,
  randomKey: string,
  relays: string[]
): Promise<void>

export async function getLoginObj(
  username: string,
  environment: string,
  relays: string[]
): Promise<LoginObj | null>

export async function saveVaultObj(
  vaultObj: VaultObj,
  storagePublicKey: string,
  relays: string[]
): Promise<void>
```

---

## Phase 4: Cleanup and Removal

### 4.1 Remove Old Code
**Files to clean:**
- Remove `xprivEncryptedForPin` references
- Remove double encryption logic
- Remove local storage fallbacks
- Remove backward compatibility checks

### 4.2 Update Components
**Files to update:**
- `apps/vault/src/components/Login.tsx` - Update error handling
- `apps/vault/src/components/Dashboard.tsx` - Remove old sync logic
- `apps/vault/src/hooks/useVaultData.ts` - Update data loading

### 4.3 Update Services
**Files to update:**
- `apps/vault/src/services/authService.ts` - Remove old methods
- `apps/vault/src/services/userService.ts` - Update key derivation
- `apps/vault/src/services/vaultService.ts` - Remove old vault methods

---

## Phase 5: Testing and Validation

### 5.1 Test Scenarios
1. **Fresh signup** with new flow
2. **Login** with username + password
3. **PIN unlock** with new single encryption
4. **Recovery** with security questions
5. **Vault updates** using storage key
6. **Multi-device sync** via Nostr

### 5.2 Migration Testing
- **No backward compatibility** - ensure old data is not accessed
- **Clean break** - verify no old encryption methods are used
- **Privacy validation** - confirm LoginObj and VaultObj separation

---

## Implementation Order

1. **Phase 1**: Update data structures and types
2. **Phase 2**: Migrate AuthProvider (core logic)
3. **Phase 3**: Update storage layer
4. **Phase 4**: Clean up old code
5. **Phase 5**: Test and validate

## Success Criteria

- ✅ No backward compatibility code remains
- ✅ LoginObj uses random key for privacy
- ✅ VaultObj uses storage key for ownership
- ✅ Single encryption (PIN only) for xpriv
- ✅ Clean separation between login and vault data
- ✅ All Nostr storage uses new event structure
- ✅ No local storage dependencies for core auth

## Risk Mitigation

- **Data Loss**: Ensure new flow is thoroughly tested before deployment
- **User Impact**: Clear communication about new signup requirement
- **Rollback Plan**: Keep old code in separate branch until validation complete

---

**Ready to begin Phase 1 implementation?**