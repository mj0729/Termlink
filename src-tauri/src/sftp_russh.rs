use crate::{connection_manager, download_manager};
use russh_sftp::client::SftpSession;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use tauri::Emitter;
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt};

const UPLOAD_CHUNK_SIZE: usize = 64 * 1024;

#[derive(Clone, Copy)]
enum TextEncoding {
    Utf8,
    Utf16Le,
    Utf16Be,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpTextChunk {
    pub content: String,
    pub next_offset: u64,
    pub total_bytes: u64,
    pub has_more: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpDetailedEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<u64>,
    pub permissions: String,
    pub owner_user: Option<String>,
    pub owner_group: Option<String>,
    pub numeric_permissions: Option<String>,
    pub is_symlink: bool,
    pub symlink_target: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpDiskUsageInfo {
    pub total: String,
    pub used: String,
    pub available: String,
    pub mount_point: String,
}

#[derive(Debug)]
struct ParsedStatRecord {
    numeric_permissions: String,
    owner_user: Option<String>,
    owner_group: Option<String>,
    is_symlink: bool,
    symlink_target: Option<String>,
}

fn decode_utf16_bytes(bytes: &[u8], little_endian: bool) -> Result<String, String> {
    if !bytes.len().is_multiple_of(2) {
        return Err("UTF-16 文本长度不是偶数字节".to_string());
    }

    let units = bytes
        .chunks_exact(2)
        .map(|chunk| {
            if little_endian {
                u16::from_le_bytes([chunk[0], chunk[1]])
            } else {
                u16::from_be_bytes([chunk[0], chunk[1]])
            }
        })
        .collect::<Vec<_>>();

    String::from_utf16(&units).map_err(|_| "UTF-16 文本解码失败".to_string())
}

fn detect_utf16_without_bom(bytes: &[u8]) -> Option<bool> {
    if bytes.len() < 4 || !bytes.len().is_multiple_of(2) {
        return None;
    }

    let sample_len = bytes.len().min(512);
    let sample_len = sample_len - (sample_len % 2);
    let sample = &bytes[..sample_len];
    let pair_count = sample.len() / 2;

    let even_zero_count = sample.chunks_exact(2).filter(|pair| pair[0] == 0).count();
    let odd_zero_count = sample.chunks_exact(2).filter(|pair| pair[1] == 0).count();

    if odd_zero_count * 10 >= pair_count * 7 && even_zero_count * 10 <= pair_count * 2 {
        return Some(true);
    }

    if even_zero_count * 10 >= pair_count * 7 && odd_zero_count * 10 <= pair_count * 2 {
        return Some(false);
    }

    None
}

fn detect_text_encoding(bytes: &[u8]) -> Result<(TextEncoding, usize), String> {
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        return Ok((TextEncoding::Utf8, 3));
    }

    if bytes.starts_with(&[0xFF, 0xFE]) {
        return Ok((TextEncoding::Utf16Le, 2));
    }

    if bytes.starts_with(&[0xFE, 0xFF]) {
        return Ok((TextEncoding::Utf16Be, 2));
    }

    if let Some(little_endian) = detect_utf16_without_bom(bytes) {
        return Ok((
            if little_endian {
                TextEncoding::Utf16Le
            } else {
                TextEncoding::Utf16Be
            },
            0,
        ));
    }

    match String::from_utf8(bytes.to_vec()) {
        Ok(content) if !content.contains('\0') => Ok((TextEncoding::Utf8, 0)),
        Ok(_) => Err("文件包含不可显示的空字节，可能不是纯文本文件".to_string()),
        Err(_) => Err("文件内容不是有效的 UTF-8 或 UTF-16 文本".to_string()),
    }
}

fn decode_utf8_chunk(bytes: &[u8]) -> Result<(String, usize), String> {
    if bytes.is_empty() {
        return Ok((String::new(), 0));
    }

    for leading_trim in 0..bytes.len().min(4) {
        let candidate = &bytes[leading_trim..];
        match std::str::from_utf8(candidate) {
            Ok(content) => return Ok((content.to_string(), leading_trim + candidate.len())),
            Err(error) => {
                let valid_up_to = error.valid_up_to();

                if valid_up_to > 0 && error.error_len().is_none() {
                    let content = std::str::from_utf8(&candidate[..valid_up_to])
                        .map_err(|_| "UTF-8 分段解码失败".to_string())?;
                    return Ok((content.to_string(), leading_trim + valid_up_to));
                }

                if valid_up_to == 0 && leading_trim < 3 {
                    continue;
                }

                return Err("文件内容不是有效的 UTF-8 文本".to_string());
            }
        }
    }

    Err("UTF-8 分段解码失败".to_string())
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn validate_mode(mode: &str) -> Result<(), String> {
    let valid =
        (mode.len() == 3 || mode.len() == 4) && mode.chars().all(|c| matches!(c, '0'..='7'));

    if valid {
        Ok(())
    } else {
        Err("权限模式格式无效，仅支持 3-4 位八进制数字".to_string())
    }
}

fn validate_owner_segment(value: &str, field_name: &str) -> Result<(), String> {
    if value.is_empty() {
        return Err(format!("{}不能为空", field_name));
    }

    if value
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.'))
    {
        Ok(())
    } else {
        Err(format!(
            "{}格式无效，仅支持字母、数字、点、下划线和横线",
            field_name
        ))
    }
}

async fn run_remote_command(
    connection_id: &str,
    action: &str,
    command: String,
) -> Result<String, String> {
    connection_manager::execute_command(connection_id.to_string(), command)
        .await
        .map_err(|e| format!("{}失败: {}", action, e))
}

fn parse_symlink_target(raw_name: &str) -> Option<String> {
    raw_name
        .split_once(" -> ")
        .map(|(_, target)| target.trim().trim_matches('\'').to_string())
        .filter(|target| !target.is_empty())
}

fn parse_stat_record(line: &str) -> Result<ParsedStatRecord, String> {
    let parts = line.trim().split('\u{1f}').collect::<Vec<_>>();
    if parts.len() != 5 {
        return Err(format!("解析 stat 输出失败: {}", line));
    }

    let numeric_permissions = parts[0].trim();
    if !((numeric_permissions.len() == 3 || numeric_permissions.len() == 4)
        && numeric_permissions.chars().all(|c| matches!(c, '0'..='7')))
    {
        return Err(format!("解析权限信息失败: {}", line));
    }

    let normalized_permissions = if numeric_permissions.len() == 3 {
        format!("0{}", numeric_permissions)
    } else {
        numeric_permissions.to_string()
    };

    let file_type = parts[3].trim();
    let raw_name = parts[4].trim();

    Ok(ParsedStatRecord {
        numeric_permissions: normalized_permissions,
        owner_user: Some(parts[1].trim().to_string()).filter(|v| !v.is_empty()),
        owner_group: Some(parts[2].trim().to_string()).filter(|v| !v.is_empty()),
        is_symlink: file_type == "symbolic link" || raw_name.contains(" -> "),
        symlink_target: parse_symlink_target(raw_name),
    })
}

fn permissions_from_octal(octal: &str) -> String {
    let digits = octal.trim();
    let digits = if digits.len() >= 3 {
        &digits[digits.len() - 3..]
    } else {
        "000"
    };

    digits
        .chars()
        .flat_map(|digit| {
            let value = digit.to_digit(8).unwrap_or(0);
            [
                if value & 4 != 0 { 'r' } else { '-' },
                if value & 2 != 0 { 'w' } else { '-' },
                if value & 1 != 0 { 'x' } else { '-' },
            ]
        })
        .collect()
}

fn common_remote_parent(paths: &[String]) -> Result<String, String> {
    let first = paths
        .first()
        .ok_or_else(|| "创建压缩包失败: 未提供源路径".to_string())?;

    let mut common = split_remote_path(first)
        .0
        .split('/')
        .filter(|segment| !segment.is_empty())
        .map(|s| s.to_string())
        .collect::<Vec<_>>();

    for path in paths.iter().skip(1) {
        let current = split_remote_path(path)
            .0
            .split('/')
            .filter(|segment| !segment.is_empty())
            .map(|s| s.to_string())
            .collect::<Vec<_>>();

        let mut shared_len = 0usize;
        while shared_len < common.len()
            && shared_len < current.len()
            && common[shared_len] == current[shared_len]
        {
            shared_len += 1;
        }
        common.truncate(shared_len);
    }

    if common.is_empty() {
        Ok("/".to_string())
    } else {
        Ok(format!("/{}", common.join("/")))
    }
}

fn relative_remote_path(parent: &str, path: &str) -> Result<String, String> {
    if parent == "/" {
        return path
            .strip_prefix('/')
            .map(|value| value.to_string())
            .ok_or_else(|| format!("计算相对路径失败: {}", path));
    }

    let prefix = format!("{}/", parent.trim_end_matches('/'));
    path.strip_prefix(&prefix)
        .map(|value| value.to_string())
        .ok_or_else(|| format!("计算相对路径失败: {}", path))
}

fn decode_utf16_chunk(bytes: &[u8], little_endian: bool) -> Result<(String, usize), String> {
    if bytes.is_empty() {
        return Ok((String::new(), 0));
    }

    let mut usable_len = bytes.len() - (bytes.len() % 2);
    if usable_len == 0 {
        return Ok((String::new(), 0));
    }

    let read_unit = |index: usize| -> u16 {
        let pair = [bytes[index], bytes[index + 1]];
        if little_endian {
            u16::from_le_bytes(pair)
        } else {
            u16::from_be_bytes(pair)
        }
    };

    let first_unit = read_unit(0);
    let mut leading_trim = 0usize;
    if (0xDC00..=0xDFFF).contains(&first_unit) {
        leading_trim = 2;
    }

    while usable_len >= leading_trim + 2 {
        let last_unit = read_unit(usable_len - 2);
        if (0xD800..=0xDBFF).contains(&last_unit) {
            usable_len -= 2;
            continue;
        }
        break;
    }

    if usable_len <= leading_trim {
        return Ok((String::new(), usable_len));
    }

    let slice = &bytes[leading_trim..usable_len];
    let content = decode_utf16_bytes(slice, little_endian)?;
    Ok((content, usable_len))
}

fn decode_chunk_with_encoding(
    bytes: &[u8],
    encoding: TextEncoding,
) -> Result<(String, usize), String> {
    match encoding {
        TextEncoding::Utf8 => decode_utf8_chunk(bytes),
        TextEncoding::Utf16Le => decode_utf16_chunk(bytes, true),
        TextEncoding::Utf16Be => decode_utf16_chunk(bytes, false),
    }
}

fn decode_remote_text(data: Vec<u8>) -> Result<String, String> {
    let (encoding, bom_len) = detect_text_encoding(&data)?;
    let bytes = &data[bom_len..];
    let (content, consumed) = decode_chunk_with_encoding(bytes, encoding)?;

    if consumed != bytes.len() {
        return Err("文件内容不是完整的纯文本数据".to_string());
    }

    if content.contains('\0') {
        Err("文件包含不可显示的空字节，可能不是纯文本文件".to_string())
    } else {
        Ok(content)
    }
}

async fn detect_remote_file_encoding(
    session: &SftpSession,
    path: &str,
) -> Result<(TextEncoding, usize), String> {
    let file = session
        .open(path)
        .await
        .map_err(|e| format!("打开远程文件失败: {}", e))?;
    let mut sample = Vec::new();
    file.take(1024)
        .read_to_end(&mut sample)
        .await
        .map_err(|e| format!("读取文件编码探测样本失败: {}", e))?;
    detect_text_encoding(&sample)
}

// SFTP 文件信息
#[derive(Debug, Serialize, Deserialize)]
pub struct SftpFileInfo {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<u64>,
    pub permissions: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UploadProgressPayload {
    upload_id: u32,
    uploaded: u64,
    total: u64,
    progress: u32,
}

fn normalize_local_path(path: &str) -> String {
    let mut normalized = path.trim().to_string();

    if let Some(stripped) = normalized.strip_prefix("file://") {
        normalized = stripped.to_string();
    }

    if cfg!(target_os = "windows") {
        let bytes = normalized.as_bytes();
        if bytes.len() >= 4
            && bytes[0] == b'/'
            && bytes[2] == b':'
            && bytes[3] == b'/'
            && bytes[1].is_ascii_alphabetic()
        {
            normalized = normalized[1..].to_string();
        }
    }

    normalized
}

fn join_remote_path(parent: &str, child: &str) -> String {
    if parent == "/" {
        format!("/{}", child)
    } else {
        format!("{}/{}", parent.trim_end_matches('/'), child)
    }
}

fn split_remote_path(path: &str) -> (String, String) {
    match path.rfind('/') {
        Some(0) => ("/".to_string(), path[1..].to_string()),
        Some(index) => (path[..index].to_string(), path[index + 1..].to_string()),
        None => ("".to_string(), path.to_string()),
    }
}

fn build_remote_conflict_name(file_name: &str, index: u32) -> String {
    let path = Path::new(file_name);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(file_name);
    let extension = path.extension().and_then(|value| value.to_str());

    if let Some(ext) = extension {
        format!("{stem} ({index}).{ext}")
    } else {
        format!("{stem} ({index})")
    }
}

async fn emit_upload_progress(
    app: &tauri::AppHandle,
    upload_id: Option<u32>,
    uploaded: u64,
    total: u64,
) -> Result<(), String> {
    let Some(upload_id) = upload_id else {
        return Ok(());
    };

    let progress = if total == 0 {
        100
    } else {
        ((uploaded as f64 / total as f64) * 100.0).round() as u32
    };

    app.emit(
        "upload-progress",
        UploadProgressPayload {
            upload_id,
            uploaded,
            total,
            progress,
        },
    )
    .map_err(|e| format!("发送上传进度事件失败: {}", e))
}

fn ensure_transfer_not_cancelled(transfer_id: Option<u32>) -> Result<(), String> {
    if let Some(transfer_id) = transfer_id {
        if download_manager::is_transfer_cancelled(transfer_id) {
            return Err("传输已取消".to_string());
        }
    }

    Ok(())
}

async fn ensure_remote_directory(session: &SftpSession, remote_path: &str) -> Result<(), String> {
    if session
        .try_exists(remote_path)
        .await
        .map_err(|e| format!("检查远程目录失败: {}", e))?
    {
        return Ok(());
    }

    session
        .create_dir(remote_path)
        .await
        .map_err(|e| format!("创建远程目录失败: {}", e))
}

async fn resolve_remote_target_path(
    session: &SftpSession,
    remote_path: &str,
) -> Result<String, String> {
    if !session
        .try_exists(remote_path)
        .await
        .map_err(|e| format!("检查远程路径失败: {}", e))?
    {
        return Ok(remote_path.to_string());
    }

    let (parent, file_name) = split_remote_path(remote_path);
    let mut index = 1u32;

    loop {
        let candidate_name = build_remote_conflict_name(&file_name, index);
        let candidate = if parent.is_empty() {
            candidate_name
        } else {
            join_remote_path(&parent, &candidate_name)
        };

        if !session
            .try_exists(&candidate)
            .await
            .map_err(|e| format!("检查远程路径失败: {}", e))?
        {
            return Ok(candidate);
        }

        index += 1;
    }
}

async fn write_remote_file(
    session: &SftpSession,
    remote_path: &str,
    data: &[u8],
    app: &tauri::AppHandle,
    upload_id: Option<u32>,
    uploaded: &mut u64,
    total: u64,
) -> Result<(), String> {
    ensure_transfer_not_cancelled(upload_id)?;
    let mut remote_file = session
        .create(remote_path)
        .await
        .map_err(|e| format!("创建远程文件失败: {}", e))?;

    if data.is_empty() {
        emit_upload_progress(app, upload_id, *uploaded, total).await?;
    } else {
        for chunk in data.chunks(UPLOAD_CHUNK_SIZE) {
            ensure_transfer_not_cancelled(upload_id)?;
            remote_file
                .write_all(chunk)
                .await
                .map_err(|e| format!("写入远程文件失败: {}", e))?;
            *uploaded += chunk.len() as u64;
            emit_upload_progress(app, upload_id, *uploaded, total).await?;
        }
    }

    remote_file
        .flush()
        .await
        .map_err(|e| format!("刷新远程文件失败: {}", e))
}

async fn calculate_local_total_size(local_path: &Path) -> Result<u64, String> {
    let mut total = 0u64;
    let mut stack = vec![local_path.to_path_buf()];

    while let Some(current_path) = stack.pop() {
        let metadata = fs::metadata(&current_path)
            .await
            .map_err(|e| format!("读取本地文件失败: {}", e))?;

        if metadata.is_dir() {
            let mut entries = fs::read_dir(&current_path)
                .await
                .map_err(|e| format!("读取本地目录失败: {}", e))?;

            while let Some(entry) = entries
                .next_entry()
                .await
                .map_err(|e| format!("读取本地目录项失败: {}", e))?
            {
                stack.push(entry.path());
            }

            continue;
        }

        total += metadata.len();
    }

    Ok(total)
}

async fn upload_local_entry(
    session: &SftpSession,
    local_path: &Path,
    remote_path: &str,
    app: &tauri::AppHandle,
    upload_id: Option<u32>,
    uploaded: &mut u64,
    total: u64,
) -> Result<(), String> {
    let mut stack = vec![(local_path.to_path_buf(), remote_path.to_string())];

    while let Some((current_local_path, current_remote_path)) = stack.pop() {
        ensure_transfer_not_cancelled(upload_id)?;
        let metadata = fs::metadata(&current_local_path)
            .await
            .map_err(|e| format!("读取本地文件失败: {}", e))?;

        if metadata.is_dir() {
            ensure_remote_directory(session, &current_remote_path).await?;

            let mut entries = fs::read_dir(&current_local_path)
                .await
                .map_err(|e| format!("读取本地目录失败: {}", e))?;

            let mut children = Vec::new();
            while let Some(entry) = entries
                .next_entry()
                .await
                .map_err(|e| format!("读取本地目录项失败: {}", e))?
            {
                let child_name = entry.file_name().to_string_lossy().to_string();
                children.push((
                    entry.path(),
                    join_remote_path(&current_remote_path, &child_name),
                ));
            }

            for child in children.into_iter().rev() {
                stack.push(child);
            }

            continue;
        }

        let data = fs::read(&current_local_path)
            .await
            .map_err(|e| format!("读取本地文件失败: {}", e))?;

        write_remote_file(
            session,
            &current_remote_path,
            &data,
            app,
            upload_id,
            uploaded,
            total,
        )
        .await?;
    }

    Ok(())
}

async fn delete_remote_directory_recursive(
    session: &SftpSession,
    root_path: &str,
) -> Result<(), String> {
    let mut stack = vec![(root_path.to_string(), false)];

    while let Some((current_path, visited)) = stack.pop() {
        if visited {
            session
                .remove_dir(&current_path)
                .await
                .map_err(|e| format!("删除目录失败: {}", e))?;
            continue;
        }

        stack.push((current_path.clone(), true));

        let entries = session
            .read_dir(&current_path)
            .await
            .map_err(|e| format!("读取目录失败: {}", e))?;

        for entry in entries {
            let name = entry.file_name().to_string();
            if name == "." || name == ".." {
                continue;
            }

            let child_path = join_remote_path(&current_path, &name);
            if entry.file_type().is_dir() {
                stack.push((child_path, false));
            } else {
                session
                    .remove_file(&child_path)
                    .await
                    .map_err(|e| format!("删除文件失败: {}", e))?;
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn list_sftp_files(
    connection_id: String,
    path: String,
) -> Result<Vec<SftpFileInfo>, String> {
    let session = get_sftp_session(&connection_id).await?;

    println!("列出目录: {}", path);

    match session.read_dir(&path).await {
        Ok(entries) => {
            let mut files = Vec::new();

            for entry in entries {
                let metadata = entry.metadata();
                let file_info = SftpFileInfo {
                    name: entry.file_name().to_string(),
                    is_dir: entry.file_type().is_dir(),
                    size: metadata.len(),
                    modified: metadata
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs()),
                    permissions: {
                        let perms = metadata.permissions();
                        // 构建完整的权限字符串，使用可用的字段
                        let mut perm_str = String::new();

                        // 用户权限 (如果字段不存在，显示为 "--x")
                        perm_str.push_str("---");

                        // 组权限 (使用group_字段)
                        perm_str.push(if perms.group_read { 'r' } else { '-' });
                        perm_str.push(if perms.group_write { 'w' } else { '-' });
                        perm_str.push(if perms.group_exec { 'x' } else { '-' });

                        // 其他权限 (使用other_字段)
                        perm_str.push(if perms.other_read { 'r' } else { '-' });
                        perm_str.push(if perms.other_write { 'w' } else { '-' });
                        perm_str.push(if perms.other_exec { 'x' } else { '-' });

                        perm_str
                    },
                };
                files.push(file_info);
            }

            // 按名称排序，目录在前
            files.sort_by(|a, b| match (a.is_dir, b.is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.cmp(&b.name),
            });

            Ok(files)
        }
        Err(e) => Err(format!("列出目录失败: {}", e)),
    }
}

#[tauri::command]
pub async fn resolve_sftp_target_path(
    connection_id: String,
    path: String,
) -> Result<String, String> {
    let session = get_sftp_session(&connection_id).await?;
    resolve_remote_target_path(&session, &path).await
}

#[tauri::command]
pub async fn sftp_list_detailed(
    connection_id: String,
    path: String,
) -> Result<Vec<SftpDetailedEntry>, String> {
    let session = get_sftp_session(&connection_id).await?;
    let entries = session
        .read_dir(&path)
        .await
        .map_err(|e| format!("列出目录失败: {}", e))?;

    let mut base_entries = Vec::new();
    for entry in entries {
        let metadata = entry.metadata();
        let name = entry.file_name().to_string();
        let full_path = join_remote_path(&path, &name);

        base_entries.push((
            name,
            full_path,
            entry.file_type().is_dir(),
            metadata.len(),
            metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs()),
        ));
    }

    let mut detailed_entries = Vec::with_capacity(base_entries.len());

    for chunk in base_entries.chunks(64) {
        let quoted_paths = chunk
            .iter()
            .map(|(_, full_path, _, _, _)| shell_quote(full_path))
            .collect::<Vec<_>>()
            .join(" ");

        let command = format!(
            "LC_ALL=C stat -c '%a\\x1f%U\\x1f%G\\x1f%F\\x1f%N' -- {}",
            quoted_paths
        );

        let stat_output =
            run_remote_command(&connection_id, "读取目录详细信息", command).await;

        match stat_output {
            Ok(output) => {
                let records = output
                    .lines()
                    .filter(|line| !line.trim().is_empty())
                    .map(parse_stat_record)
                    .collect::<Result<Vec<_>, _>>();

                match records {
                    Ok(records) if records.len() == chunk.len() => {
                        for ((name, full_path, is_dir, size, modified), record) in
                            chunk.iter().zip(records.into_iter())
                        {
                            detailed_entries.push(SftpDetailedEntry {
                                name: name.clone(),
                                path: full_path.clone(),
                                is_dir: *is_dir,
                                size: *size,
                                modified: *modified,
                                permissions: permissions_from_octal(
                                    &record.numeric_permissions,
                                ),
                                owner_user: record.owner_user,
                                owner_group: record.owner_group,
                                numeric_permissions: Some(record.numeric_permissions),
                                is_symlink: record.is_symlink,
                                symlink_target: record.symlink_target,
                            });
                        }
                    }
                    _ => {
                        for (name, full_path, is_dir, size, modified) in chunk {
                            detailed_entries.push(SftpDetailedEntry {
                                name: name.clone(),
                                path: full_path.clone(),
                                is_dir: *is_dir,
                                size: *size,
                                modified: *modified,
                                permissions: String::new(),
                                owner_user: None,
                                owner_group: None,
                                numeric_permissions: None,
                                is_symlink: false,
                                symlink_target: None,
                            });
                        }
                    }
                }
            }
            Err(_) => {
                for (name, full_path, is_dir, size, modified) in chunk {
                    detailed_entries.push(SftpDetailedEntry {
                        name: name.clone(),
                        path: full_path.clone(),
                        is_dir: *is_dir,
                        size: *size,
                        modified: *modified,
                        permissions: String::new(),
                        owner_user: None,
                        owner_group: None,
                        numeric_permissions: None,
                        is_symlink: false,
                        symlink_target: None,
                    });
                }
            }
        }
    }

    detailed_entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
    });

    Ok(detailed_entries)
}

#[tauri::command]
pub async fn sftp_stat(
    connection_id: String,
    path: String,
) -> Result<SftpDetailedEntry, String> {
    let session = get_sftp_session(&connection_id).await?;
    let metadata = session
        .metadata(&path)
        .await
        .map_err(|e| format!("获取文件元数据失败: {}", e))?;

    let output = run_remote_command(
        &connection_id,
        "获取文件详情",
        format!(
            "LC_ALL=C stat -c '%a\\x1f%U\\x1f%G\\x1f%F\\x1f%N' -- {}",
            shell_quote(&path)
        ),
    )
    .await?;

    let record = output
        .lines()
        .find(|line| !line.trim().is_empty())
        .ok_or_else(|| "获取文件详情失败: stat 输出为空".to_string())
        .and_then(parse_stat_record)?;

    Ok(SftpDetailedEntry {
        name: path.split('/').last().unwrap_or(&path).to_string(),
        path,
        is_dir: metadata.is_dir(),
        size: metadata.len(),
        modified: metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs()),
        permissions: permissions_from_octal(&record.numeric_permissions),
        owner_user: record.owner_user,
        owner_group: record.owner_group,
        numeric_permissions: Some(record.numeric_permissions),
        is_symlink: record.is_symlink,
        symlink_target: record.symlink_target,
    })
}

#[tauri::command]
pub async fn sftp_chmod(
    connection_id: String,
    path: String,
    mode: String,
) -> Result<(), String> {
    validate_mode(&mode)?;
    run_remote_command(
        &connection_id,
        "修改权限",
        format!("chmod {} -- {}", mode, shell_quote(&path)),
    )
    .await?;
    Ok(())
}

#[tauri::command]
pub async fn sftp_chown(
    connection_id: String,
    path: String,
    user: String,
    group: String,
) -> Result<(), String> {
    validate_owner_segment(&user, "用户")?;
    validate_owner_segment(&group, "用户组")?;
    run_remote_command(
        &connection_id,
        "修改所有者",
        format!("chown {}:{} -- {}", user, group, shell_quote(&path)),
    )
    .await?;
    Ok(())
}

#[tauri::command]
pub async fn sftp_archive(
    connection_id: String,
    paths: Vec<String>,
    archive_format: String,
    output_path: String,
) -> Result<(), String> {
    if paths.is_empty() {
        return Err("创建压缩包失败: 未提供源路径".to_string());
    }

    let parent = common_remote_parent(&paths)?;
    let work_dir = if parent.is_empty() { "." } else { &parent };
    let relative_paths = paths
        .iter()
        .map(|path| relative_remote_path(&parent, path))
        .collect::<Result<Vec<_>, _>>()?;
    let quoted_entries = relative_paths
        .iter()
        .map(|path| shell_quote(path))
        .collect::<Vec<_>>()
        .join(" ");

    let command = match archive_format.as_str() {
        "tar.gz" => format!(
            "cd {} && tar czf {} -- {}",
            shell_quote(work_dir),
            shell_quote(&output_path),
            quoted_entries
        ),
        "zip" => format!(
            "command -v zip >/dev/null 2>&1 || {{ echo 'zip 未安装' >&2; exit 127; }}; cd {} && zip -r {} {}",
            shell_quote(work_dir),
            shell_quote(&output_path),
            quoted_entries
        ),
        _ => return Err("创建压缩包失败: 仅支持 tar.gz 和 zip 格式".to_string()),
    };

    run_remote_command(&connection_id, "创建压缩包", command).await?;
    Ok(())
}

#[tauri::command]
pub async fn sftp_disk_usage(
    connection_id: String,
    path: String,
) -> Result<SftpDiskUsageInfo, String> {
    let quoted_path = shell_quote(&path);
    let primary = format!(
        "LC_ALL=C df -h --output=size,used,avail,target -- {} 2>/dev/null | tail -n 1",
        quoted_path
    );

    let output = match run_remote_command(&connection_id, "获取磁盘用量", primary).await {
        Ok(value) if !value.trim().is_empty() => value,
        _ => {
            run_remote_command(
                &connection_id,
                "获取磁盘用量",
                format!("LC_ALL=C df -h -- {} | tail -n 1", quoted_path),
            )
            .await?
        }
    };

    let parts = output.split_whitespace().collect::<Vec<_>>();
    if parts.len() >= 4 && parts.len() < 6 {
        return Ok(SftpDiskUsageInfo {
            total: parts[0].to_string(),
            used: parts[1].to_string(),
            available: parts[2].to_string(),
            mount_point: parts[3..].join(" "),
        });
    }

    if parts.len() >= 6 {
        return Ok(SftpDiskUsageInfo {
            total: parts[1].to_string(),
            used: parts[2].to_string(),
            available: parts[3].to_string(),
            mount_point: parts[5..].join(" "),
        });
    }

    Err(format!("解析磁盘用量失败: {}", output))
}

#[tauri::command]
pub async fn check_sftp_path_exists(connection_id: String, path: String) -> Result<bool, String> {
    let session = get_sftp_session(&connection_id).await?;
    session
        .try_exists(&path)
        .await
        .map_err(|e| format!("检查远程路径失败: {}", e))
}

#[tauri::command]
pub async fn download_sftp_file(
    app: tauri::AppHandle,
    connection_id: String,
    remote_path: String,
    local_path: String,
    download_id: u32,
) -> Result<(), String> {
    let session = get_sftp_session(&connection_id).await?;
    download_manager::reset_transfer_cancel(download_id);

    println!("下载文件(带进度): {} -> {}", remote_path, local_path);

    // 首先获取文件大小
    let metadata = match session.metadata(&remote_path).await {
        Ok(meta) => meta,
        Err(e) => return Err(format!("获取文件元数据失败: {}", e)),
    };

    let total_size = metadata.len();
    println!("文件总大小: {} 字节", total_size);

    // 发送初始进度
    let _ = app.emit(
        "download-progress",
        serde_json::json!({
            "downloadId": download_id,
            "downloaded": 0,
            "total": total_size,
            "progress": 0
        }),
    );

    // 打开远程文件进行读取
    let mut file = match session.open(&remote_path).await {
        Ok(f) => f,
        Err(e) => return Err(format!("打开远程文件失败: {}", e)),
    };

    // 创建本地文件
    let mut local_file = match tokio::fs::File::create(&local_path).await {
        Ok(f) => f,
        Err(e) => return Err(format!("创建本地文件失败: {}", e)),
    };

    // 分块读取和写入
    const CHUNK_SIZE: usize = 32768; // 32KB 每块
    let mut buffer = vec![0u8; CHUNK_SIZE];
    let mut downloaded: u64 = 0;
    let mut last_progress_percent = 0;

    loop {
        if download_manager::is_transfer_cancelled(download_id) {
            download_manager::reset_transfer_cancel(download_id);
            return Err("传输已取消".to_string());
        }

        // 使用 AsyncReadExt 的 read 方法读取一块数据
        use tokio::io::AsyncReadExt;
        let bytes_read = match file.read(&mut buffer).await {
            Ok(n) => n,
            Err(e) => return Err(format!("读取远程文件失败: {}", e)),
        };

        if bytes_read == 0 {
            break; // 文件读取完成
        }

        // 写入本地文件
        if let Err(e) = local_file.write_all(&buffer[..bytes_read]).await {
            return Err(format!("写入本地文件失败: {}", e));
        }

        downloaded += bytes_read as u64;

        // 计算进度百分比
        let progress = if total_size > 0 {
            ((downloaded as f64 / total_size as f64) * 100.0) as u32
        } else {
            0
        };

        // 只在进度变化时发送更新（避免过多事件）
        if progress != last_progress_percent || downloaded == total_size {
            last_progress_percent = progress;

            let _ = app.emit(
                "download-progress",
                serde_json::json!({
                    "downloadId": download_id,
                    "downloaded": downloaded,
                    "total": total_size,
                    "progress": progress
                }),
            );

            println!(
                "下载进度: {}/{} 字节 ({}%)",
                downloaded, total_size, progress
            );
        }
    }

    // 确保文件写入完成
    if let Err(e) = local_file.flush().await {
        return Err(format!("刷新文件缓冲失败: {}", e));
    }

    download_manager::reset_transfer_cancel(download_id);
    println!("文件下载成功: {}", local_path);
    Ok(())
}

#[tauri::command]
pub async fn upload_sftp_file(
    app: tauri::AppHandle,
    connection_id: String,
    local_path: String,
    remote_path: String,
    upload_id: Option<u32>,
) -> Result<(), String> {
    let session = get_sftp_session(&connection_id).await?;
    if let Some(upload_id) = upload_id {
        download_manager::reset_transfer_cancel(upload_id);
    }
    let local_path = normalize_local_path(&local_path);
    let local_path = Path::new(&local_path);
    let total = calculate_local_total_size(local_path).await?;
    let mut uploaded = 0u64;

    println!("上传路径: {} -> {}", local_path.display(), remote_path);

    emit_upload_progress(&app, upload_id, 0, total).await?;
    upload_local_entry(
        &session,
        local_path,
        &remote_path,
        &app,
        upload_id,
        &mut uploaded,
        total,
    )
    .await?;
    emit_upload_progress(&app, upload_id, total, total).await?;

    if let Some(upload_id) = upload_id {
        download_manager::reset_transfer_cancel(upload_id);
    }
    println!("文件上传成功");
    Ok(())
}

#[tauri::command]
pub async fn upload_sftp_content(
    app: tauri::AppHandle,
    connection_id: String,
    remote_path: String,
    data: Vec<u8>,
    upload_id: Option<u32>,
) -> Result<(), String> {
    let session = get_sftp_session(&connection_id).await?;
    if let Some(upload_id) = upload_id {
        download_manager::reset_transfer_cancel(upload_id);
    }
    let total = data.len() as u64;
    let mut uploaded = 0u64;

    println!("上传文件内容: {} ({} bytes)", remote_path, data.len());

    emit_upload_progress(&app, upload_id, 0, total).await?;
    write_remote_file(
        &session,
        &remote_path,
        &data,
        &app,
        upload_id,
        &mut uploaded,
        total,
    )
    .await?;
    emit_upload_progress(&app, upload_id, total, total).await?;

    if let Some(upload_id) = upload_id {
        download_manager::reset_transfer_cancel(upload_id);
    }
    println!("文件上传成功");
    Ok(())
}

#[tauri::command]
pub async fn read_sftp_file(connection_id: String, path: String) -> Result<String, String> {
    let session = get_sftp_session(&connection_id).await?;

    println!("读取文件: {}", path);

    match session.read(&path).await {
        Ok(data) => decode_remote_text(data),
        Err(e) => Err(format!("读取文件失败: {}", e)),
    }
}

#[tauri::command]
pub async fn read_sftp_file_chunk(
    connection_id: String,
    path: String,
    offset: u64,
    max_bytes: u64,
) -> Result<SftpTextChunk, String> {
    let session = get_sftp_session(&connection_id).await?;
    let metadata = session
        .metadata(&path)
        .await
        .map_err(|e| format!("获取文件元数据失败: {}", e))?;
    let total_bytes = metadata.len();

    if total_bytes == 0 || offset >= total_bytes {
        return Ok(SftpTextChunk {
            content: String::new(),
            next_offset: total_bytes,
            total_bytes,
            has_more: false,
        });
    }

    let (encoding, bom_len) = detect_remote_file_encoding(&session, &path).await?;
    let mut start_offset = offset;
    if start_offset < bom_len as u64 {
        start_offset = bom_len as u64;
    }

    if matches!(encoding, TextEncoding::Utf16Le | TextEncoding::Utf16Be)
        && (start_offset - bom_len as u64) % 2 != 0
    {
        start_offset -= 1;
    }

    let mut bytes_to_read = max_bytes
        .max(1)
        .min(total_bytes.saturating_sub(start_offset));
    if matches!(encoding, TextEncoding::Utf16Le | TextEncoding::Utf16Be) && bytes_to_read % 2 != 0 {
        bytes_to_read = bytes_to_read.saturating_sub(1);
    }
    if bytes_to_read == 0 {
        bytes_to_read = (total_bytes - start_offset).min(2);
    }

    let mut file = session
        .open(&path)
        .await
        .map_err(|e| format!("打开远程文件失败: {}", e))?;
    file.seek(std::io::SeekFrom::Start(start_offset))
        .await
        .map_err(|e| format!("定位远程文件失败: {}", e))?;

    let mut raw = Vec::with_capacity(bytes_to_read as usize);
    file.take(bytes_to_read)
        .read_to_end(&mut raw)
        .await
        .map_err(|e| format!("读取远程文件分段失败: {}", e))?;

    let (content, consumed) = decode_chunk_with_encoding(&raw, encoding)?;
    let next_offset = (start_offset + consumed as u64).min(total_bytes);

    Ok(SftpTextChunk {
        content,
        next_offset,
        total_bytes,
        has_more: next_offset < total_bytes,
    })
}

#[tauri::command]
pub async fn write_sftp_file(
    app: tauri::AppHandle,
    connection_id: String,
    path: String,
    content: String,
) -> Result<(), String> {
    let session = get_sftp_session(&connection_id).await?;
    let total = content.len() as u64;
    let mut uploaded = 0u64;

    println!("写入文件: {}", path);

    write_remote_file(
        &session,
        &path,
        content.as_bytes(),
        &app,
        None,
        &mut uploaded,
        total,
    )
    .await?;

    println!("文件写入成功");
    Ok(())
}

#[tauri::command]
pub async fn delete_sftp_file(connection_id: String, path: String) -> Result<(), String> {
    let session = get_sftp_session(&connection_id).await?;

    println!("删除文件: {}", path);

    match session.remove_file(&path).await {
        Ok(_) => {
            println!("文件删除成功");
            Ok(())
        }
        Err(e) => Err(format!("删除文件失败: {}", e)),
    }
}

#[tauri::command]
pub async fn create_sftp_directory(connection_id: String, path: String) -> Result<(), String> {
    let session = get_sftp_session(&connection_id).await?;

    println!("创建目录: {}", path);

    match session.create_dir(&path).await {
        Ok(_) => {
            println!("目录创建成功");
            Ok(())
        }
        Err(e) => Err(format!("创建目录失败: {}", e)),
    }
}

#[tauri::command]
pub async fn rename_sftp_file(
    connection_id: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    let session = get_sftp_session(&connection_id).await?;

    println!("重命名文件: {} -> {}", old_path, new_path);

    match session.rename(&old_path, &new_path).await {
        Ok(_) => {
            println!("文件重命名成功");
            Ok(())
        }
        Err(e) => Err(format!("重命名文件失败: {}", e)),
    }
}

#[tauri::command]
pub async fn delete_sftp_directory(connection_id: String, path: String) -> Result<(), String> {
    let session = get_sftp_session(&connection_id).await?;

    println!("删除目录: {}", path);

    delete_remote_directory_recursive(&session, &path).await?;

    println!("目录删除成功");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{decode_remote_text, decode_utf16_chunk, decode_utf8_chunk};

    #[test]
    fn decodes_utf8_text() {
        let content = decode_remote_text("hello\nworld".as_bytes().to_vec()).unwrap();
        assert_eq!(content, "hello\nworld");
    }

    #[test]
    fn decodes_utf16le_with_bom() {
        let mut bytes = vec![0xFF, 0xFE];
        for unit in "hello\nworld".encode_utf16() {
            bytes.extend_from_slice(&unit.to_le_bytes());
        }

        let content = decode_remote_text(bytes).unwrap();
        assert_eq!(content, "hello\nworld");
    }

    #[test]
    fn decodes_utf16le_without_bom() {
        let bytes = "nacos.config.log"
            .encode_utf16()
            .flat_map(|unit| unit.to_le_bytes())
            .collect::<Vec<_>>();

        let content = decode_remote_text(bytes).unwrap();
        assert_eq!(content, "nacos.config.log");
    }

    #[test]
    fn rejects_text_with_embedded_nul_bytes() {
        let error = decode_remote_text(b"abc\0def".to_vec()).unwrap_err();
        assert!(error.contains("空字节"));
    }

    #[test]
    fn decodes_utf8_chunk_without_cutting_trailing_multibyte_char() {
        let source = "日志🙂尾巴".as_bytes();
        let (content, consumed) = decode_utf8_chunk(&source[..8]).unwrap();
        assert_eq!(content, "日志");
        assert_eq!(consumed, "日志".as_bytes().len());
    }

    #[test]
    fn decodes_utf16_chunk_without_cutting_surrogate_pair() {
        let bytes = "日志🙂尾巴"
            .encode_utf16()
            .flat_map(|unit| unit.to_le_bytes())
            .collect::<Vec<_>>();
        let (content, consumed) = decode_utf16_chunk(&bytes[..6], true).unwrap();
        assert_eq!(content, "日志");
        assert_eq!(consumed, "日志".encode_utf16().count() * 2);
    }
}

#[tauri::command]
pub async fn get_sftp_file_metadata(
    connection_id: String,
    path: String,
) -> Result<SftpFileInfo, String> {
    let session = get_sftp_session(&connection_id).await?;

    println!("获取文件元数据: {}", path);

    match session.metadata(&path).await {
        Ok(metadata) => {
            // 从路径中提取文件名
            let name = path.split('/').last().unwrap_or(&path).to_string();

            let file_info = SftpFileInfo {
                name,
                is_dir: metadata.is_dir(),
                size: metadata.len(),
                modified: metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs()),
                permissions: {
                    let perms = metadata.permissions();
                    let mut perm_str = String::new();
                    perm_str.push_str("---");
                    perm_str.push(if perms.group_read { 'r' } else { '-' });
                    perm_str.push(if perms.group_write { 'w' } else { '-' });
                    perm_str.push(if perms.group_exec { 'x' } else { '-' });
                    perm_str.push(if perms.other_read { 'r' } else { '-' });
                    perm_str.push(if perms.other_write { 'w' } else { '-' });
                    perm_str.push(if perms.other_exec { 'x' } else { '-' });
                    perm_str
                },
            };
            Ok(file_info)
        }
        Err(e) => Err(format!("获取文件元数据失败: {}", e)),
    }
}

async fn get_sftp_session(connection_id: &str) -> Result<Arc<SftpSession>, String> {
    connection_manager::open_sftp(connection_id.to_string()).await
}
