use crate::connection_manager;
use tauri::command;

#[command]
pub async fn execute_ssh_command(connection_id: String, command: String) -> Result<String, String> {
    connection_manager::execute_command(connection_id, command).await
}

#[command]
pub async fn disconnect_ssh_connection(connection_id: String) -> Result<(), String> {
    connection_manager::disconnect_connection(connection_id).await
}
