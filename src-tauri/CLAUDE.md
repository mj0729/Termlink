[Root](../CLAUDE.md) > **src-tauri (Backend)**

# Backend Module -- Rust (Tauri 2.x)

## Module Responsibility

The `src-tauri/` directory contains the Rust backend of Termlink. It provides all system-level functionality: local terminal (PTY) management, SSH terminal sessions, SFTP file transfers, SSH profile/credential storage, remote system monitoring, download management, and local filesystem browsing. All functions are exposed to the frontend as Tauri commands.

## Entry & Startup

- **Binary entry**: `src/main.rs` -- calls `app_lib::run()` (suppresses Windows console in release builds)
- **Library entry**: `src/lib.rs` -- configures `tauri::Builder`, registers all commands, sets up logging plugin
- **Build script**: `build.rs` -- standard `tauri_build::build()`

## Command Registry

All Tauri commands are registered in `src/lib.rs` via `invoke_handler`. The full API surface:

### Terminal (Local PTY)
| Command | Function | Description |
|---------|----------|-------------|
| `start_pty` | `terminal::start_pty` | Spawn a local PTY session (bash/cmd.exe) |
| `write_pty` | `terminal::write_pty` | Send user input to PTY |
| `resize_pty` | `terminal::resize_pty` | Resize PTY dimensions |
| `close_pty` | `terminal::close_pty` | Close and cleanup PTY |

### SSH Terminal
| Command | Function | Description |
|---------|----------|-------------|
| `start_ssh_terminal` | `ssh_terminal_russh::start_ssh_terminal` | Connect to SSH server and open interactive shell |
| `write_ssh_terminal` | `ssh_terminal_russh::write_ssh_terminal` | Send data to SSH terminal |
| `resize_ssh_terminal` | `ssh_terminal_russh::resize_ssh_terminal` | Resize SSH terminal window |
| `close_ssh_terminal` | `ssh_terminal_russh::close_ssh_terminal` | Close SSH terminal session |

### SSH Profile Management
| Command | Function | Description |
|---------|----------|-------------|
| `save_ssh_profile` | `ssh::save_ssh_profile` | Save SSH profile to JSON file + password to keyring |
| `list_ssh_profiles` | `ssh::list_ssh_profiles` | List all saved SSH profiles |
| `get_ssh_password` | `ssh::get_ssh_password` | Retrieve password from OS keyring |
| `delete_ssh_profile` | `ssh::delete_ssh_profile` | Delete profile file and keyring entry |
| `restart_ssh_connection` | `ssh::restart_ssh_connection` | Cleanup for SSH reconnection |
| `get_profiles_dir` | `ssh::get_profiles_dir` | Get profiles directory path |

### SFTP Operations
| Command | Function | Description |
|---------|----------|-------------|
| `connect_sftp` | `sftp_russh::connect_sftp` | Establish independent SFTP connection |
| `create_sftp_from_ssh` | `sftp_russh::create_sftp_from_ssh` | (TODO) Create SFTP from existing SSH session |
| `disconnect_sftp` | `sftp_russh::disconnect_sftp` | Close SFTP connection |
| `list_sftp_files` | `sftp_russh::list_sftp_files` | List remote directory contents |
| `download_sftp_file` | `sftp_russh::download_sftp_file` | Download file with real-time progress |
| `upload_sftp_file` | `sftp_russh::upload_sftp_file` | Upload local file to remote |
| `read_sftp_file` | `sftp_russh::read_sftp_file` | Read remote file as UTF-8 text |
| `write_sftp_file` | `sftp_russh::write_sftp_file` | Write content to remote file |
| `delete_sftp_file` | `sftp_russh::delete_sftp_file` | Delete remote file |
| `delete_sftp_directory` | `sftp_russh::delete_sftp_directory` | Delete remote directory |
| `create_sftp_directory` | `sftp_russh::create_sftp_directory` | Create remote directory |
| `rename_sftp_file` | `sftp_russh::rename_sftp_file` | Rename remote file/directory |
| `get_sftp_file_metadata` | `sftp_russh::get_sftp_file_metadata` | Get file metadata (size, permissions, modified time) |

