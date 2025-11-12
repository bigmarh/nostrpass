# Quick Testing Steps

## ✅ Build Complete!

The vault app and packages have been rebuilt with the security fixes.

## 🚀 Quick Test (5 minutes)

### 1. Clear Old Data
Open Chrome DevTools (F12):
- **Application** → **Storage** → **IndexedDB** → Delete `NostrPassVault`
- **Application** → **Storage** → **Local Storage** → Clear all
- Hard reload: **Ctrl+Shift+R**

### 2. Start Dev Server
```bash
cd /Users/marh/apps/nostrpass.com/apps/vault
npm run dev
```

### 3. Create Account
- Username: `testuser`
- Password: `TestPassword123!`
- PIN: `1234`

**✅ Look for in console:**
```
🔐 [saveVaultToNostr] Payload encrypted with NIP-04
```

### 4. Add Identity
- Click "Add Identity"
- Name: `Work`

**✅ Look for in console:**
```
✅ [saveVaultToNostr] Payload created: {identitiesCount: 2}
```

### 5. Test Persistence (CRITICAL!)
- Hard reload page (**Ctrl+Shift+R**)
- Login with PIN: `1234`

**✅ Look for in console:**
```
✅ [getVaultFromNostr] Retrieved encrypted vault: {
  identitiesCount: 2,  ← MUST BE 2!
  wasEncrypted: true   ← MUST BE true!
}
```

**✅ Dashboard should show:**
- Personal identity
- Work identity (both should appear!)

## ✅ Success = Both identities appear after reload!
## ❌ Failure = Only "Personal" shows (bug not fixed)

---

## 📊 What to Share

If testing:
1. Screenshot of console showing logs
2. Screenshot of dashboard showing identities
3. Any errors

Full testing guide: `/Users/marh/apps/nostrpass.com/TESTING_GUIDE.md`

