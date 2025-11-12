# Vault Data Persistence & Security Fix

## Issues Fixed

### 1. Vault Data Persistence Issue
Vault data (specifically new identities) pulled from Nostr was not being updated - only showing original data. This was causing a lack of persistence when users added new identities.

### 2. CRITICAL SECURITY VULNERABILITY 🔒
**Vault data was being stored UNENCRYPTED to public Nostr relays!** This exposed sensitive data including:
- User identities and their public keys
- App permissions and authorization settings
- Recovery data
- Active identity mappings

## Root Cause Analysis

### Data Structure Clarification
First, it's important to understand what "vault data" means:
- **VaultData** = The entire data object (username, publicKey, identities, recovery, permissions, etc.)
- **xprivEncrypted** = Just ONE field within VaultData that contains the encrypted master private key
- **The entire VaultData MUST be encrypted before storing to Nostr** (fixed!)
- Only the `xprivEncrypted` field contains double-encrypted data (PIN + password)

### The Field Name Mismatch
There are **two different field names** used in the system for the same data:

1. **IndexedDB (internal storage)**: uses field name `encryptedVault`
2. **VaultData interface (external API)**: uses field name `xprivEncrypted`

The bug was in `saveVaultToNostr`:
- It called `vaultDB.getVault()` directly, which returns raw IndexedDB format with `encryptedVault`
- Then it tried to save to Nostr using that field name
- But Nostr should use the VaultData interface format with `xprivEncrypted`
- This caused a field name mismatch when data was retrieved from Nostr

## Security Changes Made

### 1. Added NIP-04 Encryption to Nostr Storage (`packages/nostrHelpers/src/vaultHelpers.ts`)
```typescript
// Before (INSECURE - plain JSON!):
const vaultContent = JSON.stringify(vaultData);
const vaultEvent = { 
  content: vaultContent,  // ❌ Sensitive data exposed!
  ...
};

// After (SECURE - NIP-04 encrypted):
const vaultJson = JSON.stringify(vaultData);
const nip04 = await import('nostr-tools/nip04');
const encryptedContent = await nip04.encrypt(userPrivateKey, userPublicKey, vaultJson);

const vaultEvent = {
  content: encryptedContent,  // ✅ Encrypted with NIP-04
  tags: [['encryption', 'nip04']],  // Mark as encrypted
  ...
};
```

### 2. Updated Retrieval to Decrypt First (`packages/nostrHelpers/src/vaultHelpers.ts`)
```typescript
// Try to decrypt with NIP-04 first (newer encrypted vaults)
const nip04 = await import('nostr-tools/nip04');
const decryptedContent = await nip04.decrypt(storagePrivateKey, userPublicKey, event.content);
const vaultData = JSON.parse(decryptedContent);

// Fallback to plain JSON only for legacy vaults (with warning log)
```

### 3. Added Encryption to Worker Handler (`apps/vault/src/workers/crypto.handlers.ts`)
```typescript
// Encrypt payload using NIP-04 before storing
const sharedSecret = secp256k1.getSharedSecret(priv, pub);
const encrypted = await crypto.subtle.encrypt(...);
const encryptedContent = base64.encode(encrypted) + '?iv=' + base64.encode(iv);
```

## Persistence Changes Made

### 4. Added Field Name Mapping in `saveVaultToNostr` (`apps/vault/src/workers/crypto.handlers.ts`)
```typescript
// Before:
const vault = await vaultDB.getVault(params.username);
// vault has `encryptedVault` field (from IndexedDB)
// Then tried to use vault.xprivEncrypted (doesn't exist!)

// After:
const vaultRaw = await vaultDB.getVault(params.username);
// Map from IndexedDB field names to VaultData interface field names
const vault = {
  ...vaultRaw,
  xprivEncrypted: vaultRaw.encryptedVault || vaultRaw.xprivEncrypted
};
```

