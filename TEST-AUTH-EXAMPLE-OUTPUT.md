# Example CLI Test Output

## Signup Output

```
📝 Signup - Create New Account

Username: testuser123
Password: mySecurePassword
PIN (6 digits): 123456

🔄 Creating vault...
1️⃣ Generating vault...
✅ Vault created with public key: a1b2c3d4e5f6g7h8...
2️⃣ Deriving storage keypair...
✅ Storage keypair derived: f1e2d3c4b5a6g7h8...
3️⃣ Creating password encryption...
4️⃣ Encrypting storage keypair with PIN...
5️⃣ Creating identities with preset permissions...
✅ Created 2 identities with app permissions
6️⃣ Creating vault object...
✅ VaultObj created with 2 identities
7️⃣ Encrypting vault object...
8️⃣ Publishing LoginObj to Nostr...
✅ LoginObj published to Nostr
9️⃣ Publishing VaultObj to Nostr...
✅ VaultObj published to Nostr with d-tag: nostrpass.com_vault_f1e2d3c4b5a6_production

✨ Signup complete!
👤 Username: testuser123
🔑 Main Public Key (identity 0): a1b2c3d4e5f6g7h8i9j0...
🔑 Work Public Key (identity 1): k1l2m3n4o5p6q7r8s9t0...
💾 Storage Public Key: f1e2d3c4b5a6g7h8i9j0...

🎭 Identities Created: 2
  - Identity 0 (Main): nostr.app (social=ALLOW), example.com (signData=ALLOW)
  - Identity 1 (Work): work.app (social=ALLOW, messaging=ALLOW)

📦 VaultObj version: 1
📦 Active identity mappings: 3 apps

💡 You can now test login with the same credentials
```

## Login Output

```
🔓 Login - Retrieve from Nostr

Username: testuser123
Password: mySecurePassword
PIN: 123456

🔄 Logging in...
1️⃣ Fetching LoginObj from Nostr...
✅ LoginObj retrieved: f1e2d3c4b5a6...

📦 LoginObj Data from Nostr:
{
  "username": "testuser123",
  "storagePublicKey": "f1e2d3c4b5a6g7h8i9j0...",
  "storageKeypairEncrypted": "encrypted_base64_string...",
  "pinSalt": "salt_base64_string...",
  "passwordSalt": "password_salt_base64...",
  "createdAt": 1234567890123,
  "version": 1
}

🔑 Password Salt: password_salt_base64...

2️⃣ Decrypting storage keypair with PIN...
✅ Storage keypair decrypted: f1e2d3c4b5a6...
3️⃣ Fetching VaultObj from Nostr...
✅ VaultObj retrieved with 2 identities

📦 VaultObj Data from Nostr:
{
  "username": "testuser123",
  "version": 1,
  "createdAt": 1234567890123,
  "updatedAt": 1234567890123,
  "identitiesCount": 2,
  "identities": [
    {
      "id": "identity-0-1234567890123",
      "index": 0,
      "name": "Main Identity",
      "publicKey": "a1b2c3d4e5f6g7h8i9j0...",
      "purpose": "default",
      "appPermissions": {
        "nostr.app": {
          "appId": "nostr.app",
          "appName": "Nostr App",
          "grantedAt": 1234567890123,
          "lastUsedAt": 1234567890123,
          "getPublicKey": "ALLOW",
          "permissions": {
            "social": "ALLOW",
            "messaging": "ASK_EVERYTIME",
            "signData": "ASK_EVERYTIME",
            "zaps": "ASK_EVERYTIME",
            "financial": "DENY"
          }
        },
        "example.com": {
          "appId": "example.com",
          "appName": "Example App",
          "grantedAt": 1234567890123,
          "lastUsedAt": 1234567890123,
          "getPublicKey": "ALLOW",
          "permissions": {
            "social": "ASK_EVERYTIME",
            "messaging": "ASK_EVERYTIME",
            "signData": "ALLOW",
            "zaps": "DENY",
            "financial": "DENY"
          }
        }
      },
      "createdAt": 1234567890123,
      "lastUsed": 1234567890123
    },
    {
      "id": "identity-1-1234567890123",
      "index": 1,
      "name": "Work Identity",
      "publicKey": "k1l2m3n4o5p6q7r8s9t0...",
      "purpose": "work",
      "appPermissions": {
        "work.app": {
          "appId": "work.app",
          "appName": "Work Application",
          "grantedAt": 1234567890123,
          "lastUsedAt": 1234567890123,
          "getPublicKey": "ALLOW",
          "permissions": {
            "social": "ALLOW",
            "messaging": "ALLOW",
            "signData": "ASK_EVERYTIME",
            "zaps": "DENY",
            "financial": "DENY"
          }
        }
      },
      "createdAt": 1234567890123,
      "lastUsed": 1234567890123
    }
  ],
  "activeIdentityByApp": {
    "nostr.app": 0,
    "example.com": 0,
    "work.app": 1
  },
  "hasXprivEncrypted": true,
  "xprivEncryptedLength": 256,
  "hasSalt": true,
  "saltValue": "salt_base64_string..."
}

4️⃣ Decrypting xpriv with PIN...
✅ xpriv decrypted successfully
5️⃣ Deriving public key from xpriv...
✅ Public key derived: a1b2c3d4e5f6...

✨ Login successful!
👤 Username: testuser123
🔑 Public Key (identity 0): a1b2c3d4e5f6g7h8i9j0...
💾 Storage Public Key: f1e2d3c4b5a6g7h8i9j0...

🎭 Identities Retrieved: 2

  Identity 0 (Main Identity):
    - Public Key: a1b2c3d4e5f6g7h8i9j0...
    - Purpose: default
    - App Permissions: 2 apps
      • nostr.app:
        Allowed: social
      • example.com:
        Allowed: signData

  Identity 1 (Work Identity):
    - Public Key: k1l2m3n4o5p6q7r8s9t0...
    - Purpose: work
    - App Permissions: 1 apps
      • work.app:
        Allowed: social, messaging

📦 VaultObj Version: 1
📦 Active Identity Mappings: 3 apps
   - nostr.app → Identity 0
   - example.com → Identity 0
   - work.app → Identity 1

💡 Account retrieved and decrypted successfully!
```

## What This Shows

### Versioning Testing
- ✅ VaultObj version field is visible
- ✅ Created/updated timestamps are tracked
- ✅ Can verify version increments on updates

### Identity Testing
- ✅ Multiple identities with different public keys
- ✅ Each identity has its own app permissions
- ✅ Active identity mappings show which identity is used per app

### Permission Testing
- ✅ Granular permissions per app (social, messaging, signData, zaps, financial)
- ✅ Different permission levels (ALLOW, ASK_EVERYTIME, DENY)
- ✅ Permissions are correctly stored and retrieved

### Data Retrieval Verification
- ✅ Complete LoginObj structure from Nostr
- ✅ Complete VaultObj structure from Nostr
- ✅ All identities and permissions intact after round-trip
- ✅ Encryption/decryption working correctly
