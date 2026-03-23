[Root](../CLAUDE.md) > **src (Frontend)**

# Frontend Module -- Vue 3 + Vite

## Module Responsibility

The `src/` directory contains the entire frontend layer of Termlink. It renders the desktop application UI using Vue 3 Composition API, `antdv-next`, xterm.js for terminal emulation, and Monaco Editor for remote file editing. All backend interaction goes through Tauri's `invoke()` IPC and `listen()` event APIs.

## Entry & Startup

- **Entry point**: `src/main.ts` -- creates the Vue app, keeps `antdv-next/dist/reset.css`, and mounts to `#app`; component registration is now handled by Vite auto-import plugins
- **Root component**: `src/App.vue` -- orchestrates all child components, manages tabs, themes, profiles, and lifecycle
- **HTML shell**: `index.html` -- minimal HTML that loads `src/main.ts` as a module

## Component Architecture

### Layout Components

| Component | File | Responsibility |
|-----------|------|----------------|
| `App.vue` | `src/App.vue` | Root layout: TabManager + workspace content + RightPanel + StatusBar. Manages tab state, SSH connections, theme toggling, downloads/uploads, and modal visibility. |
| `TopMenu.vue` | `src/components/TopMenu.vue` | Legacy top menu component kept in repo for potential reuse; not currently mounted by `App.vue`. |
| `TabManager.vue` | `src/components/TabManager.vue` | Tab bar using Ant Design's editable-card tabs. Renders tab icons and handles close. |
| `Sidebar.vue` | `src/components/Sidebar.vue` | Left panel: saved SSH profiles (list/group views with search), SFTP file browser, drag-and-drop upload. ~1500 LOC, the largest component. |
| `RightPanel.vue` | `src/components/RightPanel.vue` | Right panel: system monitor dashboard + transfer manager. Toggle between tabs via bottom status bar actions. |
| `StatusBar.vue` | `src/components/StatusBar.vue` | Bottom status bar showing active connection, workspace count, and right-panel shortcuts. |

### Feature Components