### System Monitor
| Command | Function | Description |
|---------|----------|-------------|
| `get_all_system_info_batch` | `system_monitor::get_all_system_info_batch` | Full system info via single SSH command |
| `get_dynamic_system_info_batch` | `system_monitor::get_dynamic_system_info_batch` | Dynamic-only info (CPU, memory, disk, network, processes) |

### SSH Command Execution
| Command | Function | Description |
|---------|----------|-------------|
| `execute_ssh_command` | `ssh_command::execute_ssh_command` | Execute command on remote via dedicated connection pool |
| `connect_ssh_for_monitoring` | `ssh_command::connect_ssh_for_monitoring` | Establish/reuse SSH connection for monitoring |
| `disconnect_ssh_monitoring` | `ssh_command::disconnect_ssh_monitoring` | Close monitoring SSH connection |

### Download & Filesystem
| Command | Function | Description |
|---------|----------|-------------|
| `select_download_location` | `download_manager::select_download_location` | Get default download path |
| `get_sftp_file_info` | `download_manager::get_sftp_file_info` | Get file info for download |
| `download_sftp_file_with_progress` | `download_manager::download_sftp_file_with_progress` | (Placeholder) Download with progress callback |
| `cancel_download` | `download_manager::cancel_download` | Cancel ongoing download |
| `open_file_location` | `download_manager::open_file_location` | Open file in OS file manager |
| `list_files` | `fs::list_files` | List local directory files |
| `get_home_dir` | `fs::get_home_dir` | Get user home directory |
| `get_parent_dir` | `fs::get_parent_dir` | Get parent directory path |
| `open_file_explorer` | `fs::open_file_explorer` | Open path in OS file manager |

## Source Modules

| File | Lines | Responsibility |
|------|-------|----------------|
| `lib.rs` | ~83 | Module declarations, Tauri builder setup, command registration |
| `main.rs` | ~6 | Binary entry point |
| `terminal.rs` | ~134 | Local PTY via `portable-pty`. Global `PTY_SENDERS` HashMap for session management. |
| `ssh_terminal_russh.rs` | ~375 | SSH terminal via `russh`. Async session in dedicated thread with `tokio::Runtime`. Supports terminal I/O + command execution for monitoring. |
| `ssh.rs` | ~104 | SSH profile CRUD. Stores profiles as JSON in `ProjectDirs` config dir. Passwords stored via `keyring`. |
| `sftp_russh.rs` | ~547 | Full SFTP implementation via `russh-sftp`. Independent connection pool. 32KB chunk download with progress events. |
| `ssh_command.rs` | ~166 | Dedicated SSH connection pool for command execution. Used by system monitor. Separate from terminal sessions to avoid interference. |
| `system_monitor.rs` | ~572 | Remote system monitoring. Executes batch shell commands to gather CPU, memory, disk, network, process info. Parses `/proc/` output. Network speed calculation with caching. |
| `download_manager.rs` | ~129 | Download helpers: location selection, file info, cross-platform file manager opening. |
| `fs.rs` | ~142 | Local filesystem operations: directory listing, home dir, parent dir, file explorer launch. |
| `build.rs` | ~3 | Standard Tauri build script |

## Key Dependencies

| Crate | Version | Purpose |
|-------|---------|---------|
| `tauri` | 2.8.5 | Desktop application framework |
| `russh` | 0.40 | SSH protocol implementation |
| `russh-keys` | 0.40 | SSH key handling |
| `russh-sftp` | 2.0 | SFTP protocol over russh |
| `portable-pty` | 0.8 | Cross-platform PTY |
| `keyring` | 2 | OS credential storage |
| `tokio` | 1 (full) | Async runtime |
| `serde` / `serde_json` | 1.0 | Serialization |
| `parking_lot` | 0.12 | Synchronous mutexes |
| `crossbeam-channel` | 0.5 | Thread-safe channels for PTY/SSH message passing |
| `once_cell` | 1.20 | Lazy static initialization |
| `chrono` | 0.4 | Date/time formatting |
| `directories` / `dirs` | 5 | Platform-specific directories |
| `lazy_static` | 1.4 | Static variable initialization |

## Data Model

### Rust Structs