### 5. Fixed Nostr Payload Field Name
```typescript
// Before:
encryptedVault: vault.xprivEncrypted || vault.encryptedVault,

// After:
xprivEncrypted: vault.xprivEncrypted, // Already mapped from encryptedVault above
```

### 6. Added Comprehensive Logging
Added logging at critical points to track vault data flow:

- **`saveVaultToNostr`**: Logs when preparing vault for Nostr sync (identities count, timestamps)
- **`updateVaultData`**: Logs when saving vault to IndexedDB (identities count, field presence)
- **`getVaultFromNostr`**: Logs when retrieving vault from Nostr (identities count, timestamps)

### 7. Enhanced Logging for Debugging
Added detailed logging to show:
- Field name presence (`hasXprivEncrypted`, `hasEncryptedVaultInDB`)
- Field lengths to verify data is present
- Identity counts at each step

### 8. Benefits of the Logging
The new logging will help diagnose:
- How many identities are in the vault at each step
- Whether field names are present/missing
- Timestamp information for debugging sync issues
- Event creation times from Nostr

## Data Flow (Fixed)

1. **Add Identity**:
   - Dashboard: `updateVaultData()` → adds identity to local IndexedDB
   - Dashboard: `syncToNostr()` → syncs to Nostr relays

2. **Save to IndexedDB** (`updateVaultData` handler):
   - Receives vaultData with `xprivEncrypted` field
   - Maps to both `xprivEncrypted` AND `encryptedVault` for compatibility
   - Saves to IndexedDB with identities array

3. **Save to Nostr** (`saveVaultToNostr` handler):
   - Reads vault from IndexedDB
   - Creates payload with **`xprivEncrypted`** field (FIXED!)
   - Includes `identities` array
   - Signs and publishes to Nostr

4. **Retrieve from Nostr** (`getVaultFromNostr` helper):
   - Queries Nostr for vault events
   - Parses JSON content
   - Returns VaultData with **`xprivEncrypted`** field (matches interface!)
   - Includes `identities` array

5. **Login Sync** (`AuthProvider`):
   - Compares local vs remote vault
   - Prefers version with more identities OR newer timestamp
   - Merges and updates local IndexedDB

## Security Impact

**BEFORE**: Vault data (identities, permissions, recovery) stored as **plain JSON** on public Nostr relays ❌  
**AFTER**: Vault data **NIP-04 encrypted** with storage key before storing to Nostr ✅

### What's Protected Now:
- ✅ Identity list and public keys
- ✅ App permissions and authorization levels
- ✅ Recovery configuration
- ✅ Active identity mappings per app
- ✅ Custom relay preferences
- ✅ Metadata (timestamps, versions)

### What's Still Encrypted Separately:
- The `xprivEncrypted` field is still separately encrypted with PIN/password
- This provides defense-in-depth: even if someone breaks NIP-04, they still need your PIN/password

## Testing Checklist

- [x] Fixed field name mismatch
- [x] Added comprehensive logging
- [x] Added NIP-04 encryption to saveVaultToNostr
- [x] Updated getVaultFromNostr to decrypt properly
- [ ] Test adding new identity
- [ ] Verify identity persists after page reload
- [ ] Verify identity syncs to Nostr (encrypted)
- [ ] Verify identity pulls from Nostr and decrypts properly
- [ ] Check console logs show correct identity counts
- [ ] Verify encrypted content on Nostr relays (should not be readable)

## Related Files
- `apps/vault/src/workers/crypto.handlers.ts` - Worker handlers (fixed)
- `packages/nostrHelpers/src/vaultHelpers.ts` - Nostr helper functions (logging added)
- `apps/vault/src/services/vaultDataService.ts` - Vault data service
- `apps/vault/src/providers/AuthProvider.tsx` - Login and sync logic

## Notes
The codebase maintains both `xprivEncrypted` and `encryptedVault` fields for backward compatibility during the transition period. The `xprivEncrypted` is the canonical field name going forward, matching the VaultData interface definition.

