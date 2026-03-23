use wasm_bindgen::prelude::*;

#[derive(Debug)]
pub enum CryptoError {
    InvalidKey(String),
    InvalidEvent(String),
    SigningError(String),
    EncryptionError(String),
    DecryptionError(String),
    DerivationError(String),
    SerializationError(String),
    KeyGenerationFailed(String),
    Argon2(argon2::Error),
}



impl From<argon2::Error> for CryptoError {
    fn from(err: argon2::Error) -> Self {
        CryptoError::Argon2(err)
    }
}

impl From<serde_json::Error> for CryptoError {
    fn from(err: serde_json::Error) -> Self {
        CryptoError::SerializationError(err.to_string())
    }
}

impl From<CryptoError> for JsValue {
    fn from(err: CryptoError) -> Self {
        JsValue::from_str(&format!("{:?}", err))
    }
}