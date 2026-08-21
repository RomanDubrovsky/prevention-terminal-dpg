//! Encrypted registry backup (.vault.enc) — zero-knowledge, local only.
//! No cloud (Supabase / cloud.ru): file stays on user storage.

use std::fmt::Write as _;

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

use crate::db::{KEY_LEN, SALT_LEN};

pub const VAULT_MAGIC: &[u8; 4] = b"PRV1";
pub const VAULT_VERSION: u16 = 1;
pub const NONCE_LEN: usize = 12;

#[derive(Debug, Error)]
pub enum VaultError {
    #[error("invalid vault file")]
    InvalidFile,
    #[error("unsupported vault version")]
    UnsupportedVersion,
    #[error("decryption failed — wrong recovery key or corrupted file")]
    DecryptFailed,
    #[error("json error: {0}")]
    Json(String),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RegistryVaultSubject {
    pub case_id: String,
    pub created_at: String,
    pub updated_at: String,
    pub profile: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegistryVaultPayload {
    pub format: String,
    pub version: u16,
    pub exported_at: String,
    pub subjects: Vec<RegistryVaultSubject>,
}

#[derive(Debug, Serialize)]
pub struct RegistryVaultVerifyResult {
    pub ok: bool,
    pub subject_count: usize,
    pub exported_at: String,
}

#[derive(Debug, Serialize)]
pub struct RegistryVaultRestoreResult {
    pub imported: usize,
    pub skipped: usize,
}

/// Normalize user input: keep hex digits only, lowercase.
pub fn normalize_recovery_key(raw: &str) -> String {
    raw.chars()
        .filter(|c| c.is_ascii_hexdigit())
        .map(|c| c.to_ascii_lowercase())
        .collect()
}

pub fn hash_recovery_key_hex(normalized: &str) -> String {
    let digest = Sha256::digest(normalized.as_bytes());
    let mut out = String::with_capacity(64);
    for b in digest {
        let _ = write!(&mut out, "{b:02x}");
    }
    out
}

/// 32 random bytes as 8×4 hex groups (BitLocker-style).
pub fn generate_recovery_key_display() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes
        .chunks(4)
        .map(|chunk| {
            chunk
                .iter()
                .map(|b| format!("{b:02X}"))
                .collect::<String>()
        })
        .collect::<Vec<_>>()
        .join("-")
}

pub fn verify_recovery_key(candidate: &str, stored_hash: &str) -> bool {
    let norm = normalize_recovery_key(candidate);
    if norm.len() != 64 {
        return false;
    }
    let hash = hash_recovery_key_hex(&norm);
    hash == stored_hash.trim().to_lowercase()
}

fn derive_backup_key(recovery_key_normalized: &str, salt: &[u8; SALT_LEN]) -> Result<[u8; KEY_LEN], VaultError> {
    let mut hasher = Sha256::new();
    hasher.update(salt);
    hasher.update(recovery_key_normalized.as_bytes());
    let digest = hasher.finalize();
    let mut key = [0u8; KEY_LEN];
    key.copy_from_slice(&digest);
    Ok(key)
}

pub fn encrypt_vault_bytes(plaintext: &[u8], recovery_key: &str) -> Result<Vec<u8>, VaultError> {
    let normalized = normalize_recovery_key(recovery_key);
    if normalized.len() != 64 {
        return Err(VaultError::DecryptFailed);
    }
    let mut salt = [0u8; SALT_LEN];
    rand::thread_rng().fill_bytes(&mut salt);
    let key = derive_backup_key(&normalized, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| VaultError::DecryptFailed)?;
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|_| VaultError::DecryptFailed)?;

    let mut out = Vec::with_capacity(4 + 2 + SALT_LEN + NONCE_LEN + ciphertext.len());
    out.extend_from_slice(VAULT_MAGIC);
    out.extend_from_slice(&VAULT_VERSION.to_le_bytes());
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

pub fn decrypt_vault_bytes(data: &[u8], recovery_key: &str) -> Result<Vec<u8>, VaultError> {
    if data.len() < 4 + 2 + SALT_LEN + NONCE_LEN + 16 {
        return Err(VaultError::InvalidFile);
    }
    if &data[0..4] != VAULT_MAGIC {
        return Err(VaultError::InvalidFile);
    }
    let version = u16::from_le_bytes([data[4], data[5]]);
    if version != VAULT_VERSION {
        return Err(VaultError::UnsupportedVersion);
    }
    let mut salt = [0u8; SALT_LEN];
    salt.copy_from_slice(&data[6..6 + SALT_LEN]);
    let nonce_start = 6 + SALT_LEN;
    let nonce_bytes = &data[nonce_start..nonce_start + NONCE_LEN];
    let ciphertext = &data[nonce_start + NONCE_LEN..];

    let normalized = normalize_recovery_key(recovery_key);
    if normalized.len() != 64 {
        return Err(VaultError::DecryptFailed);
    }
    let key = derive_backup_key(&normalized, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| VaultError::DecryptFailed)?;
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| VaultError::DecryptFailed)
}

pub fn build_vault_payload(subjects: Vec<RegistryVaultSubject>, exported_at: &str) -> Result<Vec<u8>, VaultError> {
    let payload = RegistryVaultPayload {
        format: "prevention_registry_vault".to_string(),
        version: 1,
        exported_at: exported_at.to_string(),
        subjects,
    };
    serde_json::to_vec(&payload).map_err(|e| VaultError::Json(e.to_string()))
}

pub fn parse_vault_payload(bytes: &[u8]) -> Result<RegistryVaultPayload, VaultError> {
    serde_json::from_slice(bytes).map_err(|e| VaultError::Json(e.to_string()))
}

pub fn verify_vault_file(data: &[u8], recovery_key: &str) -> Result<RegistryVaultVerifyResult, VaultError> {
    let plain = decrypt_vault_bytes(data, recovery_key)?;
    let payload = parse_vault_payload(&plain)?;
    Ok(RegistryVaultVerifyResult {
        ok: true,
        subject_count: payload.subjects.len(),
        exported_at: payload.exported_at,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_encrypt_decrypt() {
        let key = generate_recovery_key_display();
        let plain = b"hello registry vault";
        let enc = encrypt_vault_bytes(plain, &key).unwrap();
        let dec = decrypt_vault_bytes(&enc, &key).unwrap();
        assert_eq!(dec, plain);
    }

    #[test]
    fn wrong_key_fails() {
        let key = generate_recovery_key_display();
        let enc = encrypt_vault_bytes(b"secret", &key).unwrap();
        let other = generate_recovery_key_display();
        assert!(decrypt_vault_bytes(&enc, &other).is_err());
    }

    #[test]
    fn normalize_accepts_dashes() {
        let raw = "ABCD-1234-5678-9ABC-DEF0-1234-5678-9ABC-DEF0-1234-5678-9ABC-DEF0-1234";
        let norm = normalize_recovery_key(raw);
        assert_eq!(norm.len(), 64);
    }
}
