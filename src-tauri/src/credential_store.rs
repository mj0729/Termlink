use crate::app_key::ensure_app_key;
use aes_gcm::aead::Aead;
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::Utc;
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Debug, Serialize, Deserialize)]
struct CredentialStoreFile {
    version: u32,
    items: Vec<CredentialRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CredentialRecord {
    #[serde(rename = "connectionId")]
    connection_id: String,
    kind: String,
    #[serde(rename = "cipherText")]
    cipher_text: String,
    nonce: String,
    #[serde(rename = "updatedAt")]
    updated_at: String,
}

impl Default for CredentialStoreFile {
    fn default() -> Self {
        Self {
            version: 1,
            items: Vec::new(),
        }
    }
}

pub fn credentials_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(crate::app_key::app_storage_dir(app)?.join("credentials.json"))
}

pub fn save_password(app: &AppHandle, connection_id: &str, password: &str) -> Result<(), String> {
    let key = ensure_app_key(app)?;
    let cipher =
        Aes256Gcm::new_from_slice(&key).map_err(|e| format!("初始化密码加密器失败: {}", e))?;

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let encrypted = cipher
        .encrypt(nonce, password.as_bytes())
        .map_err(|e| format!("加密连接密码失败: {}", e))?;

    let mut store = load_store(app)?;
    let record = CredentialRecord {
        connection_id: connection_id.to_string(),
        kind: "password".to_string(),
        cipher_text: URL_SAFE_NO_PAD.encode(encrypted),
        nonce: URL_SAFE_NO_PAD.encode(nonce_bytes),
        updated_at: Utc::now().to_rfc3339(),
    };

    if let Some(existing) = store
        .items
        .iter_mut()
        .find(|item| item.connection_id == connection_id && item.kind == "password")
    {
        *existing = record;
    } else {
        store.items.push(record);
    }

    save_store(app, &store)
}

pub fn load_password(app: &AppHandle, connection_id: &str) -> Result<Option<String>, String> {
    let store = load_store(app)?;
    let Some(record) = store
        .items
        .iter()
        .find(|item| item.connection_id == connection_id && item.kind == "password")
    else {
        return Ok(None);
    };

    let key = ensure_app_key(app)?;
    let cipher =
        Aes256Gcm::new_from_slice(&key).map_err(|e| format!("初始化密码解密器失败: {}", e))?;
    let nonce_bytes = URL_SAFE_NO_PAD
        .decode(&record.nonce)
        .map_err(|e| format!("解析密码随机数失败: {}", e))?;
    let encrypted = URL_SAFE_NO_PAD
        .decode(&record.cipher_text)
        .map_err(|e| format!("解析密码密文失败: {}", e))?;

    let decrypted = cipher
        .decrypt(Nonce::from_slice(&nonce_bytes), encrypted.as_ref())
        .map_err(|e| format!("解密连接密码失败: {}", e))?;

    let password = String::from_utf8(decrypted).map_err(|e| format!("密码内容格式无效: {}", e))?;
    Ok(Some(password))
}

pub fn delete_password(app: &AppHandle, connection_id: &str) -> Result<(), String> {
    let mut store = load_store(app)?;
    store
        .items
        .retain(|item| !(item.connection_id == connection_id && item.kind == "password"));
    save_store(app, &store)
}

fn load_store(app: &AppHandle) -> Result<CredentialStoreFile, String> {
    let path = credentials_path(app)?;

    if !path.exists() {
        let store = CredentialStoreFile::default();
        save_store(app, &store)?;
        return Ok(store);
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("读取密码存储失败: {}", e))?;
    let store = serde_json::from_str::<CredentialStoreFile>(&content)
        .map_err(|e| format!("解析密码存储失败: {}", e))?;
    Ok(store)
}

fn save_store(app: &AppHandle, store: &CredentialStoreFile) -> Result<(), String> {
    let path = credentials_path(app)?;
    let content =
        serde_json::to_string_pretty(store).map_err(|e| format!("序列化密码存储失败: {}", e))?;
    fs::write(path, content).map_err(|e| format!("写入密码存储失败: {}", e))
}
