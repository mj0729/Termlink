[Root](../CLAUDE.md) > **src-tauri (Backend)**

# Backend Module -- Rust (Tauri 2.x)

## Module Responsibility

The `src-tauri/` directory contains the Rust backend of Termlink. It provides all system-level functionality: local terminal (PTY) management, SSH terminal sessions, SFTP file transfers, SSH profile/credential storage, remote system monitoring, download helpers, and local filesystem browsing. All functions are exposed to the frontend as Tauri commands.

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
| `preview_ssh_host_key` | `ssh_terminal_russh::preview_ssh_host_key` | Preview host key trust state before retry |
| `save_ssh_host_key_decision` | `ssh_terminal_russh::save_ssh_host_key_decision` | Persist trusted host key decision |

### SSH Profile Management
| Command | Function | Description |
|---------|----------|-------------|
| `save_ssh_profile` | `ssh::save_ssh_profile` | Save SSH profile to JSON file + password to encrypted local credential store |
| `list_ssh_profiles` | `ssh::list_ssh_profiles` | List all saved SSH profiles |
| `get_ssh_password` | `ssh::get_ssh_password` | Retrieve password from encrypted local credential store (with legacy keyring migration) |
| `delete_ssh_profile` | `ssh::delete_ssh_profile` | Delete profile file and stored credential |
| `restart_ssh_connection` | `ssh::restart_ssh_connection` | Cleanup for SSH reconnection |
| `get_profiles_dir` | `ssh::get_profiles_dir` | Get profiles directory path |

### SFTP Operations
| Command | Function | Description |
|---------|----------|-------------|
| `list_sftp_files` | `sftp_russh::list_sftp_files` | List remote directory contents |
| `download_sftp_file` | `sftp_russh::download_sftp_file` | Download remote file or directory with real-time progress |
| `upload_sftp_file` | `sftp_russh::upload_sftp_file` | Upload local file to remote |
| `upload_sftp_content` | `sftp_russh::upload_sftp_content` | Upload in-memory file content to remote |
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
| `execute_ssh_command` | `ssh_command::execute_ssh_command` | Execute command on remote via shared connection actor |
| `disconnect_ssh_connection` | `ssh_command::disconnect_ssh_connection` | Close the shared SSH transport and all attached channels |

### Download & Filesystem
| Command | Function | Description |
|---------|----------|-------------|
| `select_download_location` | `download_manager::select_download_location` | Get default download path |
| `select_local_directory` | `fs::select_local_directory` | Select a local directory for batch or folder downloads |
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
| `lib.rs` | ~76 | Module declarations, Tauri builder setup, command registration |
| `main.rs` | ~6 | Binary entry point |
| `terminal.rs` | ~134 | Local PTY via `portable-pty`. Global `PTY_SENDERS` HashMap for session management. |
| `connection_manager.rs` | ~390 | Shared SSH connection actor. Owns transport, terminal channel, lazy SFTP session, and remote command execution. |
| `ssh_terminal_russh.rs` | ~40 | Thin Tauri command adapter for SSH terminal + host-key flow. |
| `ssh.rs` | ~104 | SSH profile CRUD. Stores profiles as JSON in `ProjectDirs` config dir. Passwords stored via encrypted local credential store with keyring migration fallback. |
| `ssh_auth.rs` | ~300 | SSH authentication and strict host-key verification. Supports password, private key, ProxyJump, and passphrase-aware private key loading. |
| `host_key_store.rs` | ~120 | Local host-key persistence for trusted fingerprints. |
| `sftp_russh.rs` | ~360 | Full SFTP implementation via `russh-sftp`. Reuses `ConnectionManager` actor sessions. |
| `ssh_command.rs` | ~10 | Thin Tauri command adapter for shared remote command execution + disconnect. |
| `system_monitor.rs` | ~572 | Remote system monitoring. Executes batch shell commands to gather CPU, memory, disk, network, process info. Parses `/proc/` output. Network speed calculation with caching. |
| `download_manager.rs` | ~129 | Download helpers: local path conflict resolution, placeholder APIs, cross-platform file manager opening. |
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
| `keyring` | 2 | Legacy credential migration fallback |
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
SshProfileMeta { id, host, port, username, save_password, private_key?, private_key_passphrase?, proxy_jump_*, name?, group?, tags }
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
- `CONNECTION_MANAGERS: Lazy<Mutex<HashMap<String, UnboundedSender<ConnectionCmd>>>>` -- shared SSH connection actors
- `NETWORK_CACHE: Arc<Mutex<HashMap<String, NetworkSpeedCache>>>` -- network speed calculation cache

## Testing & Quality

Basic unit tests exist for SSH auth serialization, SSH config parsing, host key serialization, and selected SFTP helpers.

Recommended additions:
- Unit tests for parsing functions in `system_monitor.rs` (CPU, memory, disk, network, process parsing)
- Unit tests for `ssh.rs` / `connection_store.rs` profile serialization-deserialization
- Integration tests for `fs.rs` local filesystem operations

## Known TODOs

1. `ssh.rs`: `restart_ssh_connection()` only cleans up, reconnection handled in frontend
2. `download_manager.rs`: `download_sftp_file_with_progress()` is a placeholder with simulated delay and is not the main transfer path
3. Auto reconnect is currently frontend-managed with limited retry scheduling, not a backend session keepalive

## FAQ

**Q: How are terminal, SFTP, and monitoring connections related now?**
A: A single `connection_id` maps to one `ConnectionManager` actor. Terminal I/O, lazy SFTP session creation, and monitoring commands all reuse the same SSH transport instead of opening three independent pools.

**Q: How does system monitoring work without a local agent?**
A: The system monitor executes batch shell commands (`cat /proc/stat`, `df -h`, etc.) over SSH and parses the text output. In practice this currently targets Linux hosts.

**Q: Where are SSH profiles stored?**
A: Connection metadata is stored in the app storage directory as JSON. Passwords are stored separately in the encrypted local credential store; legacy keyring entries are migrated on read.

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
    connection_manager.rs         -- Shared SSH connection actor
    terminal.rs                    -- Local PTY management
    ssh_terminal_russh.rs          -- SSH terminal sessions
    ssh_auth.rs                    -- SSH auth + host-key verification
    host_key_store.rs              -- Trusted host-key storage
    ssh.rs                         -- SSH profile CRUD + encrypted credential integration
    sftp_russh.rs                  -- SFTP file operations
    ssh_command.rs                 -- Shared SSH command adapter
    system_monitor.rs              -- Remote system monitoring
    download_manager.rs            -- Download helper functions
    fs.rs                          -- Local filesystem operations
```

## Changelog

- **2026-03-18T08:46:36**: Initial documentation generated from project scan.
