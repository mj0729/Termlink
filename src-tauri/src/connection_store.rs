use crate::app_key::app_storage_dir;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionProfile {
    pub id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub save_password: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub private_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ConnectionStoreFile {
    version: u32,
    connections: Vec<ConnectionProfile>,
}

impl Default for ConnectionStoreFile {
    fn default() -> Self {
        Self {
            version: 1,
            connections: Vec::new(),
        }
    }
}

pub fn connections_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_storage_dir(app)?.join("connections.json"))
}

pub fn list_connections(app: &AppHandle) -> Result<Vec<ConnectionProfile>, String> {
    let store = load_store(app)?;
    Ok(store.connections)
}

pub fn upsert_connection(app: &AppHandle, profile: ConnectionProfile) -> Result<(), String> {
    let mut store = load_store(app)?;

    if let Some(existing) = store
        .connections
        .iter_mut()
        .find(|item| item.id == profile.id)
    {
        *existing = profile;
    } else {
        store.connections.push(profile);
    }

    save_store(app, &store)
}

pub fn delete_connection(app: &AppHandle, profile_id: &str) -> Result<(), String> {
    let mut store = load_store(app)?;
    store.connections.retain(|profile| profile.id != profile_id);
    save_store(app, &store)
}

fn load_store(app: &AppHandle) -> Result<ConnectionStoreFile, String> {
    let path = connections_path(app)?;

    if !path.exists() {
        let legacy_connections = load_legacy_profiles(app)?;
        let store = ConnectionStoreFile {
            version: 1,
            connections: legacy_connections,
        };
        save_store(app, &store)?;
        return Ok(store);
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("读取连接配置失败: {}", e))?;
    let store = serde_json::from_str::<ConnectionStoreFile>(&content)
        .map_err(|e| format!("解析连接配置失败: {}", e))?;
    Ok(store)
}

fn save_store(app: &AppHandle, store: &ConnectionStoreFile) -> Result<(), String> {
    let path = connections_path(app)?;
    let content =
        serde_json::to_string_pretty(store).map_err(|e| format!("序列化连接配置失败: {}", e))?;
    fs::write(path, content).map_err(|e| format!("写入连接配置失败: {}", e))
}

fn load_legacy_profiles(app: &AppHandle) -> Result<Vec<ConnectionProfile>, String> {
    let legacy_dir = app_storage_dir(app)?.join("profiles");
    if !legacy_dir.exists() {
        return Ok(Vec::new());
    }

    let mut profiles = Vec::new();

    for entry in fs::read_dir(&legacy_dir).map_err(|e| format!("读取旧连接目录失败: {}", e))?
    {
        let entry = entry.map_err(|e| format!("读取旧连接条目失败: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }

        let content =
            fs::read_to_string(&path).map_err(|e| format!("读取旧连接配置失败: {}", e))?;
        let profile = serde_json::from_str::<ConnectionProfile>(&content)
            .map_err(|e| format!("解析旧连接配置失败: {}", e))?;
        profiles.push(profile);
    }

    Ok(profiles)
}
