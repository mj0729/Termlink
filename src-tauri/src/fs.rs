use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileItem {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: Option<u64>,
    pub modified: Option<String>,
    pub is_hidden: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ParsedSshConfigPortForward {
    pub id: String,
    pub r#type: String,
    pub local_port: u16,
    pub remote_host: String,
    pub remote_port: u16,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ParsedSshConfigHost {
    pub alias: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub private_key: Option<String>,
    pub proxy_jump_alias: Option<String>,
    pub port_forwards: Vec<ParsedSshConfigPortForward>,
}

#[tauri::command]
pub fn list_files(path: String, show_hidden: bool) -> Result<Vec<FileItem>, String> {
    let target_path = if path.is_empty() {
        // 如果路径为空，返回根目录或用户目录
        dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"))
    } else {
        PathBuf::from(&path)
    };

    if !target_path.exists() {
        return Err("路径不存在".into());
    }

    if !target_path.is_dir() {
        return Err("不是一个目录".into());
    }

    let mut files = Vec::new();

    match fs::read_dir(&target_path) {
        Ok(entries) => {
            for entry in entries {
                if let Ok(entry) = entry {
                    let entry_path = entry.path();
                    let name = entry.file_name().to_string_lossy().to_string();

                    // 检查是否为隐藏文件
                    let is_hidden = name.starts_with('.');

                    // 如果不显示隐藏文件且是隐藏文件，跳过
                    if !show_hidden && is_hidden {
                        continue;
                    }

                    let metadata = entry.metadata().ok();
                    let is_directory = entry_path.is_dir();

                    let size = if is_directory {
                        None
                    } else {
                        metadata.as_ref().map(|m| m.len())
                    };

                    let modified = metadata
                        .and_then(|m| m.modified().ok())
                        .and_then(|time| {
                            time.duration_since(SystemTime::UNIX_EPOCH)
                                .ok()
                                .map(|duration| {
                                    // 转换为ISO字符串
                                    let secs = duration.as_secs();
                                    chrono::DateTime::from_timestamp(secs as i64, 0)
                                        .map(|dt| dt.to_rfc3339())
                                })
                        })
                        .flatten();

                    files.push(FileItem {
                        name,
                        path: entry_path.to_string_lossy().to_string(),
                        is_directory,
                        size,
                        modified,
                        is_hidden,
                    });
                }
            }
        }
        Err(e) => return Err(format!("读取目录失败: {}", e)),
    }

    // 排序：目录在前，然后按名称排序
    files.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(files)
}

#[tauri::command]
pub fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|path| path.to_string_lossy().to_string())
        .ok_or_else(|| "无法获取用户主目录".into())
}

