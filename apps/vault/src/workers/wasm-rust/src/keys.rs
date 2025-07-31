use crate::error::CryptoError;
use rand::rngs::OsRng;
use k256::{
    schnorr::SigningKey,
    SecretKey,
};
use zeroize::Zeroize;
use bip39::Mnemonic;
use bip32::{XPrv, DerivationPath, Prefix};
use std::str::FromStr;

/// Secure storage for a private key that zeros memory on drop
#[derive(Zeroize)]
#[zeroize(drop)]
pub struct SecurePrivateKey {
    key_bytes: Vec<u8>,
}

impl SecurePrivateKey {
    pub fn from_hex(hex: &str) -> Result<Self, CryptoError> {
        let key_bytes = hex::decode(hex)
            .map_err(|e| CryptoError::InvalidKey(e.to_string()))?;
        
        if key_bytes.len() != 32 {
            return Err(CryptoError::InvalidKey("Private key must be 32 bytes".to_string()));
        }
        
        Ok(Self { key_bytes })
    }
    
    pub fn to_secret_key(&self) -> Result<SecretKey, CryptoError> {
        if self.key_bytes.len() != 32 {
            return Err(CryptoError::InvalidKey("Invalid key length".to_string()));
        }
        let mut bytes = [0u8; 32];
        bytes.copy_from_slice(&self.key_bytes);
        SecretKey::from_bytes(&bytes.into())
            .map_err(|e| CryptoError::InvalidKey(e.to_string()))
    }
    
    pub fn to_hex(&self) -> String {
        hex::encode(&self.key_bytes)
    }
}

/// Generate a new Nostr keypair
pub fn generate_keypair() -> Result<(String, String), CryptoError> {
    let secret_key = SecretKey::random(&mut OsRng);
    let signing_key = SigningKey::from(secret_key.clone());
    let verifying_key = signing_key.verifying_key();
    
    let private_key = hex::encode(secret_key.to_bytes());
    // Get x-only public key (32 bytes) for Nostr
    let public_key_bytes = verifying_key.to_bytes();
    let public_key_hex = hex::encode(public_key_bytes);
    
    Ok((private_key, public_key_hex))
}

/// Derive public key from private key
pub fn get_public_key(private_key_hex: &str) -> Result<String, CryptoError> {
    let bytes = hex::decode(private_key_hex)
        .map_err(|e| CryptoError::InvalidKey(e.to_string()))?;
    if bytes.len() != 32 {
        return Err(CryptoError::InvalidKey("Invalid key length".to_string()));
    }
    let mut key_bytes = [0u8; 32];
    key_bytes.copy_from_slice(&bytes);
    let secret_key = SecretKey::from_bytes(&key_bytes.into())
        .map_err(|e| CryptoError::InvalidKey(e.to_string()))?;
    
    let signing_key = SigningKey::from(secret_key);
    let verifying_key = signing_key.verifying_key();
    
    // Get x-only public key (32 bytes) for Nostr
    let public_key_bytes = verifying_key.to_bytes();
    Ok(hex::encode(public_key_bytes))
}

/// Validate a private key
pub fn validate_private_key(private_key_hex: &str) -> bool {
    if let Ok(bytes) = hex::decode(private_key_hex) {
        if bytes.len() == 32 {
            let mut key_bytes = [0u8; 32];
            key_bytes.copy_from_slice(&bytes);
            return SecretKey::from_bytes(&key_bytes.into()).is_ok();
        }
    }
    false
}

/// Create a signing key from a private key hex string
pub fn signing_key_from_private_key(private_key_hex: &str) -> Result<SigningKey, CryptoError> {
    let bytes = hex::decode(private_key_hex)
        .map_err(|e| CryptoError::InvalidKey(e.to_string()))?;
    if bytes.len() != 32 {
        return Err(CryptoError::InvalidKey("Invalid key length".to_string()));
    }
    let mut key_bytes = [0u8; 32];
    key_bytes.copy_from_slice(&bytes);
    let secret_key = SecretKey::from_bytes(&key_bytes.into())
        .map_err(|e| CryptoError::InvalidKey(e.to_string()))?;
    
    Ok(SigningKey::from(secret_key))
}

