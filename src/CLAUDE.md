[Root](../CLAUDE.md) > **src (Frontend)**

# Frontend Module -- Vue 3 + Vite

## Module Responsibility

The `src/` directory contains the entire frontend layer of Termlink. It renders the desktop application UI using Vue 3 Composition API, Ant Design Vue, xterm.js for terminal emulation, and Monaco Editor for remote file editing. All backend interaction goes through Tauri's `invoke()` IPC and `listen()` event APIs.

## Entry & Startup

- **Entry point**: `src/main.js` -- creates the Vue app, registers Ant Design Vue globally, mounts to `#app`
- **Root component**: `src/App.vue` -- orchestrates all child components, manages tabs, themes, profiles, and lifecycle
- **HTML shell**: `index.html` -- minimal HTML that loads `src/main.js` as a module

## Component Architecture

### Layout Components

| Component | File | Responsibility |
|-----------|------|----------------|
| `App.vue` | `src/App.vue` | Root layout: TopMenu + Sidebar + Content + RightPanel + StatusBar. Manages tab state, SSH connections, theme toggling. |
| `TopMenu.vue` | `src/components/TopMenu.vue` | Horizontal menu bar with session/view/settings menus and quick-action buttons. |
| `TabManager.vue` | `src/components/TabManager.vue` | Tab bar using Ant Design's editable-card tabs. Renders tab icons and handles close. |
| `Sidebar.vue` | `src/components/Sidebar.vue` | Left panel: saved SSH profiles (list/group views with search), SFTP file browser, drag-and-drop upload. ~1500 LOC, the largest component. |
| `RightPanel.vue` | `src/components/RightPanel.vue` | Right panel: system monitor dashboard + download manager. Toggle between tabs via sidebar buttons. |
| `StatusBar.vue` | `src/components/StatusBar.vue` | Bottom status bar showing active connection and theme info. |

### Feature Components

