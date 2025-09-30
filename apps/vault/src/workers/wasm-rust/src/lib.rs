// src/lib.rs

use wasm_bindgen::prelude::*;
use base64::Engine;

mod error;
mod keys;
mod nostr;
mod crypto;
mod kdf;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[wasm_bindgen]
pub struct NostrCrypto {
    // Future: Store encrypted keys in memory
}

#[wasm_bindgen]
impl NostrCrypto {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        console_log!("NostrCrypto initialized");
        Self {}
    }

    /// Generate a new Nostr keypair
    #[wasm_bindgen(js_name = generateKeypair)]
    pub fn generate_keypair(&self) -> Result<JsValue, JsValue> {
        let (private_key, public_key) = keys::generate_keypair()
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
        
        let result = serde_json::json!({
            "privateKey": private_key,
            "publicKey": public_key,
        });
        
        Ok(serde_wasm_bindgen::to_value(&result)?)
    }

    /// Get public key from private key
    #[wasm_bindgen(js_name = getPublicKey)]
    pub fn get_public_key(&self, private_key: &str) -> Result<String, JsValue> {
        keys::get_public_key(private_key)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }

    /// Sign a Nostr event
    #[wasm_bindgen(js_name = signEvent)]
    pub fn sign_event(&self, event_js: JsValue, private_key: &str) -> Result<JsValue, JsValue> {
        let mut event: nostr::NostrEvent = serde_wasm_bindgen::from_value(event_js)?;
        
        nostr::sign_event(&mut event, private_key)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
        
        Ok(serde_wasm_bindgen::to_value(&event)?)
    }

    /// Calculate event ID
    #[wasm_bindgen(js_name = calculateEventId)]
    pub fn calculate_event_id(&self, event_js: JsValue) -> Result<String, JsValue> {
        let event: nostr::NostrEvent = serde_wasm_bindgen::from_value(event_js)?;
        
        nostr::calculate_event_id(&event)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }

    /// NIP-04 encrypt
    #[wasm_bindgen(js_name = nip04Encrypt)]
    pub fn nip04_encrypt(
        &self,
        plaintext: &str,
        sender_private_key: &str,
        recipient_public_key: &str,
    ) -> Result<String, JsValue> {
        crypto::nip04_encrypt(plaintext, sender_private_key, recipient_public_key)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }

    /// NIP-04 decrypt
    #[wasm_bindgen(js_name = nip04Decrypt)]
    pub fn nip04_decrypt(
        &self,
        ciphertext: &str,
        recipient_private_key: &str,
        sender_public_key: &str,
    ) -> Result<String, JsValue> {
        crypto::nip04_decrypt(ciphertext, recipient_private_key, sender_public_key)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }

    /// Derive key from password
    #[wasm_bindgen(js_name = deriveKeyFromPassword)]
    pub fn derive_key_from_password(
        &self,
        password: &str,
        salt: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let derived = kdf::derive_key_from_password(password, salt.as_deref())
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
        
        let result = serde_json::json!({
            "key": hex::encode(&derived.key),
            "salt": derived.salt,
        });
        
        Ok(serde_wasm_bindgen::to_value(&result)?)
    }

    /// Encrypt data for local storage
    #[wasm_bindgen(js_name = encryptData)]
    pub fn encrypt_data(&self, data: &str, password: &str) -> Result<String, JsValue> {
        let encrypted = crypto::aes_encrypt(data.as_bytes(), password)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
        
        Ok(base64::engine::general_purpose::STANDARD.encode(&encrypted))
    }

    /// Decrypt data from local storage
    #[wasm_bindgen(js_name = decryptData)]
    pub fn decrypt_data(&self, encrypted_data: &str, password: &str) -> Result<String, JsValue> {
        let data = base64::engine::general_purpose::STANDARD
            .decode(encrypted_data)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        
        let decrypted = crypto::aes_decrypt(&data, password)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
        
        String::from_utf8(decrypted)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Generate a new extended private key (xpriv)
    #[wasm_bindgen(js_name = generateXpriv)]
    pub fn generate_xpriv(&self) -> Result<String, JsValue> {
        keys::generate_xpriv()
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }

    /// Derive a keypair from xpriv using BIP44 path
    #[wasm_bindgen(js_name = deriveKeypairFromXpriv)]
    pub fn derive_keypair_from_xpriv(&self, xpriv: &str, index: u32) -> Result<JsValue, JsValue> {
        let (private_key, public_key) = keys::derive_keypair_from_xpriv(xpriv, index)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
        
        let result = serde_json::json!({
            "privateKey": private_key,
            "publicKey": public_key,
            "path": keys::get_identity_path(index),
        });
        
        Ok(serde_wasm_bindgen::to_value(&result)?)
    }

    /// Sign a message with Schnorr signature
    #[wasm_bindgen(js_name = signMessage)]
    pub fn sign_message(&self, message: &str, private_key: &str) -> Result<String, JsValue> {
        nostr::sign_message(message, private_key)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }

    /// Derive storage keypair from xpriv for vault data encryption
    #[wasm_bindgen(js_name = deriveStorageKeypairFromXpriv)]
    pub fn derive_storage_keypair_from_xpriv(&self, xpriv: &str) -> Result<JsValue, JsValue> {
        let (private_key, public_key) = keys::derive_storage_keypair_from_xpriv(xpriv)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
        
        let result = serde_json::json!({
            "privateKey": private_key,
            "publicKey": public_key,
            "path": keys::get_storage_path(),
        });
        
        Ok(serde_wasm_bindgen::to_value(&result)?)
    }

    /// Get the storage derivation path
    #[wasm_bindgen(js_name = getStoragePath)]
    pub fn get_storage_path(&self) -> String {
        keys::get_storage_path()
    }

    /// Encrypt data with AES-256-GCM using Argon2id (with salt generation)
    #[wasm_bindgen(js_name = encryptDataWithArgon2)]
    pub fn encrypt_data_with_argon2(&self, data: &str, password: &str) -> Result<String, JsValue> {
        let encrypted = crypto::aes_encrypt(data.as_bytes(), password)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
        
        Ok(base64::engine::general_purpose::STANDARD.encode(&encrypted))
    }

    /// Decrypt data with AES-256-GCM using Argon2id (with salt extraction)
    #[wasm_bindgen(js_name = decryptDataWithArgon2)]
    pub fn decrypt_data_with_argon2(&self, encrypted_data: &str, password: &str) -> Result<String, JsValue> {
        let data = base64::engine::general_purpose::STANDARD
            .decode(encrypted_data)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        
        let decrypted = crypto::aes_decrypt(&data, password)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
        
        String::from_utf8(decrypted)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Encrypt data with AES-256-GCM using Argon2id with specific salt (for PIN encryption)
    #[wasm_bindgen(js_name = encryptDataWithSalt)]
    pub fn encrypt_data_with_salt(&self, data: &str, password: &str, salt: &str) -> Result<String, JsValue> {
        let encrypted = crypto::aes_encrypt_with_salt(data.as_bytes(), password, salt)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
        
        Ok(base64::engine::general_purpose::STANDARD.encode(&encrypted))
    }

    /// Decrypt data with AES-256-GCM using Argon2id with specific salt (for PIN decryption)
    #[wasm_bindgen(js_name = decryptDataWithSalt)]
    pub fn decrypt_data_with_salt(&self, encrypted_data: &str, password: &str, salt: &str) -> Result<String, JsValue> {
        let data = base64::engine::general_purpose::STANDARD
            .decode(encrypted_data)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        
        let decrypted = crypto::aes_decrypt_with_salt(&data, password, salt)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
        
        String::from_utf8(decrypted)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Generate secure random bytes
    #[wasm_bindgen(js_name = generateRandomBytes)]
    pub fn generate_random_bytes(&self, length: usize) -> Result<String, JsValue> {
        use getrandom::getrandom;
        
        let mut bytes = vec![0u8; length];
        getrandom(&mut bytes)
            .map_err(|e| JsValue::from_str(&format!("Failed to generate random bytes: {}", e)))?;
        
        Ok(hex::encode(bytes))
    }

    /// Generate a secure salt for encryption
    #[wasm_bindgen(js_name = generateSalt)]
    pub fn generate_salt(&self) -> Result<String, JsValue> {
        use crate::kdf::generate_salt;
        Ok(generate_salt())
    }

    /// Securely zeroize a string (for cleanup)
    #[wasm_bindgen(js_name = zeroizeString)]
    pub fn zeroize_string(&self, _data: &str) -> Result<(), JsValue> {
        // Note: In JavaScript, we can't actually zeroize strings due to immutability
        // This is more of a placeholder for future memory management
        Ok(())
    }

    /// Encrypt LoginObj with storage public key
    #[wasm_bindgen(js_name = encryptLoginObj)]
    pub fn encrypt_login_obj(&self, login_obj: &str, storage_public_key: &str) -> Result<String, JsValue> {
        use sha2::{Digest, Sha256};
        
        // For LoginObj, we use the storage public key for encryption
        // This is a simple implementation - in production, use proper ECDH
        let mut hasher = Sha256::new();
        hasher.update(storage_public_key.as_bytes());
        let key = hasher.finalize();
        
        let encrypted = crypto::aes_encrypt_with_salt(login_obj.as_bytes(), &hex::encode(key), "loginobj")
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
        
        Ok(base64::engine::general_purpose::STANDARD.encode(&encrypted))
    }

    /// Decrypt LoginObj with storage private key
    #[wasm_bindgen(js_name = decryptLoginObj)]
    pub fn decrypt_login_obj(&self, encrypted_login_obj: &str, storage_private_key: &str) -> Result<String, JsValue> {
        use sha2::{Digest, Sha256};
        
        // Derive the same key from private key
        let secret_key_bytes = hex::decode(storage_private_key)
            .map_err(|e| JsValue::from_str(&format!("Invalid private key: {}", e)))?;
        
        if secret_key_bytes.len() != 32 {
            return Err(JsValue::from_str("Invalid private key length"));
        }
        
        let mut key_bytes = [0u8; 32];
        key_bytes.copy_from_slice(&secret_key_bytes);
        let secret_key = k256::SecretKey::from_bytes(&key_bytes.into())
            .map_err(|e| JsValue::from_str(&format!("Invalid private key: {}", e)))?;
        
        let public_key = secret_key.public_key();
        let public_key_hex = hex::encode(public_key.to_sec1_bytes());
        
        let mut hasher = Sha256::new();
        hasher.update(public_key_hex.as_bytes());
        let key = hasher.finalize();
        
        let data = base64::engine::general_purpose::STANDARD
            .decode(encrypted_login_obj)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        
        let decrypted = crypto::aes_decrypt_with_salt(&data, &hex::encode(key), "loginobj")
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
        
        String::from_utf8(decrypted)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Encrypt VaultObj with PIN
    #[wasm_bindgen(js_name = encryptVaultObj)]
    pub fn encrypt_vault_obj(&self, vault_obj: &str, pin: &str, salt: &str) -> Result<String, JsValue> {
        let encrypted = crypto::aes_encrypt_with_salt(vault_obj.as_bytes(), pin, salt)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
        
        Ok(base64::engine::general_purpose::STANDARD.encode(&encrypted))
    }

    /// Decrypt VaultObj with PIN
    #[wasm_bindgen(js_name = decryptVaultObj)]
    pub fn decrypt_vault_obj(&self, encrypted_vault_obj: &str, pin: &str, salt: &str) -> Result<String, JsValue> {
        let data = base64::engine::general_purpose::STANDARD
            .decode(encrypted_vault_obj)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        
        let decrypted = crypto::aes_decrypt_with_salt(&data, pin, salt)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
        
        String::from_utf8(decrypted)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

/// Initialize the WASM module
#[wasm_bindgen(start)]
pub fn init() {
    console_log!("NostrCrypto WASM module loaded");
}
