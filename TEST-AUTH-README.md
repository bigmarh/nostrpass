# NostrPass Auth Testing CLI

A command-line tool for testing the complete NostrPass authentication lifecycle: signup, login, and logout.

## Overview

This CLI tool helps debug and understand the account storage and retrieval process in NostrPass by:

1. **Signup**: Creates a new vault, encrypts it, and publishes to Nostr relays
2. **Login**: Retrieves the vault from Nostr and decrypts it with credentials
3. **Logout**: Clears session state

## Prerequisites

Make sure all packages are built:

```bash
pnpm build
```

## Usage

Run the CLI tool:

```bash
pnpm test:auth
```

Or directly:

```bash
node test-auth-cli.js
```

## Features

### 1. Signup (Create Account)

Creates a complete NostrPass account with **preset test data**:

- Generates master xpriv from PIN
- Derives storage keypair at index 1337
- Creates **2 identities** with different public keys
- Adds **preset app permissions** for testing versioning and retrieval
- Creates LoginObj (encrypted with password)
- Creates VaultObj (encrypted with storage key)
- Publishes both to Nostr relays

**Preset Identities Created:**
- **Identity 0 (Main)**:
  - `nostr.app` → social=ALLOW, messaging=ASK_EVERYTIME, signData=ASK_EVERYTIME
  - `example.com` → signData=ALLOW, social=ASK_EVERYTIME
- **Identity 1 (Work)**:
  - `work.app` → social=ALLOW, messaging=ALLOW, signData=ASK_EVERYTIME

**Active Identity Mappings:**
- `nostr.app` → Identity 0
- `example.com` → Identity 0
- `work.app` → Identity 1

**What gets published:**
- **LoginObj** (kind 30078): Contains PIN-encrypted storage keypair
- **VaultObj** (kind 30078): Contains PIN-encrypted xpriv and 2 identities with permissions

### 2. Login (Retrieve Account)

Retrieves and decrypts account from Nostr:

- Fetches LoginObj using username + password
- Decrypts storage keypair using PIN
- Fetches VaultObj using storage keypair
- Decrypts xpriv and identities using PIN
- Derives public key from xpriv
- **Shows full VaultObj data including version number**

### 3. Update Vault (Test Versioning!)

**⭐ This is the key feature for testing versioning and updates!**

After logging in, you can update the vault to:
- Add a new identity (automatically derived from xpriv)
- Add app permissions for the new identity
- **Increment the version number**
- Publish the updated vault to Nostr

The update flow:
1. Fetches current vault from Nostr
2. Shows current version and identity count
3. Derives a new identity keypair (at next index)
4. Adds preset permissions for `newapp.com`
5. **Increments version: v1 → v2 → v3...**
6. Publishes updated vault back to Nostr

Then use Login (option 2) to verify:
- ✅ Version was incremented
- ✅ New identity was added
- ✅ Permissions are intact
- ✅ All previous data preserved

### 4. Check Vault Status

Shows current vault information (requires login first).

### 5. Logout

Clears session credentials.

## What Gets Tested

This tool tests the complete flow:

```
┌─────────────────────────────────────────────────────────┐
│                        SIGNUP                           │
├─────────────────────────────────────────────────────────┤
│ 1. Generate xpriv from PIN                             │
│ 2. Derive storage keypair (index 1337)                │
│ 3. Create password encryption key                      │
│ 4. Encrypt storage keypair with PIN → LoginObj        │
│ 5. Encrypt xpriv with PIN → VaultObj                  │
│ 6. Publish LoginObj to Nostr (password-encrypted)     │
│ 7. Publish VaultObj to Nostr (storage-key-encrypted)  │
└─────────────────────────────────────────────────────────┘

                          ⬇️

┌─────────────────────────────────────────────────────────┐
│                        LOGIN                            │
├─────────────────────────────────────────────────────────┤
│ 1. Fetch LoginObj from Nostr with password            │
│ 2. Decrypt storage keypair with PIN                   │
│ 3. Fetch VaultObj from Nostr with storage key         │
│ 4. Decrypt xpriv with PIN                             │
│ 5. Derive identities from xpriv                       │
│ 6. Ready to use!                                       │
└─────────────────────────────────────────────────────────┘
```