| Component | File | Responsibility |
|-----------|------|----------------|
| `Terminal.vue` | `src/components/Terminal.vue` | xterm.js terminal wrapper. Handles local PTY and SSH terminal I/O, resize, theme, context menu (copy/paste/clear). |
| `FileEditor.vue` | `src/components/FileEditor.vue` | Monaco Editor wrapper for remote file editing. Supports read/write via SFTP, language detection, save/discard. |
| `FileManager.vue` | `src/components/FileManager.vue` | Local filesystem browser using Ant Design table. Navigation, hidden files toggle. (Currently less used than Sidebar's SFTP browser) |
| `SystemMonitor.vue` | `src/components/SystemMonitor.vue` | Standalone legacy system monitor panel kept for compatibility; the integrated monitor experience now lives in `RightPanel.vue`. |
| `SshModal.vue` | `src/components/SshModal.vue` | Modal dialog for creating/editing SSH connections. Supports password/private-key auth, groups, tags. |
| `SettingsModal.vue` | `src/components/SettingsModal.vue` | Dual-pane preferences dialog with left-side category navigation for general, terminal, appearance, and storage settings. Keeps theme/terminal config editing plus profile import/export actions. |

## Services

| Service | File | Pattern | Responsibility |
|---------|------|---------|----------------|
| `SshService` | `src/services/SshService.ts` | Singleton class | SSH lifecycle: create/launch/reconnect/close connections, host-key trust flow, password retry, error formatting |
| `SftpService` | `src/services/SftpService.ts` | Singleton class | SFTP operations: list/read/write/download/upload/delete files, language detection |
| `ThemeService` | `src/services/ThemeService.ts` | Singleton class | Theme management: dark/light themes with terminal color schemes, localStorage persistence |

## External Interfaces (Tauri IPC)

All Tauri commands are called via `invoke('command_name', { params })`. Key command groups:

- **Terminal**: `start_pty`, `write_pty`, `resize_pty`, `close_pty`
- **SSH Terminal**: `start_ssh_terminal`, `write_ssh_terminal`, `resize_ssh_terminal`
- **SSH Connection**: `disconnect_ssh_connection`
- **SSH Profiles**: `save_ssh_profile`, `list_ssh_profiles`, `get_ssh_password`, `delete_ssh_profile`, `get_profiles_dir`
- **Host key**: `preview_ssh_host_key`, `save_ssh_host_key_decision`
- **SFTP**: `list_sftp_files`, `download_sftp_file`, `upload_sftp_file`, `read_sftp_file`, `write_sftp_file`, `delete_sftp_file`, `create_sftp_directory`, `rename_sftp_file`, `delete_sftp_directory`
- **System Monitor**: `get_all_system_info_batch`, `get_dynamic_system_info_batch`
- **Transfer / Filesystem**: `select_download_location`, `select_local_directory`, `download_sftp_file`, `upload_sftp_file`, `upload_sftp_content`, `cancel_transfer`, `open_file_location`
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
- `antdv-next` 1.0.x -- UI component library
- `unplugin-vue-components` 31.x -- template component auto registration
- `unplugin-auto-import` 21.x -- script-side auto imports for selected APIs
- `@xterm/xterm` 5.5.x -- terminal emulator
- `@xterm/addon-fit` 0.10.x -- terminal auto-fit addon
- `monaco-editor` 0.52.x -- code editor (lazy loaded, chunk-split)
- `@tauri-apps/api` 2.8.x -- Tauri IPC bridge
- `less` 4.4.x -- CSS preprocessor (for antdv-next theme compatibility)

## Data Model

Frontend state is managed via Vue 3 reactive refs in `App.vue`:

- `tabs: Array<{ id, title, type, profile?, fileInfo?, connectionId? }>`
- `activeId: string`
- `profiles: Array<SshProfileMeta>` -- loaded from backend
- `theme: 'dark' | 'light'`
- `terminalConfig: { fontSize, fontFamily, cursorBlink, cursorStyle }`

## Testing & Quality

Lightweight regression tests exist for SSH workspace and SSH config import flows.

Recommended additions:
- Add Vitest for component and service unit tests
- Add `@vue/test-utils` for component testing
- Add Playwright for E2E testing of the Tauri app

## FAQ

**Q: How are SSH and SFTP connections related?**
A: A single `connection_id` now owns one backend `ConnectionManager` actor. Terminal IO, SFTP session creation and system monitoring commands all reuse that same SSH transport. SSH workspace tabs use their own `id` directly as the shared connection identifier, and SFTP sessions are opened lazily on first file operation.

**Q: How does theming work?**
A: `ThemeService` sets `data-theme` attribute on `<body>`. CSS variables in `style.css` and `App.vue` respond to this attribute. Terminal colors are separate theme objects passed to xterm.js.

**Q: Why is there both `SystemMonitor.vue` and `RightPanel.vue`?**
A: `SystemMonitor.vue` is an older standalone implementation kept in the repo. The primary in-product experience for monitoring and transfer management is now the integrated `RightPanel.vue`.

## Related Files

```
src/
  main.ts                          -- App entry point
  App.vue                          -- Root component (~400 LOC)
  style.css                        -- Global styles + theme variables (~700 LOC)
  components/
    Terminal.vue                   -- Terminal emulator wrapper (~535 LOC)
    Sidebar.vue                    -- Left panel with profiles + SFTP browser (~1535 LOC)
    RightPanel.vue                 -- Right panel: monitor + downloads (~1300 LOC)
    FileEditor.vue                 -- Monaco Editor wrapper (~400 LOC)
    FileManager.vue                -- Local file browser (~470 LOC)
    SystemMonitor.vue              -- Floating system monitor (~650 LOC)
    TopMenu.vue                    -- Top menu bar (~105 LOC)
    TabManager.vue                 -- Tab bar (~85 LOC)
    SshModal.vue                   -- SSH connection dialog (~290 LOC)
    SettingsModal.vue              -- Settings dialog (~225 LOC)
    StatusBar.vue                  -- Bottom status bar (~77 LOC)
  services/
    SshService.ts                  -- SSH connection service
    SftpService.ts                 -- SFTP file operation service
    ThemeService.ts                -- Theme management service
```

## Changelog

- **2026-03-18T08:46:36**: Initial documentation generated from project scan.
