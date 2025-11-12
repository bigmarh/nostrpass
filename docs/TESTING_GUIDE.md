# Testing Guide for Vault Persistence & Security Fixes

## 🔧 Step 1: Rebuild Everything

```bash
# From project root
cd /Users/marh/apps/nostrpass.com

# Rebuild packages first
cd packages/nostrHelpers
npm run build

# Rebuild vault app
cd ../../apps/vault
npm run build

# Or if using pnpm at root:
cd /Users/marh/apps/nostrpass.com
pnpm build
```

---

## 🧹 Step 2: Clear Old Data (IMPORTANT!)

Old vaults were stored **unencrypted** - you need to clear them to test properly.

### Option A: Clear via Browser DevTools
1. Open browser DevTools (F12)
2. Go to **Application** tab
3. Under **Storage**:
   - **Clear IndexedDB**: `NostrPassVault`
   - **Clear Local Storage**: All `nostrpass.com` keys
   - **Clear Session Storage**: All items
4. **Hard reload**: Ctrl+Shift+R (or Cmd+Shift+R on Mac)

### Option B: Use the Clear Data Script
```bash
# Run the clear data script
cd /Users/marh/apps/nostrpass.com
node CLEAR_DATA_SCRIPT.js
```

### Option C: Manual IndexedDB Clear (via DevTools Console)
```javascript
// Paste in browser console on vault app
indexedDB.deleteDatabase('NostrPassVault');
localStorage.clear();
sessionStorage.clear();
console.log('✅ All data cleared - reload page');
```

---

## 🆕 Step 3: Test Account Creation

### 3a. Start Development Server
```bash
cd apps/vault
npm run dev
# Or from root: pnpm --filter vault dev
```

### 3b. Create New Account
1. Navigate to vault app in browser
2. Click **Sign Up**
3. Enter:
   - Username: `testuser`
   - Password: `TestPassword123!`
   - PIN: `1234`
4. Click **Create Account**

### 3c. Expected Console Logs
Look for these logs in browser console:

```
🔑 [CREATE ACCOUNT] Step 1: Generating master key (xpriv)...
✅ [CREATE ACCOUNT] Master key generated
👤 [CREATE ACCOUNT] Personal identity: {...}
🔑 [CREATE ACCOUNT] Step 2: Deriving storage and personal keypairs...
✅ [CREATE ACCOUNT] Storage public key: <hex>
🔐 [CREATE] Encrypting xpriv with PIN...
💾 Saving vault to IndexedDB
🔐 [saveVaultToNostr] Payload encrypted with NIP-04  ← NEW!
✅ [saveVaultToNostr] Payload created: {identitiesCount: 1, ...}
🌐 [CREATE ACCOUNT] Step 11: Saving LoginObj and VaultObj to Nostr...
✅ [CREATE ACCOUNT] LoginObj saved to Nostr
✅ [CREATE ACCOUNT] VaultObj saved to Nostr
```

### 3d. Verify Success
- ✅ Account created without errors
- ✅ Redirected to dashboard
- ✅ Can see "Personal" identity

---

## ➕ Step 4: Test Adding Identity

### 4a. Add New Identity
1. In dashboard, click **"Add Identity"** button (or similar)
2. Enter nickname: `Work`
3. Click **"Add Identity"**

### 4b. Expected Console Logs
```
🔑 Deriving identity keypair at index 1...
💾 [updateVaultData] Saving vault with: {identitiesCount: 2, ...}
✅ [Add Identity] Saved locally
📡 [Add Identity] Syncing to Nostr in background...
📤 [saveVaultToNostr] Preparing vault for Nostr sync: {identitiesCount: 2, ...}
🔐 [saveVaultToNostr] Payload encrypted with NIP-04  ← VERIFY THIS!
✅ [saveVaultToNostr] Payload created: {identitiesCount: 2, ...}
✅ [Add Identity] Synced to Nostr
```

### 4c. Verify Identity Added
- ✅ "Work" identity appears in dashboard
- ✅ Identity count shows 2
- ✅ No errors in console

---

## 🔄 Step 5: Test Persistence (CRITICAL!)

### 5a. Hard Reload Page
1. Press **Ctrl+Shift+R** (or Cmd+Shift+R on Mac)
2. Or close and reopen browser
3. Navigate back to vault

### 5b. Login Again
1. Enter username: `testuser`
2. Enter PIN: `1234`

### 5c. Expected Console Logs
```
📡 Fetching account from Nostr relays...
✅ Found LoginObj on Nostr
✅ [getVaultFromNostr] Retrieved encrypted vault from Nostr: {
  identitiesCount: 2,  ← SHOULD BE 2, NOT 1!
  wasEncrypted: true,  ← VERIFY ENCRYPTED!
  ...
}
💾 Saving vault to local IndexedDB...
✅ Vault saved to local IndexedDB
```

### 5d. CRITICAL CHECK ✅
**Dashboard should show BOTH identities:**
- ✅ Personal
- ✅ Work

**If only "Personal" shows, the bug is NOT fixed!**

---

## 🔐 Step 6: Verify Encryption on Nostr

### 6a. Query Nostr Relay Directly

You can use a Nostr client or tool to verify the vault is encrypted:

#### Option 1: Use Browser Console
```javascript
// In browser console
const { SimplePool } = await import('https://esm.sh/nostr-tools');
const pool = new SimplePool();

const storagePublicKey = '<YOUR_STORAGE_PUBLIC_KEY>'; // From console logs
const relays = ['wss://relay.damus.io', 'wss://nos.lol'];

const events = await pool.querySync(relays, {
  kinds: [30078],
  authors: [storagePublicKey],
  '#d': [`nostrpass.com_vault_${storagePublicKey}_development`]
});

console.log('Vault events:', events);
console.log('Content (should be encrypted):', events[0]?.content);

// Content should look like base64 gibberish, NOT JSON!
// Good: "U2FsdGVkX1+..." or similar encrypted blob
// Bad:  "{"username":"testuser",...}" (readable JSON)
```

