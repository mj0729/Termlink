export type ThemeName = 'light' | 'dark'
export type ThemeMode = 'light' | 'dark' | 'system'
export type ThemePresetId = 'minimal-black' | 'soft-gray' | 'terminal-green' | 'cool-slate'
export type ThemeStatusSaturation = 'soft' | 'normal'
export type TabType = 'ssh' | 'local' | 'file' | 'hosts'
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'
export type TerminalCursorStyle = 'block' | 'underline' | 'bar'
export type WorkspaceDensity = 'comfortable' | 'balanced' | 'compact'
export type HostCenterViewMode = 'list' | 'grid'
export type PortForwardType = 'local'

export interface ThemeConfig {
  background: string
  foreground: string
  cursor: string
  selection: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

export interface ThemeCenterConfig {
  mode: ThemeMode
  presetId: ThemePresetId
  accentColor: string
  statusSaturation: ThemeStatusSaturation
}

export interface ThemePresetOption extends SelectOption {
  value: ThemePresetId
  description?: string
  accent?: string
}

export interface TerminalConfig {
  fontSize: number
  fontFamily: string
  cursorBlink: boolean
  cursorStyle: TerminalCursorStyle
  density: WorkspaceDensity
  hostCenterViewMode: HostCenterViewMode
}

export interface SshPortForward {
  id: string
  type: PortForwardType
  localPort: number
  remoteHost: string
  remotePort: number
  label?: string
}

export interface CommandSnippet {
  id: string
  name: string
  command: string
  group?: string
}

export interface StartupTask {
  id: string
  name: string
  command: string
  enabled: boolean
}

export interface EnvTemplate {
  id: string
  key: string
  value: string
}

export interface SshProfile {
  id: string
  host: string
  port: number
  username: string
  name?: string
  group?: string
  tags?: string[]
  password?: string | null
  save_password?: boolean
  private_key?: string | null
  private_key_passphrase?: string | null
  proxy_jump_id?: string | null
  proxy_jump_name?: string | null
  proxy_jump_host?: string | null
  proxy_jump_port?: number | null
  proxy_jump_username?: string | null
  proxy_jump_private_key?: string | null
  proxy_jump_private_key_passphrase?: string | null
  ssh_config_source?: string | null
  ssh_config_host?: string | null
  port_forwards?: SshPortForward[]
  command_snippets?: CommandSnippet[]
  startup_tasks?: StartupTask[]
  env_templates?: EnvTemplate[]
}

export interface SshConnectionPayload {
  id?: string
  host: string
  port: number | string
  username: string
  password?: string
  savePassword?: boolean
  name?: string
  group?: string
  tags?: string[]
  usePrivateKey?: boolean
  privateKey?: string
  privateKeyPassphrase?: string
  proxyJumpId?: string | null
  proxyJumpName?: string | null
  proxyJumpHost?: string | null
  proxyJumpPort?: number | string | null
  proxyJumpUsername?: string | null
  proxyJumpPrivateKey?: string | null
  proxyJumpPrivateKeyPassphrase?: string | null
  sshConfigSource?: string | null
  sshConfigHost?: string | null
  portForwards?: SshPortForward[]
  commandSnippets?: CommandSnippet[]
  startupTasks?: StartupTask[]
  envTemplates?: EnvTemplate[]
  isEdit?: boolean
}

export interface SftpFileEntry {
  name: string
  path: string
  size: number
  is_dir?: boolean
  is_directory?: boolean
  modified?: number
  permissions?: string
  [key: string]: unknown
}

export interface FilePreviewInfo {
  content: string
  language: string
  path: string
  name: string
}

export interface DownloadRequest {
  fileName: string
  remotePath: string
  savePath: string
  connectionId: string
  entryType?: 'file' | 'directory'
  batchId?: string
  batchLabel?: string
}

export type UploadSource =
  | { kind: 'file'; file: File }
  | { kind: 'local-path'; localPath: string }

export interface UploadRequest {
  fileName: string
  targetPath: string
  connectionId: string
  source: UploadSource
  batchId?: string
  batchLabel?: string
}

export interface ConnectionTab {
  id: string
  title: string
  type: TabType
  profile?: SshProfile | null
  sshState?: ConnectionStatus
  lastError?: string | null
  reconnectAttempt?: number
  reconnectScheduledAt?: number | null
  autoPassword?: string | null
  fileInfo?: SftpFileEntry
  connectionId?: string
  off?: () => void
}

export type TabContextMenuAction =
  | 'connect'
  | 'connectAll'
  | 'disconnect'
  | 'close'
  | 'closeOthers'
  | 'closeAll'

export type MonitorTab = 'monitor' | 'download'
export type TransferDirection = 'download' | 'upload'
export type TransferStatus = 'running' | 'completed' | 'error' | 'cancelled' | 'skipped'

export interface DownloadProgressPayload {
  downloadId: number
  downloaded: number
  total: number
  progress: number
}

export interface UploadProgressPayload {
  uploadId: number
  uploaded: number
  total: number
  progress: number
}

export interface TransferItem {
  id: number
  direction: TransferDirection
  fileName: string
  sourcePath: string
  targetPath: string
  connectionId: string
  batchId?: string
  batchLabel?: string
  status: TransferStatus
  progress: number
  transferred: number
  total: number
  speed: number
  startTime: number
  error: string | null
}

export interface SystemStaticInfo {
  hostname?: string
  os?: string
  arch?: string
  kernel?: string
  uptime?: number
  boot_time?: number
}

export interface CpuInfo {
  model?: string
  usage?: number
  cores?: number[]
}

export interface MemoryInfo {
  used?: number
  total?: number
  usage?: number
  available?: number
  cached?: number
}

export interface DiskInfo {
  device: string
  filesystem?: string
  used?: number
  available?: number
  total?: number
  usage?: number
  mountpoint?: string
}

export interface NetworkInfo {
  name: string
  status?: string
  kind?: string
  ip?: string
  rx_speed?: number
  tx_speed?: number
  rx_bytes?: number
  tx_bytes?: number
}

export interface ProcessInfo {
  total?: number
  running?: number
  sleeping?: number
  top?: ProcessEntry[]
}

export interface ProcessEntry {
  memory_kb?: number
  cpu_percent?: number
  command?: string
}

export interface SystemInfoBatch {
  system: SystemStaticInfo
  cpu: CpuInfo
  memory: MemoryInfo
  disk: DiskInfo[]
  network: NetworkInfo[]
  process: ProcessInfo
}

export type DynamicSystemInfoBatch = Omit<SystemInfoBatch, 'system'>

export interface SftpState {
  currentPath: string
  pathInput: string
  files: SftpFileEntry[]
  loading: boolean
  history: string[]
  historyIndex: number
}

export interface FileManagerEntry {
  key: number
  name: string
  path: string
  isDirectory: boolean
  size?: number
  modified?: string
  isHidden?: boolean
}

export interface LocalFileListEntry {
  name: string
  path: string
  is_directory: boolean
  size?: number
  modified?: string
  is_hidden?: boolean
}

export interface SelectOption {
  label: string
  value: string
}

export interface SshModalForm extends SshConnectionPayload {
  id?: string
  port: number
  password: string
  privateKey: string
  privateKeyPassphrase: string
  proxyJumpPort: number | null
  usePrivateKey: boolean
  savePassword: boolean
  group: string
  tags: string[]
  portForwards: SshPortForward[]
  commandSnippets: CommandSnippet[]
  startupTasks: StartupTask[]
  envTemplates: EnvTemplate[]
}

export interface ImportPreviewItem {
  id: string
  name: string
  host: string
  username: string
}

export interface ImportPreview {
  connectionCount: number
  includesPasswords: boolean
  connections: ImportPreviewItem[]
}

export interface ImportResult {
  importedCount: number
  skippedCount: number
  overwrittenCount: number
}

export interface ParsedSshConfigHost {
  alias: string
  name: string
  host: string
  port: number
  username: string
  privateKey?: string | null
  proxyJumpAlias?: string | null
  portForwards: SshPortForward[]
}

export interface SftpDetailedEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  modified?: number
  permissions: string
  ownerUser?: string
  ownerGroup?: string
  numericPermissions?: string
  isSymlink: boolean
  symlinkTarget?: string
}

export interface SftpDiskUsageInfo {
  total: string
  used: string
  available: string
  mountPoint: string
}

export interface AuditLogEntry {
  id: number
  timestamp: number
  command: string
  result?: string
  error?: string
}
