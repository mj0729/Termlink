export type ThemeName = 'light' | 'dark'
export type TabType = 'ssh' | 'local' | 'file' | 'connections'
export type TerminalCursorStyle = 'block' | 'underline' | 'bar'
export type WorkspaceDensity = 'comfortable' | 'balanced' | 'compact'
export type ConnectionHubViewMode = 'list' | 'grid'

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

export interface TerminalConfig {
  fontSize: number
  fontFamily: string
  cursorBlink: boolean
  cursorStyle: TerminalCursorStyle
  density: WorkspaceDensity
  connectionHubViewMode: ConnectionHubViewMode
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
  autoPassword?: string | null
  fileInfo?: SftpFileEntry
  connectionId?: string
  off?: () => void
}

export type DownloadStatus = 'downloading' | 'completed' | 'error' | 'cancelled'
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

export interface DownloadItem {
  id: number
  fileName: string
  remotePath: string
  savePath: string
  connectionId: string
  status: DownloadStatus
  progress: number
  downloaded: number
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
  usePrivateKey: boolean
  savePassword: boolean
  group: string
  tags: string[]
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
