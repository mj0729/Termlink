export type ThemeName = 'light' | 'dark'
export type TabType = 'ssh' | 'local' | 'file'
export type TerminalCursorStyle = 'block' | 'underline' | 'bar'

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
}

export interface ConnectionTab {
  id: string
  title: string
  type: TabType
  profile?: SshProfile | null
  autoPassword?: string | null
  sftpConnectionId?: string | null
  fileInfo?: SftpFileEntry
  connectionId?: string
  off?: () => void
}

export interface SftpConnectedDetail {
  sshId: string
  sftpId: string
}

export type DownloadStatus = 'downloading' | 'completed' | 'error' | 'cancelled'
export type MonitorTab = 'monitor' | 'download'

export interface DownloadProgressPayload {
  downloadId: number
  downloaded: number
  total: number
  progress: number
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
