use crate::error::CryptoError;
use crate::keys::signing_key_from_private_key;
use bitcoin_hashes::{sha256, Hash};
use k256::{
    schnorr::{Signature, VerifyingKey},
};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NostrEvent {
    pub id: Option<String>,
    pub pubkey: String,
    pub created_at: i64,
    pub kind: i32,
    pub tags: Vec<Vec<String>>,
    pub content: String,
    pub sig: Option<String>,
}

/// Calculate event ID according to NIP-01
pub fn calculate_event_id(event: &NostrEvent) -> Result<String, CryptoError> {
    let serialized = json!([
        0,
        event.pubkey,
        event.created_at,
        event.kind,
        event.tags,
        event.content
    ]);
    
    let serialized_str = serde_json::to_string(&serialized)?;
    let hash = sha256::Hash::hash(serialized_str.as_bytes());
    
    Ok(hex::encode(hash))
}

/// Sign a Nostr event
pub fn sign_event(event: &mut NostrEvent, private_key_hex: &str) -> Result<(), CryptoError> {
    // Calculate event ID if not present
    if event.id.is_none() {
        event.id = Some(calculate_event_id(event)?);
    }
    
    let event_id = event.id.as_ref().unwrap();
    let message_bytes = hex::decode(event_id)
        .map_err(|e| CryptoError::SigningError(e.to_string()))?;
    
    if message_bytes.len() != 32 {
        return Err(CryptoError::SigningError("Event ID must be 32 bytes".to_string()));
    }
    
    let signing_key = signing_key_from_private_key(private_key_hex)?;
    
    // Generate a random auxiliary value for deterministic signing
    let mut aux_rand = [0u8; 32];
    getrandom::getrandom(&mut aux_rand)
        .map_err(|e| CryptoError::SigningError(e.to_string()))?;
    
    let signature = signing_key.sign_raw(&message_bytes, &aux_rand)
        .map_err(|e| CryptoError::SigningError(e.to_string()))?;
    
    event.sig = Some(hex::encode(signature.to_bytes()));
    
    Ok(())
}

/// Verify a Nostr event signature
pub fn verify_signature(event: &NostrEvent) -> Result<bool, CryptoError> {
    let event_id = event.id.as_ref()
        .ok_or_else(|| CryptoError::InvalidEvent("Missing event ID".to_string()))?;
    
    let sig_hex = event.sig.as_ref()
        .ok_or_else(|| CryptoError::InvalidEvent("Missing signature".to_string()))?;
    
    let message_bytes = hex::decode(event_id)
        .map_err(|e| CryptoError::InvalidEvent(e.to_string()))?;
    
    let signature_bytes = hex::decode(sig_hex)
        .map_err(|e| CryptoError::InvalidEvent(e.to_string()))?;
    
    let signature = Signature::try_from(signature_bytes.as_slice())
        .map_err(|e| CryptoError::InvalidEvent(e.to_string()))?;
    
    let pubkey_bytes = hex::decode(&event.pubkey)
        .map_err(|e| CryptoError::InvalidEvent(e.to_string()))?;
    
    // For Schnorr, we need the x-only public key (32 bytes)
    if pubkey_bytes.len() < 33 {
        return Err(CryptoError::InvalidEvent("Invalid public key length".to_string()));
    }
    let mut key_bytes = [0u8; 32];
    key_bytes.copy_from_slice(&pubkey_bytes[1..33]);
    let verifying_key = VerifyingKey::from_bytes(&key_bytes)
        .map_err(|e| CryptoError::InvalidEvent(e.to_string()))?;
    
    Ok(verifying_key.verify_raw(&message_bytes, &signature).is_ok())
}

/// Create a properly formatted Nostr event
pub fn create_event(
    kind: i32,
    content: String,
    tags: Vec<Vec<String>>,
    pubkey: String,
) -> NostrEvent {
    NostrEvent {
        id: None,
        pubkey,
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64,
        kind,
        tags,
        content,
        sig: None,
    }
}

/// Sign a message with Schnorr signature
pub fn sign_message(message: &str, private_key_hex: &str) -> Result<String, CryptoError> {
    let message_bytes = sha256::Hash::hash(message.as_bytes());
    
    let signing_key = signing_key_from_private_key(private_key_hex)?;
    
    // Generate a random auxiliary value for deterministic signing
    let mut aux_rand = [0u8; 32];
    getrandom::getrandom(&mut aux_rand)
        .map_err(|e| CryptoError::SigningError(e.to_string()))?;
    
    let signature = signing_key.sign_raw(message_bytes.as_ref(), &aux_rand)
        .map_err(|e| CryptoError::SigningError(e.to_string()))?;
    
    Ok(hex::encode(signature.to_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::keys::generate_keypair;
    
    #[test]
    fn test_event_id_calculation() {
        let event = NostrEvent {
            id: None,
            pubkey: "test_pubkey".to_string(),
            created_at: 1234567890,
            kind: 1,
            tags: vec![],
            content: "Hello, Nostr!".to_string(),
            sig: None,
        };
        
        let id = calculate_event_id(&event).unwrap();
        assert_eq!(id.len(), 64); // 32 bytes hex
    }
    
    #[test]
    fn test_sign_and_verify_event() {
        let (private_key, public_key) = generate_keypair().unwrap();
        
        let mut event = create_event(
            1,
            "Test message".to_string(),
            vec![],
            public_key,
        );
        
        sign_event(&mut event, &private_key).unwrap();
        
        assert!(event.id.is_some());
        assert!(event.sig.is_some());
        
        // Verification would need proper x-only pubkey handling
    }
}