use once_cell::sync::Lazy;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use tauri::command;

static CANCELLED_TRANSFERS: Lazy<Mutex<HashSet<u32>>> = Lazy::new(|| Mutex::new(HashSet::new()));

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub size: u64,
    pub modified: Option<u64>,
}

fn build_local_conflict_path(path: &Path, index: u32) -> PathBuf {
    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("file");
    let extension = path.extension().and_then(|value| value.to_str());

    let file_name = if let Some(ext) = extension {
        format!("{stem} ({index}).{ext}")
    } else {
        format!("{stem} ({index})")
    };

    parent.join(file_name)
}

#[command]
pub async fn resolve_local_target_path(path: String) -> Result<String, String> {
    let desired_path = PathBuf::from(&path);
    if !desired_path.exists() {
        return Ok(path);
    }

    let mut index = 1u32;
    loop {
        let candidate = build_local_conflict_path(&desired_path, index);
        if !candidate.exists() {
            return Ok(candidate.to_string_lossy().to_string());
        }
        index += 1;
    }
}

// 获取SFTP文件信息（未实现：请通过 sftp_russh::sftp_stat 获取）
#[command]
pub async fn get_sftp_file_info(_connection_id: String, _path: String) -> Result<FileInfo, String> {
    Err("get_sftp_file_info: not implemented, use sftp_stat instead".to_string())
}

// 带进度的下载功能（未实现：请通过 sftp_russh::download_sftp_file 实现）
#[command]
pub async fn download_sftp_file_with_progress(
    _connection_id: String,
    _remote_path: String,
    _local_path: String,
) -> Result<(), String> {
    Err("download_sftp_file_with_progress: not implemented, use download_sftp_file instead".to_string())
}

// 取消下载
#[command]
pub async fn cancel_download(download_id: u32) -> Result<(), String> {
    CANCELLED_TRANSFERS.lock().insert(download_id);
    println!("取消下载: {}", download_id);
    Ok(())
}

#[command]
pub async fn cancel_transfer(transfer_id: u32) -> Result<(), String> {
    CANCELLED_TRANSFERS.lock().insert(transfer_id);
    println!("取消传输: {}", transfer_id);
    Ok(())
}

pub fn is_transfer_cancelled(transfer_id: u32) -> bool {
    CANCELLED_TRANSFERS.lock().contains(&transfer_id)
}

pub fn reset_transfer_cancel(transfer_id: u32) {
    CANCELLED_TRANSFERS.lock().remove(&transfer_id);
}

// 打开文件位置
#[command]
pub async fn open_file_location(path: String) -> Result<(), String> {
    println!("打开文件位置: {}", path);
    let path_obj = Path::new(&path);

    // 检查文件是否存在
    if !path_obj.exists() {
        return Err(format!("文件不存在: {}", path));
    }

    println!("文件存在，准备打开文件管理器");

    // 根据操作系统打开文件管理器
    #[cfg(target_os = "windows")]
    {
        println!("使用 Windows Explorer 打开");
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法打开文件管理器: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        println!("使用 macOS Finder 打开");
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法打开Finder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        println!("使用 Linux 文件管理器打开");
        let dir = if path_obj.is_file() {
            path_obj.parent().unwrap_or(path_obj)
        } else {
            path_obj
        };
        std::process::Command::new("xdg-open")
            .arg(dir)
            .spawn()
            .map_err(|e| format!("无法打开文件管理器: {}", e))?;
    }

    println!("文件管理器已打开");
    Ok(())
}
