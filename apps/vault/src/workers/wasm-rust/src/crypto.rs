use crate::error::CryptoError;
use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use k256::{SecretKey, PublicKey};
use sha2::{Digest, Sha256};

/// NIP-04 encryption
pub fn nip04_encrypt(
    plaintext: &str,
    sender_private_key: &str,
    recipient_public_key: &str,
) -> Result<String, CryptoError> {
    // Parse keys
    let secret_key_bytes = hex::decode(sender_private_key)
        .map_err(|e| CryptoError::InvalidKey(e.to_string()))?;
    if secret_key_bytes.len() != 32 {
        return Err(CryptoError::InvalidKey("Invalid key length".to_string()));
    }
    let mut key_bytes = [0u8; 32];
    key_bytes.copy_from_slice(&secret_key_bytes);
    let secret_key = SecretKey::from_bytes(&key_bytes.into())
        .map_err(|e| CryptoError::InvalidKey(e.to_string()))?;
    
    let public_key_bytes = hex::decode(recipient_public_key)
        .map_err(|e| CryptoError::InvalidKey(e.to_string()))?;
    let _public_key = PublicKey::from_sec1_bytes(&public_key_bytes)
        .map_err(|e| CryptoError::InvalidKey(e.to_string()))?;
    
    // For NIP-04, we create a simple shared secret by combining the keys
    // This is a simplified implementation - in production use proper ECDH
    let mut hasher = Sha256::new();
    hasher.update(secret_key.to_bytes());
    hasher.update(&public_key_bytes);
    let shared_secret = hasher.finalize();
    
    // Use shared secret as encryption key
    let cipher = Aes256Gcm::new_from_slice(&shared_secret)
        .map_err(|e| CryptoError::EncryptionError(e.to_string()))?;
    
    // Generate random nonce
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    
    // Encrypt
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| CryptoError::EncryptionError(e.to_string()))?;
    
    // Combine nonce and ciphertext
    let mut result = Vec::new();
    result.extend_from_slice(&nonce);
    result.extend_from_slice(&ciphertext);
    
    // Base64 encode
    Ok(BASE64.encode(result))
}

/// NIP-04 decryption
pub fn nip04_decrypt(
    ciphertext: &str,
    recipient_private_key: &str,
    sender_public_key: &str,
) -> Result<String, CryptoError> {
    // Decode base64
    let data = BASE64
        .decode(ciphertext)
        .map_err(|e| CryptoError::DecryptionError(e.to_string()))?;
    
    if data.len() < 12 {
        return Err(CryptoError::DecryptionError("Invalid ciphertext".to_string()));
    }
    
    // Split nonce and ciphertext
    let (nonce_bytes, ciphertext_bytes) = data.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);
    
    // Parse keys
    let secret_key_bytes = hex::decode(recipient_private_key)
        .map_err(|e| CryptoError::InvalidKey(e.to_string()))?;
    if secret_key_bytes.len() != 32 {
        return Err(CryptoError::InvalidKey("Invalid key length".to_string()));
    }
    let mut key_bytes = [0u8; 32];
    key_bytes.copy_from_slice(&secret_key_bytes);
    let secret_key = SecretKey::from_bytes(&key_bytes.into())
        .map_err(|e| CryptoError::InvalidKey(e.to_string()))?;
    
    let public_key_bytes = hex::decode(sender_public_key)
        .map_err(|e| CryptoError::InvalidKey(e.to_string()))?;
    let _public_key = PublicKey::from_sec1_bytes(&public_key_bytes)
        .map_err(|e| CryptoError::InvalidKey(e.to_string()))?;
    
    // For NIP-04, we create a simple shared secret by combining the keys
    // This is a simplified implementation - in production use proper ECDH
    let mut hasher = Sha256::new();
    hasher.update(secret_key.to_bytes());
    hasher.update(&public_key_bytes);
    let shared_secret = hasher.finalize();
    
    // Use shared secret as decryption key
    let cipher = Aes256Gcm::new_from_slice(&shared_secret)
        .map_err(|e| CryptoError::DecryptionError(e.to_string()))?;
    
    // Decrypt
    let plaintext_bytes = cipher
        .decrypt(nonce, ciphertext_bytes)
        .map_err(|e| CryptoError::DecryptionError(e.to_string()))?;
    
    // Convert to string
    String::from_utf8(plaintext_bytes)
        .map_err(|e| CryptoError::DecryptionError(e.to_string()))
}

/// Encrypt data with AES-256-GCM for local storage
pub fn aes_encrypt(data: &[u8], password: &str) -> Result<Vec<u8>, CryptoError> {
    // Derive key from password using SHA256 (for now, should use proper KDF)
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    let key = hasher.finalize();
    
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| CryptoError::EncryptionError(e.to_string()))?;
    
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    
    let ciphertext = cipher
        .encrypt(&nonce, data)
        .map_err(|e| CryptoError::EncryptionError(e.to_string()))?;
    
    // Combine nonce and ciphertext
    let mut result = Vec::new();
    result.extend_from_slice(&nonce);
    result.extend_from_slice(&ciphertext);
    
    Ok(result)
}

/// Decrypt data with AES-256-GCM
pub fn aes_decrypt(data: &[u8], password: &str) -> Result<Vec<u8>, CryptoError> {
    if data.len() < 12 {
        return Err(CryptoError::DecryptionError("Invalid ciphertext".to_string()));
    }
    
    let (nonce_bytes, ciphertext) = data.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);
    
    // Derive key from password
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    let key = hasher.finalize();
    
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| CryptoError::DecryptionError(e.to_string()))?;
    
    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| CryptoError::DecryptionError(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::keys::generate_keypair;
    
    #[test]
    fn test_nip04_encrypt_decrypt() {
        let (alice_private, alice_public) = generate_keypair().unwrap();
        let (bob_private, bob_public) = generate_keypair().unwrap();
        
        let plaintext = "Hello, Bob! This is a secret message.";
        
        // Alice encrypts for Bob
        let ciphertext = nip04_encrypt(plaintext, &alice_private, &bob_public).unwrap();
        
        // Bob decrypts from Alice
        let decrypted = nip04_decrypt(&ciphertext, &bob_private, &alice_public).unwrap();
        
        assert_eq!(plaintext, decrypted);
    }
    
    #[test]
    fn test_aes_encrypt_decrypt() {
        let data = b"Secret data for local storage";
        let password = "strong_password_123";
        
        let encrypted = aes_encrypt(data, password).unwrap();
        let decrypted = aes_decrypt(&encrypted, password).unwrap();
        
        assert_eq!(data, decrypted.as_slice());
    }
}