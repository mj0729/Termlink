use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use directories::ProjectDirs;
use rand::{rngs::OsRng, RngCore};
use std::{fs, path::PathBuf};
use tauri::AppHandle;

pub fn app_storage_dir(_app: &AppHandle) -> Result<PathBuf, String> {
    let proj = ProjectDirs::from("com", "Termlink", "Termlink").ok_or("无法获取应用配置目录")?;
    let dir = proj.config_dir().to_path_buf();
    fs::create_dir_all(&dir).map_err(|e| format!("创建应用配置目录失败: {}", e))?;
    Ok(dir)
}

pub fn app_key_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_storage_dir(app)?.join("app.key"))
}

pub fn ensure_app_key(app: &AppHandle) -> Result<Vec<u8>, String> {
    let path = app_key_path(app)?;

    if path.exists() {
        return load_app_key(app);
    }

    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);

    let encoded = URL_SAFE_NO_PAD.encode(key);
    fs::write(&path, encoded).map_err(|e| format!("写入应用密钥失败: {}", e))?;

    Ok(key.to_vec())
}

pub fn load_app_key(app: &AppHandle) -> Result<Vec<u8>, String> {
    let path = app_key_path(app)?;
    let content = fs::read_to_string(&path).map_err(|e| format!("读取应用密钥失败: {}", e))?;
    let key = URL_SAFE_NO_PAD
        .decode(content.trim())
        .map_err(|e| format!("解析应用密钥失败: {}", e))?;

    if key.len() != 32 {
        return Err("应用密钥长度无效".to_string());
    }

    Ok(key)
}
