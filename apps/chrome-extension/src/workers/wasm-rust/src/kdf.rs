use crate::error::CryptoError;
use argon2::{
    password_hash::{
        rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString,
    },
    Argon2, Params,
};
use zeroize::Zeroize;

#[derive(Clone)]
pub struct DerivedKey {
    pub key: Vec<u8>,
    pub salt: String,
}

impl Drop for DerivedKey {
    fn drop(&mut self) {
        self.key.zeroize();
    }
}

/// Derive a key from password using Argon2id
pub fn derive_key_from_password(
    password: &str,
    salt: Option<&str>,
) -> Result<DerivedKey, CryptoError> {
    // Use provided salt or generate new one
    let salt_string = match salt {
        Some(s) => SaltString::from_b64(s)
            .map_err(|e| CryptoError::DerivationError(e.to_string()))?,
        None => SaltString::generate(&mut OsRng),
    };
    
    // Configure Argon2 parameters
    // Memory: 4 MB (4096 KiB), Iterations: 5, Parallelism: 1
    // Minimal memory for WASM constraints, compensated with more iterations
    let params = Params::new(4096, 5, 1, Some(32))
        .map_err(|e| CryptoError::DerivationError(e.to_string()))?;
    
    let argon2 = Argon2::new(
        argon2::Algorithm::Argon2id,
        argon2::Version::V0x13,
        params,
    );
    
    // Hash password
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt_string)
        .map_err(|e| CryptoError::DerivationError(e.to_string()))?;
    
    // Extract the raw hash bytes
    let hash_bytes = password_hash.hash
        .ok_or_else(|| CryptoError::DerivationError("No hash generated".to_string()))?;
    
    Ok(DerivedKey {
        key: hash_bytes.as_bytes().to_vec(),
        salt: salt_string.to_string(),
    })
}

/// Verify a password against a stored hash
pub fn verify_password(
    password: &str,
    password_hash_str: &str,
) -> Result<bool, CryptoError> {
    let parsed_hash = PasswordHash::new(password_hash_str)
        .map_err(|e| CryptoError::DerivationError(e.to_string()))?;
    
    let argon2 = Argon2::default();
    
    Ok(argon2.verify_password(password.as_bytes(), &parsed_hash).is_ok())
}

/// Generate a new salt
pub fn generate_salt() -> String {
    SaltString::generate(&mut OsRng).to_string()
}

/// Stretch a key using PBKDF2-like iterations (for additional security)
pub fn stretch_key(key: &[u8], iterations: u32) -> Result<Vec<u8>, CryptoError> {
    use sha2::{Sha256, Digest};
    
    let mut result = key.to_vec();
    
    for _ in 0..iterations {
        let mut hasher = Sha256::new();
        hasher.update(&result);
        result = hasher.finalize().to_vec();
    }
    
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_derive_key_from_password() {
        let password = "test_password_123";
        let derived = derive_key_from_password(password, None).unwrap();
        
        assert_eq!(derived.key.len(), 32);
        assert!(!derived.salt.is_empty());
        
        // Derive again with same salt
        let derived2 = derive_key_from_password(password, Some(&derived.salt)).unwrap();
        assert_eq!(derived.key, derived2.key);
    }
    
    #[test]
    fn test_different_passwords_different_keys() {
        let password1 = "password1";
        let password2 = "password2";
        
        let derived1 = derive_key_from_password(password1, None).unwrap();
        let derived2 = derive_key_from_password(password2, Some(&derived1.salt)).unwrap();
        
        assert_ne!(derived1.key, derived2.key);
    }
    
    #[test]
    fn test_stretch_key() {
        let key = b"test_key";
        let stretched = stretch_key(key, 1000).unwrap();
        
        assert_eq!(stretched.len(), 32); // SHA256 output
        assert_ne!(stretched, key);
    }
}