```
SshProfileMeta { id, host, port, username, save_password, private_key?, name?, group?, tags }
SftpFileInfo { name, is_dir, size, modified?, permissions }
FileItem { name, path, is_directory, size?, modified?, is_hidden }
BatchSystemInfo { system, cpu, memory, disk[], network[], process }
DynamicSystemInfo { cpu, memory, disk[], network[], process }
SystemInfo { hostname, os, arch, kernel, uptime, boot_time }
CpuInfo { model, usage, cores[] }
MemoryInfo { total, used, available, cached, usage }
DiskInfo { device, filesystem, total, used, mountpoint, usage }
NetworkInterface { name, status, ip?, rx_bytes, tx_bytes, rx_speed, tx_speed }
ProcessInfo { total, running, sleeping }
FileInfo { name, size, modified? }
```

### Global State

- `PTY_SENDERS: Lazy<Mutex<HashMap<String, Sender<PtyMsg>>>>` -- local terminal sessions
- `SSH_TERMINALS: Lazy<Mutex<HashMap<String, SshTerminal>>>` -- SSH terminal sessions
- `SFTP_CONNECTIONS: Lazy<Mutex<HashMap<String, SftpConnection>>>` -- SFTP sessions
- `SSH_SESSIONS: Arc<Mutex<HashMap<String, Arc<Mutex<Handle>>>>>` -- SSH command execution pool
- `NETWORK_CACHE: Arc<Mutex<HashMap<String, NetworkSpeedCache>>>` -- network speed calculation cache

## Testing & Quality

**No tests exist.** No `#[cfg(test)]` modules are present.

Recommended additions:
- Unit tests for parsing functions in `system_monitor.rs` (CPU, memory, disk, network, process parsing)
- Unit tests for `ssh.rs` profile serialization/deserialization
- Integration tests for `fs.rs` local filesystem operations

## Known TODOs

1. `sftp_russh.rs`: `create_sftp_from_ssh()` is unimplemented (returns error string)
2. `ssh_terminal_russh.rs`: `check_server_key()` accepts all keys (security risk)
3. `sftp_russh.rs`: `check_server_key()` accepts all keys (security risk)
4. `ssh.rs`: `restart_ssh_connection()` only cleans up, reconnection handled in frontend
5. `download_manager.rs`: `download_sftp_file_with_progress()` is a placeholder with simulated delay
6. Only password authentication is supported; private key auth returns error

## FAQ

**Q: Why are there multiple SSH connection pools?**
A: Three separate pools exist to avoid interference: (1) `SSH_TERMINALS` for interactive terminal sessions, (2) `SFTP_CONNECTIONS` for file transfer sessions, (3) `SSH_SESSIONS` for monitoring command execution. Each SSH terminal also creates a new `tokio::Runtime` in its own thread.

**Q: How does system monitoring work without a local agent?**
A: The system monitor executes batch shell commands (`cat /proc/stat`, `df -h`, etc.) over SSH and parses the text output. This means it only works on Linux targets.

**Q: Where are SSH profiles stored?**
A: JSON files in `ProjectDirs::from("com", "Termlink", "Termlink").config_dir()/profiles/`. Passwords are stored separately in the OS keyring via the `keyring` crate.

## Related Files

```
src-tauri/
  Cargo.toml                       -- Rust dependencies
  Cargo.lock                       -- Dependency lockfile
  tauri.conf.json                  -- Tauri configuration
  build.rs                         -- Build script
  capabilities/
    default.json                   -- Tauri capability permissions
  icons/                           -- Application icons (various sizes)
  src/
    main.rs                        -- Binary entry point
    lib.rs                         -- Library entry + command registry
    terminal.rs                    -- Local PTY management
    ssh_terminal_russh.rs          -- SSH terminal sessions
    ssh.rs                         -- SSH profile CRUD + keyring
    sftp_russh.rs                  -- SFTP file operations
    ssh_command.rs                 -- SSH command execution pool
    system_monitor.rs              -- Remote system monitoring
    download_manager.rs            -- Download helper functions
    fs.rs                          -- Local filesystem operations
```

## Changelog

- **2026-03-18T08:46:36**: Initial documentation generated from project scan.
