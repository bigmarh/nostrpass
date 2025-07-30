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
}

/// Initialize the WASM module
#[wasm_bindgen(start)]
pub fn init() {
    console_log!("NostrCrypto WASM module loaded");
}
