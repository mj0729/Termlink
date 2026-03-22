mod app_key;
mod connection_manager;
mod connection_store;
mod credential_store;
mod download_manager;
mod fs;
mod host_key_store;
mod import_export;
mod sftp_russh;
mod ssh;
mod ssh_auth;
mod ssh_command;
mod ssh_terminal_russh;
mod system_monitor;
mod terminal;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Terminal commands
            terminal::start_pty,
            terminal::write_pty,
            terminal::resize_pty,
            terminal::close_pty,
            // SSH Terminal commands
            ssh_terminal_russh::start_ssh_terminal,
            ssh_terminal_russh::write_ssh_terminal,
            ssh_terminal_russh::resize_ssh_terminal,
            ssh_terminal_russh::read_ssh_terminal_snapshot,
            ssh_terminal_russh::preview_ssh_host_key,
            ssh_terminal_russh::save_ssh_host_key_decision,
            // SSH profile commands
            ssh::save_ssh_profile,
            ssh::list_ssh_profiles,
            ssh::list_ssh_groups,
            ssh::create_ssh_group,
            ssh::rename_ssh_group,
            ssh::delete_ssh_group,
            ssh::get_ssh_password,
            ssh::restart_ssh_connection,
            ssh::delete_ssh_profile,
            ssh::get_profiles_dir,
            import_export::export_connections,
            import_export::save_export_package,
            import_export::import_connections_preview,
            import_export::import_connections,
            // Local filesystem commands
            fs::list_files,
            fs::get_home_dir,
            fs::get_parent_dir,
            fs::open_file_explorer,
            fs::read_default_ssh_config,
            fs::parse_default_ssh_config,
            fs::select_download_location,
            fs::select_local_file,
            // SFTP commands
            sftp_russh::list_sftp_files,
            sftp_russh::resolve_sftp_target_path,
            sftp_russh::check_sftp_path_exists,
            sftp_russh::download_sftp_file,
            sftp_russh::upload_sftp_file,
            sftp_russh::upload_sftp_content,
            sftp_russh::read_sftp_file,
            sftp_russh::read_sftp_file_chunk,
            sftp_russh::write_sftp_file,
            sftp_russh::delete_sftp_file,
            sftp_russh::delete_sftp_directory,
            sftp_russh::create_sftp_directory,
            sftp_russh::rename_sftp_file,
            sftp_russh::get_sftp_file_metadata,
            sftp_russh::sftp_list_detailed,
            sftp_russh::sftp_stat,
            sftp_russh::sftp_chmod,
            sftp_russh::sftp_chown,
            sftp_russh::sftp_archive,
            sftp_russh::sftp_disk_usage,
            // System monitor commands
            system_monitor::get_all_system_info_batch,
            system_monitor::get_dynamic_system_info_batch,
            // Download manager commands
            download_manager::resolve_local_target_path,
            download_manager::get_sftp_file_info,
            download_manager::download_sftp_file_with_progress,
            download_manager::cancel_download,
            download_manager::cancel_transfer,
            download_manager::open_file_location,
            // SSH command execution
            ssh_command::execute_ssh_command,
            ssh_command::disconnect_ssh_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
