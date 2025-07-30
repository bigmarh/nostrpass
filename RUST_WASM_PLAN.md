# Rust WASM Cryptographic Functions Plan

## Overview
Build a secure Rust WASM module that handles all cryptographic operations for NostrPass, ensuring private keys never leave the WASM memory space.

## Architecture
```
Vault (SolidJS) → WebWorker → WASM Module (Rust)
                     ↑
                     └── worker-messenger
```

## Core Requirements

### 1. Key Management
- [x] Master key generation (XPrv)
- [x] BIP32 key derivation
- [ ] Nostr keypair generation (secp256k1)
- [ ] Key import/export (hex format)
- [ ] Secure key storage in WASM memory
- [ ] Key encryption for persistence

### 2. Nostr-Specific Operations
- [ ] Event ID generation (SHA256 of serialized event)
- [ ] Event signing (Schnorr signatures)
- [ ] NIP-04 encryption/decryption
- [ ] NIP-44 encryption/decryption (future)
- [ ] Message verification

### 3. Security Features
- [ ] Key derivation from password (Argon2id)
- [ ] Secure random number generation
- [ ] Memory zeroing on cleanup
- [ ] Constant-time operations where needed

### 4. WASM Integration
- [ ] wasm-bindgen setup
- [ ] JavaScript/TypeScript bindings
- [ ] Async function support
- [ ] Error handling and Result types
- [ ] Memory management

## Implementation Steps

### Step 1: Set up Rust WASM project structure
```
apps/vault/src/workers/wasm-rust/
├── Cargo.toml
├── src/
│   ├── lib.rs (main module)
│   ├── keys.rs (key management)
│   ├── nostr.rs (Nostr operations)
│   ├── crypto.rs (encryption/decryption)
│   ├── kdf.rs (key derivation)
│   └── error.rs (error types)
├── tests/
│   └── integration_tests.rs
└── build.rs (if needed)
```

### Step 2: Cargo.toml dependencies
```toml
[dependencies]
wasm-bindgen = "0.2"
secp256k1 = { version = "0.28", features = ["rand", "schnorr"] }
bip32 = "0.5"
sha2 = "0.10"
hex = "0.4"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
getrandom = { version = "0.2", features = ["js"] }
argon2 = "0.5"
zeroize = "1.7"

[dependencies.web-sys]
version = "0.3"
features = ["console"]

[dev-dependencies]
wasm-bindgen-test = "0.3"
```

### Step 3: Core modules to implement

#### keys.rs - Key Management
```rust
- generate_keypair() -> (privateKey, publicKey)
- derive_keypair_from_seed(seed: &[u8]) -> (privateKey, publicKey)
- get_public_key(privateKey: &str) -> publicKey
- validate_private_key(key: &str) -> bool
```

#### nostr.rs - Nostr Protocol
```rust
- calculate_event_id(event: &Event) -> String
- sign_event(event: &Event, privateKey: &str) -> Signature
- verify_signature(event: &Event) -> bool
- serialize_event(event: &Event) -> String
```

#### crypto.rs - Encryption/Decryption
```rust
- nip04_encrypt(plaintext: &str, privateKey: &str, publicKey: &str) -> String
- nip04_decrypt(ciphertext: &str, privateKey: &str, publicKey: &str) -> String
- aes_encrypt(data: &[u8], key: &[u8]) -> Vec<u8>
- aes_decrypt(data: &[u8], key: &[u8]) -> Vec<u8>
```

#### kdf.rs - Key Derivation
```rust
- derive_key_from_password(password: &str, salt: &[u8]) -> DerivedKey
- generate_salt() -> Vec<u8>
- stretch_key(key: &[u8], iterations: u32) -> Vec<u8>
```

### Step 4: WASM bindings (lib.rs additions)
```rust
#[wasm_bindgen]
pub struct NostrCrypto {
    // Private fields for key storage
}

#[wasm_bindgen]
impl NostrCrypto {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self { ... }
    
    #[wasm_bindgen]
    pub async fn generate_keypair() -> Result<JsValue, JsError> { ... }
    
    #[wasm_bindgen]
    pub async fn sign_event(event: JsValue) -> Result<JsValue, JsError> { ... }
    
    // ... other methods
}
```

### Step 5: Build configuration
- Set up wasm-pack for building
- Configure optimization flags
- Set up build scripts in package.json
- Integrate with Vite build process

### Step 6: WebWorker integration
- Update crypto.worker.ts to load WASM
- Implement proper initialization
- Handle async WASM loading
- Map worker-messenger calls to WASM functions

### Step 7: Testing
- Unit tests in Rust
- WASM integration tests
- WebWorker communication tests
- End-to-end encryption/decryption tests

### Step 8: Security audit checklist
- [ ] No private keys in logs
- [ ] Memory zeroing implemented
- [ ] Constant-time comparisons
- [ ] Secure random generation
- [ ] No key material in error messages
- [ ] Proper cleanup on panic

## Build Commands
```bash
# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Build WASM module
cd apps/vault/src/workers/wasm-rust
wasm-pack build --target web --out-dir ../wasm-pkg

# Run tests
wasm-pack test --headless --firefox
```

## Integration with existing code
1. Update crypto.worker.ts to import WASM
2. Initialize WASM in worker startup
3. Map existing handler methods to WASM calls
4. Handle async initialization properly
5. Add proper TypeScript types

## Performance considerations
- Minimize JS/WASM boundary crossings
- Use SharedArrayBuffer if possible
- Batch operations when feasible
- Profile and optimize hot paths

## Next steps after core implementation
1. Add hardware wallet support
2. Implement threshold signatures
3. Add support for other curves
4. Implement secure multi-party computation