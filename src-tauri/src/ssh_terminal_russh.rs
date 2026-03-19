use crate::connection_manager;
use crate::ssh_auth::{self, HostKeyDecision, HostKeyVerification, SshAuthRequest};

#[tauri::command]
pub async fn preview_ssh_host_key(
    app: tauri::AppHandle,
    request: SshAuthRequest,
) -> Result<HostKeyVerification, String> {
    ssh_auth::preview_host_key(app, request).await
}

#[tauri::command]
pub fn save_ssh_host_key_decision(
    app: tauri::AppHandle,
    decision: HostKeyDecision,
) -> Result<(), String> {
    ssh_auth::save_host_key_decision(app, decision)
}

#[tauri::command]
pub async fn start_ssh_terminal(
    window: tauri::Window,
    auth: SshAuthRequest,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    connection_manager::start_connection(window, auth, cols, rows).await
}

#[tauri::command]
pub fn write_ssh_terminal(id: String, data: String) -> Result<(), String> {
    connection_manager::write_terminal(id, data)
}

#[tauri::command]
pub fn resize_ssh_terminal(id: String, cols: u16, rows: u16) -> Result<(), String> {
    connection_manager::resize_terminal(id, cols, rows)
}

#[tauri::command]
pub async fn read_ssh_terminal_snapshot(
    id: String,
    from_seq: u64,
) -> Result<connection_manager::TerminalSnapshot, String> {
    connection_manager::read_terminal_snapshot(id, from_seq).await
}
