use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

/// 主机密钥记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostKeyRecord {
    pub host: String,
    pub port: u16,
    pub algorithm: String,
    pub fingerprint_sha256: String,
    pub public_key_base64: String,
    pub first_seen_at: String,
    pub last_seen_at: String,
    pub trust_source: String,
    pub profile_id: Option<String>,
}

/// 主机密钥存储容器
#[derive(Debug, Clone, Serialize, Deserialize)]
struct HostKeyStore {
    version: String,
    records: Vec<HostKeyRecord>,
}

impl Default for HostKeyStore {
    fn default() -> Self {
        Self {
            version: "1.0".to_string(),
            records: Vec::new(),
        }
    }
}

/// 获取主机密钥存储文件路径
pub fn host_keys_path(_app: &AppHandle) -> Result<PathBuf, String> {
    let proj = ProjectDirs::from("com", "Termlink", "Termlink").ok_or("无法获取项目配置目录")?;
    let config_dir = proj.config_dir();
    fs::create_dir_all(config_dir).map_err(|e| format!("创建配置目录失败: {}", e))?;
    Ok(config_dir.join("host_keys.json"))
}

/// 加载所有主机密钥记录
pub fn load_host_key_records(app: &AppHandle) -> Result<Vec<HostKeyRecord>, String> {
    let path = host_keys_path(app)?;

    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("读取主机密钥文件失败: {}", e))?;

    let store: HostKeyStore =
        serde_json::from_str(&content).map_err(|e| format!("解析主机密钥文件失败: {}", e))?;

    Ok(store.records)
}

/// 保存所有主机密钥记录
fn save_host_key_records(app: &AppHandle, records: Vec<HostKeyRecord>) -> Result<(), String> {
    let path = host_keys_path(app)?;

    let store = HostKeyStore {
        version: "1.0".to_string(),
        records,
    };

    let content =
        serde_json::to_string_pretty(&store).map_err(|e| format!("序列化主机密钥失败: {}", e))?;

    fs::write(&path, content).map_err(|e| format!("写入主机密钥文件失败: {}", e))?;

    Ok(())
}

/// 查找主机密钥记录
pub fn find_host_key_record(
    app: &AppHandle,
    host: &str,
    port: u16,
    algorithm: &str,
) -> Result<Option<HostKeyRecord>, String> {
    let records = load_host_key_records(app)?;

    Ok(records
        .into_iter()
        .find(|r| r.host == host && r.port == port && r.algorithm == algorithm))
}

/// 插入或更新主机密钥记录
pub fn upsert_host_key_record(app: &AppHandle, record: HostKeyRecord) -> Result<(), String> {
    let mut records = load_host_key_records(app)?;

    // 查找是否已存在
    if let Some(pos) = records.iter().position(|r| {
        r.host == record.host && r.port == record.port && r.algorithm == record.algorithm
    }) {
        // 更新现有记录
        records[pos] = record;
    } else {
        // 插入新记录
        records.push(record);
    }

    save_host_key_records(app, records)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_host_key_record_serialization() {
        let record = HostKeyRecord {
            host: "example.com".to_string(),
            port: 22,
            algorithm: "ssh-ed25519".to_string(),
            fingerprint_sha256: "SHA256:abc123".to_string(),
            public_key_base64: "AAAAC3NzaC1lZDI1NTE5...".to_string(),
            first_seen_at: "2026-03-18T13:00:00Z".to_string(),
            last_seen_at: "2026-03-18T13:00:00Z".to_string(),
            trust_source: "user_confirmed".to_string(),
            profile_id: Some("profile-123".to_string()),
        };

        let json = serde_json::to_string(&record).unwrap();
        let deserialized: HostKeyRecord = serde_json::from_str(&json).unwrap();

        assert_eq!(record.host, deserialized.host);
        assert_eq!(record.port, deserialized.port);
        assert_eq!(record.algorithm, deserialized.algorithm);
    }
}
