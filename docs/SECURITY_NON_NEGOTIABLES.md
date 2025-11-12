# NostrPass Security Non-Negotiables

This document outlines the critical security requirements that MUST be maintained in the NostrPass vault implementation.

## 1. Master Key (xpriv) Isolation

### Non-Negotiables:
- **The xpriv (master private key) MUST NEVER leave the WASM module**
- The xpriv must be decrypted ONLY within the WASM module (not even in the JS worker)
- Neither the main thread nor the JavaScript worker should have access to the unencrypted xpriv
- All cryptographic operations using the xpriv must happen in WASM
- The WASM module should maintain secure sessions internally

### Current Violations:
1. The xpriv is being decrypted in the main thread before passing it to the worker
2. The xpriv is being handled in JavaScript instead of being isolated in WASM
3. The WASM module doesn't maintain secure sessions - it accepts and returns the xpriv
4. PIN operations happen in JavaScript, not in WASM

## 2. Key Derivation and Storage

### Non-Negotiables:
- The xpriv uses nested encryption: PIN-encrypted xpriv is then password-encrypted
- The PIN provides the first layer of encryption for daily access
- The password provides the outer layer of encryption for the entire vault
- Identity private keys should be derived in WASM and only the specific identity key should be returned

### Security Model:
```
xpriv → Encrypt(PIN) → PIN-encrypted xpriv → Encrypt(Password) → Stored vault
Recovery: Questions → Recovery Key → Encrypted backup of xpriv

PIN Reset Flow:
1. Recover xpriv via security questions
2. User sets new PIN
3. User provides password for verification and re-encryption
4. xpriv → Encrypt(New PIN) → Encrypt(Password) → Updated vault
```

## 3. Worker and WASM Communication

### Non-Negotiables:
- All sensitive cryptographic operations MUST happen in WASM
- The worker acts as a bridge but should NOT see sensitive data
- WASM should expose only high-level operations with session management
- Never pass raw keys between any contexts

### Proper Flow:
1. Main thread sends encrypted data + password to worker
2. Worker passes to WASM which decrypts xpriv internally
3. WASM maintains session and performs all operations with xpriv
4. WASM returns only the minimal necessary data (e.g., specific identity keys)
5. Worker relays results to main thread

## 4. Session Management

### Non-Negotiables:
- The WASM module maintains the decrypted xpriv in memory during a session
- WASM should use opaque session tokens that cannot be used to extract the xpriv
- When the vault is locked, WASM MUST clear all sensitive data from memory
- No sensitive data should persist in the JavaScript worker or main thread
- Session tokens should expire after a timeout period

## 5. Data at Rest

### Non-Negotiables:
- All sensitive data in IndexedDB must be encrypted
- The encryption key must be derived from user credentials, never stored
- PIN hash is stored for verification but provides no decryption capability

## 6. Implementation Requirements

### To Fix Immediately:
1. Move xpriv decryption into the worker
2. Create a worker method that accepts encrypted xpriv + password and performs all operations internally
3. Never return the xpriv to the main thread
4. Ensure the worker maintains the xpriv securely during the session

### Correct Implementation Pattern:
```typescript
// Main thread
const session = await workerClient.unlockVault({
  encryptedXpriv: vaultData.encryptedXpriv,
  password: password,
  salt: vaultData.salt,
  username: username
});
// Returns only a session token

// Worker (bridge)
async unlockVault(params) {
  return wasmModule.createSecureSession(
    params.encryptedXpriv,
    params.password,
    params.salt,
    params.username
  );
}

// WASM (Rust)
pub fn create_secure_session(
  encrypted_xpriv: &str,
  password: &str,
  salt: &str,
  username: &str
) -> Result<String, JsValue> {
  // Decrypt xpriv inside WASM only
  let xpriv = decrypt_internal(encrypted_xpriv, password, salt)?;
  // Store in WASM memory with session token
  let session_token = generate_session_token();
  SESSIONS.insert(session_token.clone(), SecureSession {
    xpriv,
    username,
    expires_at: now() + SESSION_TIMEOUT
  });
  Ok(session_token)
}

// For operations, use session token
pub fn derive_identity_key(
  session_token: &str,
  index: u32
) -> Result<KeyPair, JsValue> {
  let session = SESSIONS.get(session_token)?;
  // Derive key from xpriv stored in WASM
  derive_key_internal(&session.xpriv, index)
}
```

## 7. PIN Security in WASM

### Non-Negotiables:
- PIN derivation and verification MUST happen in WASM
- PIN should never be logged or stored in plaintext
- PIN hash should be derived using PBKDF2 or similar in WASM
- Failed PIN attempts should be rate-limited in WASM

### Implementation:
```rust
// WASM (Rust)
pub fn verify_pin(
  session_token: &str,
  pin: &str,
  stored_pin_hash: &str,
  pin_salt: &str
) -> Result<bool, JsValue> {
  // Rate limiting
  check_rate_limit(session_token)?;
  
  // Derive PIN hash in WASM
  let derived_hash = pbkdf2(pin, pin_salt, ITERATIONS)?;
  
  // Constant-time comparison
  Ok(constant_time_eq(&derived_hash, stored_pin_hash))
}
```

## 8. Audit Checklist

- [ ] No xpriv in main thread code
- [ ] No xpriv in JavaScript worker code
- [ ] All crypto operations in WASM
- [ ] WASM maintains secure sessions with opaque tokens
- [ ] PIN operations happen in WASM
- [ ] Proper session cleanup in WASM
- [ ] Encrypted storage only
- [ ] Minimal data exposure between contexts
- [ ] No key material in console logs
- [ ] Secure memory cleanup on lock/logout
- [ ] Rate limiting for PIN attempts
- [ ] Constant-time comparisons for secrets