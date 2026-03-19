use crate::connection_store::{self, ConnectionProfile};
use crate::credential_store;
use aes_gcm::aead::Aead;
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::Utc;
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{collections::HashSet, fs};
use tauri::AppHandle;

const EXPORT_FORMAT: &str = "termlink-export";
const EXPORT_VERSION: u32 = 1;

#[derive(Debug, Serialize, Deserialize)]
struct ExportManifest {
    format: String,
    version: u32,
    #[serde(rename = "includesPasswords")]
    includes_passwords: bool,
    #[serde(rename = "exportedAt")]
    exported_at: String,
    #[serde(rename = "connectionCount")]
    connection_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct ExportedCredential {
    #[serde(rename = "connectionId")]
    connection_id: String,
    password: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct EncryptedCredentialBlob {
    nonce: String,
    #[serde(rename = "cipherText")]
    cipher_text: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ExportPackage {
    manifest: ExportManifest,
    connections: Vec<ConnectionProfile>,
    credentials: Option<EncryptedCredentialBlob>,
}

#[derive(Debug, Serialize)]
pub struct ImportPreview {
    #[serde(rename = "connectionCount")]
    connection_count: usize,
    #[serde(rename = "includesPasswords")]
    includes_passwords: bool,
    connections: Vec<ImportPreviewItem>,
}

#[derive(Debug, Serialize)]
pub struct ImportPreviewItem {
    pub id: String,
    pub name: String,
    pub host: String,
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct ImportResult {
    #[serde(rename = "importedCount")]
    imported_count: usize,
    #[serde(rename = "skippedCount")]
    skipped_count: usize,
    #[serde(rename = "overwrittenCount")]
    overwritten_count: usize,
}

#[tauri::command]
pub fn export_connections(
    app: AppHandle,
    include_passwords: bool,
    export_password: Option<String>,
) -> Result<String, String> {
    let connections = connection_store::list_connections(&app)?;
    let credentials = if include_passwords {
        Some(encrypt_credentials(
            &connections,
            &app,
            export_password
                .as_deref()
                .ok_or("导出包含密码时必须提供导出密码")?,
        )?)
    } else {
        None
    };

    let package = ExportPackage {
        manifest: ExportManifest {
            format: EXPORT_FORMAT.to_string(),
            version: EXPORT_VERSION,
            includes_passwords: include_passwords,
            exported_at: Utc::now().to_rfc3339(),
            connection_count: connections.len(),
        },
        connections,
        credentials,
    };

    serde_json::to_string_pretty(&package).map_err(|e| format!("序列化导出包失败: {}", e))
}

#[tauri::command]
pub fn save_export_package(path: String, content: String) -> Result<(), String> {
    fs::write(path, content).map_err(|e| format!("写入导出文件失败: {}", e))
}

#[tauri::command]
pub fn import_connections_preview(content: String) -> Result<ImportPreview, String> {
    let package = parse_package(&content)?;
    Ok(ImportPreview {
        connection_count: package.manifest.connection_count,
        includes_passwords: package.manifest.includes_passwords,
        connections: package
            .connections
            .iter()
            .map(|profile| ImportPreviewItem {
                id: profile.id.clone(),
                name: profile
                    .name
                    .clone()
                    .unwrap_or_else(|| format!("{}@{}", profile.username, profile.host)),
                host: profile.host.clone(),
                username: profile.username.clone(),
            })
            .collect(),
    })
}

#[tauri::command]
pub fn import_connections(
    app: AppHandle,
    content: String,
    export_password: Option<String>,
    conflict_strategy: String,
) -> Result<ImportResult, String> {
    let package = parse_package(&content)?;
    let credentials = if package.manifest.includes_passwords {
        decrypt_credentials(
            package
                .credentials
                .as_ref()
                .ok_or("导入包声明包含密码，但未找到密码数据")?,
            export_password
                .as_deref()
                .ok_or("导入包含密码的连接时必须提供导入密码")?,
        )?
    } else {
        Vec::new()
    };

    let mut existing_ids = connection_store::list_connections(&app)?
        .into_iter()
        .map(|profile| profile.id)
        .collect::<HashSet<_>>();
    let mut imported_count = 0usize;
    let mut skipped_count = 0usize;
    let mut overwritten_count = 0usize;

    for mut profile in package.connections {
        let original_id = profile.id.clone();

        if existing_ids.contains(&profile.id) {
            match conflict_strategy.as_str() {
                "skip" => {
                    skipped_count += 1;
                    continue;
                }
                "overwrite" => {
                    overwritten_count += 1;
                }
                _ => {
                    profile.id = generate_duplicate_id(&profile.id, &existing_ids);
                }
            }
        }

        connection_store::upsert_connection(&app, profile.clone())?;
        existing_ids.insert(profile.id.clone());
        imported_count += 1;

        if let Some(credential) = credentials
            .iter()
            .find(|item| item.connection_id == original_id)
        {
            credential_store::save_password(&app, &profile.id, &credential.password)?;
        }
    }

    Ok(ImportResult {
        imported_count,
        skipped_count,
        overwritten_count,
    })
}

fn parse_package(content: &str) -> Result<ExportPackage, String> {
    let package = serde_json::from_str::<ExportPackage>(content)
        .map_err(|e| format!("解析导入包失败: {}", e))?;

    if package.manifest.format != EXPORT_FORMAT {
        return Err("导入包格式不受支持".to_string());
    }

    if package.manifest.version != EXPORT_VERSION {
        return Err("导入包版本不受支持".to_string());
    }

    Ok(package)
}

fn encrypt_credentials(
    connections: &[ConnectionProfile],
    app: &AppHandle,
    export_password: &str,
) -> Result<EncryptedCredentialBlob, String> {
    let mut credentials = Vec::new();

    for profile in connections {
        if !profile.save_password {
            continue;
        }

        if let Some(password) = credential_store::load_password(app, &profile.id)? {
            credentials.push(ExportedCredential {
                connection_id: profile.id.clone(),
                password,
            });
        }
    }

    let serialized =
        serde_json::to_vec(&credentials).map_err(|e| format!("序列化导出密码失败: {}", e))?;
    let cipher = build_cipher(export_password);
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);

    let encrypted = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), serialized.as_ref())
        .map_err(|e| format!("加密导出密码失败: {}", e))?;

    Ok(EncryptedCredentialBlob {
        nonce: URL_SAFE_NO_PAD.encode(nonce_bytes),
        cipher_text: URL_SAFE_NO_PAD.encode(encrypted),
    })
}

fn decrypt_credentials(
    blob: &EncryptedCredentialBlob,
    export_password: &str,
) -> Result<Vec<ExportedCredential>, String> {
    let cipher = build_cipher(export_password);
    let nonce = URL_SAFE_NO_PAD
        .decode(&blob.nonce)
        .map_err(|e| format!("解析导入密码随机数失败: {}", e))?;
    let cipher_text = URL_SAFE_NO_PAD
        .decode(&blob.cipher_text)
        .map_err(|e| format!("解析导入密码密文失败: {}", e))?;

    let decrypted = cipher
        .decrypt(Nonce::from_slice(&nonce), cipher_text.as_ref())
        .map_err(|_| "导入密码错误或导入包已损坏".to_string())?;

    serde_json::from_slice::<Vec<ExportedCredential>>(&decrypted)
        .map_err(|e| format!("解析导入密码内容失败: {}", e))
}

fn build_cipher(export_password: &str) -> Aes256Gcm {
    let key = Sha256::digest(export_password.as_bytes());
    Aes256Gcm::new_from_slice(&key).expect("sha256 output should always be 32 bytes")
}

fn generate_duplicate_id(base_id: &str, existing_ids: &HashSet<String>) -> String {
    let timestamp = Utc::now().timestamp_millis();
    let mut index = 1u32;

    loop {
        let candidate = format!("{}-imported-{}-{}", base_id, timestamp, index);
        if !existing_ids.contains(&candidate) {
            return candidate;
        }
        index += 1;
    }
}