/// Generate a new extended private key (xpriv) from entropy
pub fn generate_xpriv() -> Result<String, CryptoError> {
    // Generate random entropy for a 24-word mnemonic (256 bits)
    let mut entropy = [0u8; 32];
    getrandom::getrandom(&mut entropy)
        .map_err(|e| CryptoError::KeyGenerationFailed(e.to_string()))?;
    
    // Generate a mnemonic from entropy
    let mnemonic = Mnemonic::from_entropy(&entropy)
        .map_err(|e| CryptoError::KeyGenerationFailed(e.to_string()))?;
    
    // Convert to seed (no passphrase)
    let seed = mnemonic.to_seed("");
    
    // Create extended private key from seed
    let master_key = XPrv::new(&seed)
        .map_err(|e| CryptoError::KeyGenerationFailed(e.to_string()))?;
    
    // Return the xpriv string (using MAINNET prefix for Bitcoin standard)
    Ok(master_key.to_string(Prefix::XPRV).to_string())
}

/// Derive a keypair from xpriv using BIP44 path for Nostr
/// Path: m/44'/1237'/0'/0/{index}
pub fn derive_keypair_from_xpriv(xpriv_str: &str, index: u32) -> Result<(String, String), CryptoError> {
    // Parse the extended private key
    let master: XPrv = xpriv_str.parse()
        .map_err(|e| CryptoError::InvalidKey(format!("Failed to parse xpriv: {}", e)))?;
    
    // Define the BIP44 path: m/44'/1237'/0'/0/{index}
    // 44' = purpose (BIP44)
    // 1237' = coin type (Nostr)
    // 0' = account
    // 0 = external chain
    // {index} = address index
    let path = DerivationPath::from_str(&format!("m/44'/1237'/0'/0/{}", index))
        .map_err(|e| CryptoError::KeyGenerationFailed(format!("Invalid derivation path: {}", e)))?;
    
    // Derive the child key by iterating through the path
    let mut current_key = master;
    for child_number in path {
        current_key = current_key.derive_child(child_number)
            .map_err(|e| CryptoError::KeyGenerationFailed(format!("Failed to derive child key: {}", e)))?;
    }
    let child = current_key;
    
    // Get the private key bytes
    let private_key = child.private_key();
    let private_key_bytes = private_key.to_bytes();
    let private_key_hex = hex::encode(&private_key_bytes);
    
    // Convert to Nostr-compatible x-only public key
    let secret_key = SecretKey::from_bytes(&private_key_bytes)
        .map_err(|e| CryptoError::InvalidKey(e.to_string()))?;
    let signing_key = SigningKey::from(secret_key);
    let verifying_key = signing_key.verifying_key();
    
    // Get x-only public key (32 bytes) for Nostr
    let public_key_bytes = verifying_key.to_bytes();
    let public_key_hex = hex::encode(public_key_bytes);
    
    Ok((private_key_hex, public_key_hex))
}

/// Get the full BIP44 path string for a given index
pub fn get_identity_path(index: u32) -> String {
    format!("m/44'/1237'/0'/0/{}", index)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_generate_keypair() {
        let (private_key, public_key) = generate_keypair().unwrap();
        assert_eq!(private_key.len(), 64); // 32 bytes hex
        assert_eq!(public_key.len(), 64); // 32 bytes hex (x-only for Nostr)
    }
    
    #[test]
    fn test_derive_public_key() {
        let (private_key, expected_public_key) = generate_keypair().unwrap();
        let derived_public_key = get_public_key(&private_key).unwrap();
        assert_eq!(derived_public_key, expected_public_key);
    }
    
    #[test]
    fn test_validate_private_key() {
        let (private_key, _) = generate_keypair().unwrap();
        assert!(validate_private_key(&private_key));
        assert!(!validate_private_key("invalid"));
        assert!(!validate_private_key("deadbeef")); // Too short
    }
}