## Architecture Details

### LoginObj (kind 37110)
- Published to Nostr with **password encryption**
- Contains PIN-encrypted storage keypair
- Fetched during login to get storage keys

### VaultObj (kind 37111)
- Published to Nostr with **storage keypair encryption**
- Contains PIN-encrypted xpriv
- Contains user identities and permissions
- Fetched after LoginObj to get full vault data

### Two-Layer Encryption

1. **Password layer** (LoginObj): Protects access to storage keys
2. **PIN layer** (xpriv): Protects cryptographic material
3. **Storage keypair layer** (VaultObj): Protects vault contents

## Complete Testing Workflow

### Recommended Test Sequence:

1. **Signup** - Create account with 2 identities (version 1)
2. **Login** - Verify data was saved correctly
3. **Update** - Add a 3rd identity (version 2)
4. **Login again** - Verify version increment and new identity
5. **Update again** - Add a 4th identity (version 3)
6. **Login again** - Verify version and all 4 identities

This lets you test:
- ✅ Initial vault creation
- ✅ Data persistence to Nostr
- ✅ Version incrementing (v1 → v2 → v3)
- ✅ Adding identities dynamically
- ✅ Preserving existing data during updates

## Example Session

```
🔐 NostrPass Auth Testing CLI

📋 Main Menu:
1. Signup (Create new account)
2. Login (Retrieve from Nostr)
3. Check vault status
4. Logout
5. Exit

Select an option: 1

📝 Signup - Create New Account

Username: testuser123
Password: mySecurePassword
PIN (6 digits): 123456

🔄 Creating vault...
1️⃣ Generating vault...
✅ Vault created with public key: a1b2c3d4e5f6...
2️⃣ Deriving storage keypair...
✅ Storage keypair derived: f1e2d3c4b5a6...
3️⃣ Creating password encryption...
4️⃣ Encrypting storage keypair with PIN...
5️⃣ Creating default identity...
6️⃣ Creating vault object...
7️⃣ Encrypting vault object...
8️⃣ Publishing LoginObj to Nostr...
✅ LoginObj published to Nostr
9️⃣ Publishing VaultObj to Nostr...
✅ VaultObj published to Nostr

✨ Signup complete!
👤 Username: testuser123
🔑 Public Key: a1b2c3d4e5f6...
💾 Storage Public Key: f1e2d3c4b5a6...

💡 You can now test login with the same credentials
```

## Debugging

The tool provides detailed console output for each step:
- Vault generation
- Key derivation
- Encryption operations
- Nostr publishing
- **📦 Full data dumps from Nostr (LoginObj and VaultObj)**
- Decryption operations
- Identity derivation

All operations show:
- ✅ Success messages
- ❌ Error messages with stack traces
- 🔄 Progress indicators
- 📊 Status information
- **📦 Complete JSON data retrieved from Nostr relays**

### Data Visibility

During login, the tool now prints:

1. **LoginObj from Nostr** - Shows the complete decrypted LoginObj including:
   - Username
   - Storage public key
   - Encrypted storage keypair
   - PIN salt
   - Password salt
   - Creation timestamp

2. **VaultObj from Nostr** - Shows the complete decrypted VaultObj including:
   - All identities with their permissions
   - Active identity mappings per app
   - Encrypted xpriv length
   - Salt values
   - Timestamps

This makes it easy to verify that data is being correctly stored and retrieved from Nostr.

## Troubleshooting

### "Module not found" errors
Run `pnpm build` to build all packages first.

### "Account not found" on login
- Check username spelling
- Verify Nostr relays are online
- Ensure signup completed successfully

### "Wrong password" error
- Password is case-sensitive
- Make sure you're using the same password from signup

### "PIN decrypt failed"
- PIN must match the one used during signup
- PIN should be 6 digits

## Files

- `test-auth-cli.js` - Main CLI application
- `TEST-AUTH-README.md` - This documentation

## Integration with Main App

The CLI uses the same:
- Crypto primitives (`crypto-primitives.js`)
- Nostr helpers (`@nostrpass/nostrHelpers`)
- Storage keypair derivation (index 1337)
- Event kinds (37110 for LoginObj, 37111 for VaultObj)

This ensures testing matches production behavior.