| Component | File | Responsibility |
|-----------|------|----------------|
| `Terminal.vue` | `src/components/Terminal.vue` | xterm.js terminal wrapper. Handles local PTY and SSH terminal I/O, resize, theme, context menu (copy/paste/clear). |
| `FileEditor.vue` | `src/components/FileEditor.vue` | Monaco Editor wrapper for remote file editing. Supports read/write via SFTP, language detection, save/discard. |
| `FileManager.vue` | `src/components/FileManager.vue` | Local filesystem browser using Ant Design table. Navigation, hidden files toggle. (Currently less used than Sidebar's SFTP browser) |
| `SystemMonitor.vue` | `src/components/SystemMonitor.vue` | Standalone floating system monitor panel (alternative to RightPanel's monitor). |
| `DownloadManager.vue` | `src/components/DownloadManager.vue` | Standalone floating download manager (alternative to RightPanel's download tab). |
| `SshModal.vue` | `src/components/SshModal.vue` | Modal dialog for creating/editing SSH connections. Supports password/private-key auth, groups, tags. |
| `SettingsModal.vue` | `src/components/SettingsModal.vue` | Modal dialog for terminal settings (font, cursor) and theme selection. Shows profiles directory. |

## Services

| Service | File | Pattern | Responsibility |
|---------|------|---------|----------------|
| `SshService` | `src/services/SshService.js` | Singleton class | SSH lifecycle: create/launch/reconnect/close connections, SFTP auto-connect, error formatting |
| `SftpService` | `src/services/SftpService.js` | Singleton class | SFTP operations: list/read/write/download/upload/delete files, language detection |
| `ThemeService` | `src/services/ThemeService.js` | Singleton class | Theme management: dark/light themes with terminal color schemes, localStorage persistence |

## External Interfaces (Tauri IPC)

All Tauri commands are called via `invoke('command_name', { params })`. Key command groups:

- **Terminal**: `start_pty`, `write_pty`, `resize_pty`, `close_pty`
- **SSH Terminal**: `start_ssh_terminal`, `write_ssh_terminal`, `resize_ssh_terminal`, `close_ssh_terminal`
- **SSH Profiles**: `save_ssh_profile`, `list_ssh_profiles`, `get_ssh_password`, `delete_ssh_profile`, `get_profiles_dir`
- **SFTP**: `connect_sftp`, `list_sftp_files`, `download_sftp_file`, `upload_sftp_file`, `read_sftp_file`, `write_sftp_file`, `delete_sftp_file`, `create_sftp_directory`, `rename_sftp_file`, `delete_sftp_directory`
- **System Monitor**: `get_all_system_info_batch`, `get_dynamic_system_info_batch`, `connect_ssh_for_monitoring`, `disconnect_ssh_monitoring`
- **Download**: `select_download_location`, `download_sftp_file_with_progress`, `cancel_download`, `open_file_location`
- **Filesystem**: `list_files`, `get_home_dir`, `get_parent_dir`, `open_file_explorer`

Events (backend -> frontend via `listen`):
- `pty://{id}` -- local terminal output
- `pty_exit://{id}` -- local terminal exit
- `ssh_data://{id}` -- SSH terminal output
- `ssh_exit://{id}` -- SSH terminal exit
- `ssh_error` -- SSH error messages
- `download-progress` -- download progress updates

## Key Dependencies

- `vue` 3.5.x -- UI framework
- `ant-design-vue` 4.2.x -- UI component library
- `@xterm/xterm` 5.5.x -- terminal emulator
- `@xterm/addon-fit` 0.10.x -- terminal auto-fit addon
- `monaco-editor` 0.52.x -- code editor (lazy loaded, chunk-split)
- `@tauri-apps/api` 2.8.x -- Tauri IPC bridge
- `less` 4.4.x -- CSS preprocessor (for Ant Design)

## Data Model

Frontend state is managed via Vue 3 reactive refs in `App.vue`:

- `tabs: Array<{ id, title, type, profile?, sftpConnectionId?, fileInfo?, connectionId? }>`
- `activeId: string`
- `profiles: Array<SshProfileMeta>` -- loaded from backend
- `theme: 'dark' | 'light'`
- `terminalConfig: { fontSize, fontFamily, cursorBlink, cursorStyle }`

## Testing & Quality

**No tests exist.** No test framework is configured.

Recommended additions:
- Add Vitest for component and service unit tests
- Add `@vue/test-utils` for component testing
- Add Playwright for E2E testing of the Tauri app

## FAQ

**Q: How are SSH and SFTP connections related?**
A: When an SSH terminal tab is created, `SshService` establishes the SSH terminal first, then after a 2-second delay, creates an independent SFTP connection. The SFTP connection ID is stored on the tab object as `sftpConnectionId`.

**Q: How does theming work?**
A: `ThemeService` sets `data-theme` attribute on `<body>`. CSS variables in `style.css` and `App.vue` respond to this attribute. Terminal colors are separate theme objects passed to xterm.js.

**Q: Why are there two system monitor components?**
A: `SystemMonitor.vue` is an older floating panel implementation. `RightPanel.vue` contains the newer integrated version. Both share the same backend API.

## Related Files

```
src/
  main.js                          -- App entry point
  App.vue                          -- Root component (~400 LOC)
  style.css                        -- Global styles + theme variables (~700 LOC)
  components/
    Terminal.vue                   -- Terminal emulator wrapper (~535 LOC)
    Sidebar.vue                    -- Left panel with profiles + SFTP browser (~1535 LOC)
    RightPanel.vue                 -- Right panel: monitor + downloads (~1300 LOC)
    FileEditor.vue                 -- Monaco Editor wrapper (~400 LOC)
    FileManager.vue                -- Local file browser (~470 LOC)
    SystemMonitor.vue              -- Floating system monitor (~650 LOC)
    DownloadManager.vue            -- Floating download manager (~355 LOC)
    TopMenu.vue                    -- Top menu bar (~105 LOC)
    TabManager.vue                 -- Tab bar (~85 LOC)
    SshModal.vue                   -- SSH connection dialog (~290 LOC)
    SettingsModal.vue              -- Settings dialog (~225 LOC)
    StatusBar.vue                  -- Bottom status bar (~77 LOC)
    HelloWorld.vue                 -- Unused template component
  services/
    SshService.js                  -- SSH connection service (~360 LOC)
    SftpService.js                 -- SFTP file operation service (~220 LOC)
    ThemeService.js                -- Theme management service (~135 LOC)
```

## Changelog

- **2026-03-18T08:46:36**: Initial documentation generated from project scan.