#### Option 2: Check with nos.today
1. Go to https://nos.today
2. Search for your storage public key
3. Find the vault event (kind 30078)
4. Check content field - should be encrypted base64, not readable JSON

### 6b. Expected Result
**Good (Encrypted):** ✅
```
content: "encrypted_gibberish_here_1234567890abcdef..."
```

**Bad (NOT Encrypted):** ❌
```
content: "{"username":"testuser","identities":[...]}"
```

---

## 🔄 Step 7: Test Multi-Device Sync

### 7a. Simulate New Device
1. Open **Incognito/Private window**
2. Navigate to vault app
3. Click **Login**
4. Enter username: `testuser`
5. Enter PIN: `1234`

### 7b. Expected Console Logs
```
📡 Fetching account from Nostr relays...
✅ Found LoginObj on Nostr
✅ [getVaultFromNostr] Retrieved encrypted vault from Nostr: {
  identitiesCount: 2,
  wasEncrypted: true,
  ...
}
💾 Saving vault to local IndexedDB...
```

### 7c. Verify Both Identities Load
- ✅ Personal identity present
- ✅ Work identity present
- ✅ All data synced from Nostr

---

## 🧪 Step 8: Test Identity Persistence After Multiple Operations

### 8a. Add Third Identity
1. In dashboard, add another identity: `Crypto`
2. Verify it appears

### 8b. Reload Page
1. Hard reload (Ctrl+Shift+R)
2. Login with PIN

### 8c. Verify All Three Identities
- ✅ Personal
- ✅ Work  
- ✅ Crypto

### 8d. Add Fourth Identity
1. Add: `Gaming`
2. **Do NOT reload**
3. Open new tab
4. Navigate to vault
5. Login with PIN

### 8e. Verify Background Sync
Check console for:
```
🔄 [LOGIN] Background sync check: {
  localIdentitiesCount: 3,
  remoteIdentitiesCount: 4  ← Remote has more!
}
📥 [LOGIN] Syncing from Nostr...
✅ [LOGIN] Vault synced from Nostr
```

All 4 identities should appear!

---

## 🐛 Step 9: Troubleshooting

### Issue: Identities Not Persisting

**Check 1: Encryption Working?**
```javascript
// In console after adding identity
// Look for this log:
"🔐 [saveVaultToNostr] Payload encrypted with NIP-04"

// If missing, encryption is not working
```

**Check 2: Field Names Correct?**
```javascript
// In console, after vault fetch:
// Look for these logs:
"hasXprivEncrypted: true"  ← Should be true
"hasEncryptedVaultInDB: true"  ← Should be true

// If false, field mapping is broken
```

**Check 3: Sync Happening?**
```javascript
// After adding identity, look for:
"✅ [Add Identity] Synced to Nostr"

// If missing, sync may have failed
```

**Check 4: Nostr Relay Reachable?**
```javascript
// Check for relay errors:
"❌ Failed to publish to wss://relay.damus.io"

// Try different relays if needed
```

### Issue: Encryption Not Working

**Symptom:** Vault content on Nostr is readable JSON

**Solution:** Rebuild packages
```bash
cd packages/nostrHelpers
npm run build
cd ../../apps/vault  
npm run build
```

### Issue: "Vault not found" on Login

**Symptom:** Can't login after creating account

**Possible causes:**
1. Nostr publish failed
2. Wrong environment (dev vs prod)
3. Relays not responding

**Check:**
```javascript
// Look for these during creation:
"✅ [CREATE ACCOUNT] LoginObj saved to Nostr"
"✅ [CREATE ACCOUNT] VaultObj saved to Nostr"

// If missing, publish failed
```

---

## ✅ Success Criteria

### Must Pass All:
- [ ] Account creation succeeds
- [ ] Initial identity created (Personal)
- [ ] Second identity can be added (Work)
- [ ] After reload, BOTH identities present
- [ ] Console shows "NIP-04 encrypted" logs
- [ ] Vault content on Nostr is encrypted (not readable)
- [ ] New device can fetch and decrypt vault
- [ ] Multi-tab sync works (background sync)
- [ ] Console shows correct identity counts at each step

### If ANY fail:
1. Check console logs for errors
2. Verify rebuild completed
3. Confirm old data was cleared
4. Check network tab for Nostr relay connections

---

## 📊 Test Results Template

Copy this and fill it out:

```
## Test Results - [Date]

### Environment
- Browser: 
- Vault version: 
- Node version: 

### Test 1: Account Creation
- [ ] Success
- [ ] Logs show encryption
- Issues: 

### Test 2: Add Identity  
- [ ] Success
- [ ] Saved locally
- [ ] Synced to Nostr
- Issues:

### Test 3: Persistence After Reload
- [ ] Login works
- [ ] Identity count correct: ___ (expected: 2)
- [ ] Console shows encrypted vault retrieved
- Issues:

### Test 4: Verify Encryption on Nostr
- [ ] Content is encrypted (not readable)
- [ ] Has "encryption: nip04" tag
- Issues:

### Test 5: Multi-Device
- [ ] Vault loads in incognito
- [ ] All identities present
- Issues:

### Overall Result
- [ ] PASS - All tests passed
- [ ] FAIL - Issues found (describe below)

Issues:
```

---

## 🆘 Need Help?

If tests fail:
1. Share console logs (screenshots or text)
2. Share test results template filled out
3. Include any error messages
4. Note which step failed

Good luck! 🚀

