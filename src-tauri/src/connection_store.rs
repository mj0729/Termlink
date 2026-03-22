use crate::app_key::app_storage_dir;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PortForward {
    #[serde(default)]
    pub id: String,
    #[serde(default = "default_port_forward_type")]
    pub r#type: String,
    pub local_port: u16,
    pub remote_host: String,
    pub remote_port: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

fn default_port_forward_type() -> String {
    "local".to_string()
}

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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy_jump_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy_jump_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy_jump_host: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy_jump_port: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy_jump_username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy_jump_private_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssh_config_source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssh_config_host: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub port_forwards: Vec<PortForward>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ConnectionStoreFile {
    version: u32,
    #[serde(default)]
    groups: Vec<String>,
    connections: Vec<ConnectionProfile>,
}

impl Default for ConnectionStoreFile {
    fn default() -> Self {
        Self {
            version: 1,
            groups: Vec::new(),
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

pub fn list_groups(app: &AppHandle) -> Result<Vec<String>, String> {
    let store = load_store(app)?;
    Ok(store.groups)
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

    sync_groups_from_connections(&mut store);
    save_store(app, &store)
}

pub fn delete_connection(app: &AppHandle, profile_id: &str) -> Result<(), String> {
    let mut store = load_store(app)?;
    store.connections.retain(|profile| profile.id != profile_id);
    sync_groups_from_connections(&mut store);
    save_store(app, &store)
}

pub fn create_group(app: &AppHandle, group_name: &str) -> Result<Vec<String>, String> {
    let mut store = load_store(app)?;
    let normalized = normalize_group_name(group_name)?;

    if store.groups.iter().any(|group| group == &normalized) {
        return Err("分组已存在".to_string());
    }

    store.groups.push(normalized);
    sync_groups_from_connections(&mut store);
    save_store(app, &store)?;
    Ok(store.groups)
}

pub fn rename_group(
    app: &AppHandle,
    old_name: &str,
    new_name: &str,
) -> Result<Vec<String>, String> {
    let mut store = load_store(app)?;
    let normalized_old = normalize_group_name(old_name)?;
    let normalized_new = normalize_group_name(new_name)?;

    if normalized_old == normalized_new {
        return Ok(store.groups);
    }

    if !store.groups.iter().any(|group| group == &normalized_old) {
        return Err("原分组不存在".to_string());
    }

    if store.groups.iter().any(|group| group == &normalized_new) {
        return Err("目标分组已存在".to_string());
    }

    for group in &mut store.groups {
        if group == &normalized_old {
            *group = normalized_new.clone();
        }
    }

    for profile in &mut store.connections {
        if profile.group.as_deref() == Some(normalized_old.as_str()) {
            profile.group = Some(normalized_new.clone());
        }
    }

    sync_groups_from_connections(&mut store);
    save_store(app, &store)?;
    Ok(store.groups)
}

pub fn delete_group(app: &AppHandle, group_name: &str) -> Result<Vec<String>, String> {
    let mut store = load_store(app)?;
    let normalized = normalize_group_name(group_name)?;

    if !store.groups.iter().any(|group| group == &normalized) {
        return Err("分组不存在".to_string());
    }

    store.groups.retain(|group| group != &normalized);

    for profile in &mut store.connections {
        if profile.group.as_deref() == Some(normalized.as_str()) {
            profile.group = None;
        }
    }

    sync_groups_from_connections(&mut store);
    save_store(app, &store)?;
    Ok(store.groups)
}

fn load_store(app: &AppHandle) -> Result<ConnectionStoreFile, String> {
    let path = connections_path(app)?;

    if !path.exists() {
        let legacy_connections = load_legacy_profiles(app)?;
        let store = ConnectionStoreFile {
            version: 1,
            groups: collect_profile_groups(&legacy_connections),
            connections: legacy_connections,
        };
        save_store(app, &store)?;
        return Ok(store);
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("读取连接配置失败: {}", e))?;
    let mut store = serde_json::from_str::<ConnectionStoreFile>(&content)
        .map_err(|e| format!("解析连接配置失败: {}", e))?;
    sync_groups_from_connections(&mut store);
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

fn normalize_group_name(group_name: &str) -> Result<String, String> {
    let normalized = group_name.trim();
    if normalized.is_empty() {
        return Err("分组名称不能为空".to_string());
    }
    Ok(normalized.to_string())
}

fn collect_profile_groups(profiles: &[ConnectionProfile]) -> Vec<String> {
    let mut groups = profiles
        .iter()
        .filter_map(|profile| profile.group.as_ref())
        .filter_map(|group| normalize_group_name(group).ok())
        .collect::<Vec<_>>();
    groups.sort();
    groups.dedup();
    groups
}

fn sync_groups_from_connections(store: &mut ConnectionStoreFile) {
    let mut groups = store
        .groups
        .iter()
        .filter_map(|group| normalize_group_name(group).ok())
        .collect::<Vec<_>>();

    groups.extend(collect_profile_groups(&store.connections));
    groups.sort();
    groups.dedup();
    store.groups = groups;
}