#[tauri::command]
pub fn get_parent_dir(path: String) -> Result<Option<String>, String> {
    let path_buf = PathBuf::from(path);
    Ok(path_buf.parent().map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn open_file_explorer(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(path);

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path_buf)
            .spawn()
            .map_err(|e| format!("无法打开文件管理器: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path_buf)
            .spawn()
            .map_err(|e| format!("无法打开文件管理器: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path_buf)
            .spawn()
            .map_err(|e| format!("无法打开文件管理器: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn read_default_ssh_config() -> Result<Option<String>, String> {
    let Some(home) = dirs::home_dir() else {
        return Ok(None);
    };

    let path = home.join(".ssh").join("config");
    if !path.exists() {
        return Ok(None);
    }

    fs::read_to_string(path)
        .map(Some)
        .map_err(|e| format!("读取 SSH config 失败: {}", e))
}

#[tauri::command]
pub fn parse_default_ssh_config() -> Result<Vec<ParsedSshConfigHost>, String> {
    let Some(home) = dirs::home_dir() else {
        return Ok(Vec::new());
    };

    let path = home.join(".ssh").join("config");
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("读取 SSH config 失败: {}", e))?;
    Ok(parse_ssh_config_content(
        &home.to_string_lossy(),
        &content,
    ))
}

#[tauri::command]
pub fn select_local_file(title: Option<String>, default_path: Option<String>) -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    {
        let prompt = apple_script_string(title.as_deref().unwrap_or("选择文件"));
        let default_location = default_path
            .as_deref()
            .and_then(resolve_dialog_default_dir)
            .as_deref()
            .map(apple_script_string);

        let script = if let Some(default_location) = default_location {
            format!(
                "set chosenFile to choose file with prompt \"{}\" default location POSIX file \"{}\"\nPOSIX path of chosenFile",
                prompt, default_location
            )
        } else {
            format!(
                "set chosenFile to choose file with prompt \"{}\"\nPOSIX path of chosenFile",
                prompt
            )
        };

        return run_macos_dialog(&script);
    }

    #[cfg(target_os = "windows")]
    {
        let title = powershell_string(title.as_deref().unwrap_or("选择文件"));
        let initial_dir = default_path
            .as_deref()
            .and_then(resolve_dialog_default_dir)
            .map(powershell_string)
            .unwrap_or_default();
        let script = format!(
            "Add-Type -AssemblyName System.Windows.Forms; \
            $dialog = New-Object System.Windows.Forms.OpenFileDialog; \
            $dialog.Title = '{title}'; \
            if ('{initial_dir}' -ne '') {{ $dialog.InitialDirectory = '{initial_dir}'; }} \
            if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{ Write-Output $dialog.FileName }}"
        );
        return run_windows_dialog(&script);
    }

    #[cfg(target_os = "linux")]
    {
        return run_linux_open_dialog(title.as_deref().unwrap_or("选择文件"), default_path);
    }
}

#[tauri::command]
pub fn select_download_location(file_name: String) -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    {
        let default_name = apple_script_string(&file_name);
        let script = format!(
            "set chosenFile to choose file name with prompt \"选择保存位置\" default name \"{}\"\nPOSIX path of chosenFile",
            default_name
        );
        return run_macos_dialog(&script);
    }

    #[cfg(target_os = "windows")]
    {
        let file_name = powershell_string(&file_name);
        let script = format!(
            "Add-Type -AssemblyName System.Windows.Forms; \
            $dialog = New-Object System.Windows.Forms.SaveFileDialog; \
            $dialog.Title = '选择保存位置'; \
            $dialog.FileName = '{file_name}'; \
            if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{ Write-Output $dialog.FileName }}"
        );
        return run_windows_dialog(&script);
    }

    #[cfg(target_os = "linux")]
    {
        return run_linux_save_dialog(&file_name);
    }
}

fn resolve_dialog_default_dir(path: &str) -> Option<String> {
    let path = PathBuf::from(path);
    if path.is_dir() {
        return Some(path.to_string_lossy().to_string());
    }

    path.parent().map(|parent| parent.to_string_lossy().to_string())
}

fn normalize_identity_path(value: &str, home_dir: &str) -> String {
    if let Some(rest) = value.strip_prefix("~/") {
        return format!("{home_dir}/{rest}");
    }

    value.to_string()
}

fn parse_local_forward(value: &str) -> Option<ParsedSshConfigPortForward> {
    let parts = value.split_whitespace().collect::<Vec<_>>();
    if parts.len() < 2 {
        return None;
    }

    let local_port = parts[0].split(':').next_back()?.parse::<u16>().ok()?;
    let mut remote_segments = parts[1].split(':').collect::<Vec<_>>();
    if remote_segments.len() < 2 {
        return None;
    }

    let remote_port = remote_segments.pop()?.parse::<u16>().ok()?;
    let remote_host = remote_segments.join(":");
    if remote_host.is_empty() {
        return None;
    }

    Some(ParsedSshConfigPortForward {
        id: format!("forward-{local_port}-{remote_host}-{remote_port}"),
        r#type: "local".to_string(),
        local_port,
        remote_host,
        remote_port,
        label: None,
    })
}

fn parse_ssh_config_content(home_dir: &str, content: &str) -> Vec<ParsedSshConfigHost> {
    #[derive(Default, Clone)]
    struct PendingHost {
        host: Option<String>,
        port: Option<u16>,
        username: Option<String>,
        private_key: Option<String>,
        proxy_jump_alias: Option<String>,
        port_forwards: Vec<ParsedSshConfigPortForward>,
    }

    let mut entries = Vec::new();
    let mut aliases = Vec::<String>::new();
    let mut current = PendingHost::default();

    let flush = |entries: &mut Vec<ParsedSshConfigHost>, aliases: &mut Vec<String>, current: &PendingHost| {
        if aliases.is_empty() {
            return;
        }

        aliases.iter().for_each(|alias| {
            if alias.contains('*') || alias.contains('?') || alias.contains('!') {
                return;
            }

            entries.push(ParsedSshConfigHost {
                alias: alias.clone(),
                name: alias.clone(),
                host: current.host.clone().unwrap_or_else(|| alias.clone()),
                port: current.port.unwrap_or(22),
                username: current.username.clone().unwrap_or_default(),
                private_key: current.private_key.clone(),
                proxy_jump_alias: current.proxy_jump_alias.clone(),
                port_forwards: current.port_forwards.clone(),
            });
        });
    };

    for raw_line in content.lines() {
        let line = raw_line
            .split('#')
            .next()
            .unwrap_or("")
            .trim();
        if line.is_empty() {
            continue;
        }

        let mut parts = line.split_whitespace();
        let Some(key) = parts.next() else {
            continue;
        };
        let value = parts.collect::<Vec<_>>().join(" ");
        if value.is_empty() {
            continue;
        }

        match key.to_ascii_lowercase().as_str() {
            "host" => {
                flush(&mut entries, &mut aliases, &current);
                aliases = value
                    .split_whitespace()
                    .map(|item| item.to_string())
                    .collect::<Vec<_>>();
                current = PendingHost::default();
            }
            "hostname" if !aliases.is_empty() => current.host = Some(value),
            "user" if !aliases.is_empty() => current.username = Some(value),
            "port" if !aliases.is_empty() => current.port = value.parse::<u16>().ok(),
            "identityfile" if !aliases.is_empty() => {
                current.private_key = Some(normalize_identity_path(&value, home_dir))
            }
            "proxyjump" if !aliases.is_empty() => {
                current.proxy_jump_alias = value.split(',').next().map(|item| item.trim().to_string())
            }
            "localforward" if !aliases.is_empty() => {
                if let Some(forward) = parse_local_forward(&value) {
                    current.port_forwards.push(forward);
                }
            }
            _ => {}
        }
    }

    flush(&mut entries, &mut aliases, &current);
    entries
}

#[cfg(target_os = "macos")]
fn apple_script_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

#[cfg(target_os = "macos")]
fn run_macos_dialog(script: &str) -> Result<Option<String>, String> {
    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| format!("调用 macOS 文件对话框失败: {}", e))?;

    if output.status.success() {
        let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return if value.is_empty() { Ok(None) } else { Ok(Some(value)) };
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    if stderr.contains("User canceled") {
        return Ok(None);
    }

    Err(format!("macOS 文件对话框返回错误: {}", stderr.trim()))
}

#[cfg(target_os = "windows")]
fn powershell_string(value: &str) -> String {
    value.replace('\'', "''")
}

#[cfg(target_os = "windows")]
fn run_windows_dialog(script: &str) -> Result<Option<String>, String> {
    let output = Command::new("powershell")
        .args(["-NoProfile", "-Command", script])
        .output()
        .map_err(|e| format!("调用 Windows 文件对话框失败: {}", e))?;

    if output.status.success() {
        let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return if value.is_empty() { Ok(None) } else { Ok(Some(value)) };
    }

    Err(format!(
        "Windows 文件对话框返回错误: {}",
        String::from_utf8_lossy(&output.stderr).trim()
    ))
}

#[cfg(target_os = "linux")]
fn run_linux_open_dialog(title: &str, default_path: Option<String>) -> Result<Option<String>, String> {
    if let Ok(output) = Command::new("zenity")
        .args(["--file-selection", "--title", title])
        .output()
    {
        return parse_linux_dialog_output(output);
    }

    if let Ok(output) = Command::new("kdialog")
        .args([
            "--getopenfilename",
            default_path.as_deref().unwrap_or(""),
            "",
            "--title",
            title,
        ])
        .output()
    {
        return parse_linux_dialog_output(output);
    }

    Err("当前 Linux 环境缺少 zenity/kdialog，无法打开文件选择器".to_string())
}

#[cfg(target_os = "linux")]
fn run_linux_save_dialog(file_name: &str) -> Result<Option<String>, String> {
    let default_path = dirs::download_dir()
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
        .join(file_name);
    let default_path = default_path.to_string_lossy().to_string();

    if let Ok(output) = Command::new("zenity")
        .args([
            "--file-selection",
            "--save",
            "--confirm-overwrite",
            "--filename",
            &default_path,
            "--title",
            "选择保存位置",
        ])
        .output()
    {
        return parse_linux_dialog_output(output);
    }

    if let Ok(output) = Command::new("kdialog")
        .args([
            "--getsavefilename",
            &default_path,
            "",
            "--title",
            "选择保存位置",
        ])
        .output()
    {
        return parse_linux_dialog_output(output);
    }

    Err("当前 Linux 环境缺少 zenity/kdialog，无法打开保存对话框".to_string())
}

#[cfg(target_os = "linux")]
fn parse_linux_dialog_output(output: std::process::Output) -> Result<Option<String>, String> {
    if output.status.success() {
        let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return if value.is_empty() { Ok(None) } else { Ok(Some(value)) };
    }

    if output.status.code() == Some(1) {
        return Ok(None);
    }

    Err(format!(
        "Linux 文件对话框返回错误: {}",
        String::from_utf8_lossy(&output.stderr).trim()
    ))
}

#[cfg(test)]
mod tests {
    use super::{parse_ssh_config_content, resolve_dialog_default_dir};
    use std::path::PathBuf;

    #[test]
    fn parse_ssh_config_extracts_basic_hosts_and_proxyjump() {
        let content = r#"
Host bastion
  HostName bastion.example.com
  User jump
  Port 2222
  IdentityFile ~/.ssh/jump_id

Host app-prod
  HostName 10.0.10.15
  User deploy
  ProxyJump bastion
  LocalForward 15432 127.0.0.1:5432
"#;

        let parsed = parse_ssh_config_content("/Users/tester", content);
        assert_eq!(parsed.len(), 2);

        assert_eq!(parsed[0].alias, "bastion");
        assert_eq!(parsed[0].host, "bastion.example.com");
        assert_eq!(parsed[0].port, 2222);
        assert_eq!(parsed[0].username, "jump");
        assert_eq!(parsed[0].private_key.as_deref(), Some("/Users/tester/.ssh/jump_id"));

        assert_eq!(parsed[1].alias, "app-prod");
        assert_eq!(parsed[1].host, "10.0.10.15");
        assert_eq!(parsed[1].proxy_jump_alias.as_deref(), Some("bastion"));
        assert_eq!(parsed[1].port_forwards.len(), 1);
        assert_eq!(parsed[1].port_forwards[0].local_port, 15432);
        assert_eq!(parsed[1].port_forwards[0].remote_host, "127.0.0.1");
        assert_eq!(parsed[1].port_forwards[0].remote_port, 5432);
    }

    #[test]
    fn resolve_dialog_default_dir_returns_parent_for_file_path() {
        let path = PathBuf::from("/tmp/example/file.txt");
        let resolved = resolve_dialog_default_dir(&path.to_string_lossy());
        assert_eq!(resolved.as_deref(), Some("/tmp/example"));
    }
}
