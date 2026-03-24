import { invoke } from '@tauri-apps/api/core'
import type { FilePreviewInfo, SftpDetailedEntry, SftpDiskUsageInfo, SftpFileEntry } from '../types/app'

const LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  jsx: 'javascript',
  tsx: 'typescript',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  json: 'json',
  md: 'markdown',
  py: 'python',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  go: 'go',
  rs: 'rust',
  php: 'php',
  rb: 'ruby',
  sh: 'shell',
  bat: 'bat',
  ps1: 'powershell',
  sql: 'sql',
  vue: 'vue',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  conf: 'plaintext',
  log: 'plaintext',
  txt: 'plaintext',
}

class SftpService {
  private async call<T>(command: string, args: Record<string, unknown>, errorPrefix: string): Promise<T> {
    try {
      return await invoke<T>(command, args)
    } catch (e) {
      console.error(errorPrefix, e)
      throw e
    }
  }

  async listFiles(connectionId: string, path: string, showHidden = false): Promise<SftpFileEntry[]> {
    const files = await this.call<SftpFileEntry[]>('list_sftp_files', { connectionId, path }, `列出SFTP目录失败 (${path}):`)
    return showHidden ? files : files.filter((file) => !file.name.startsWith('.') || file.name === '..')
  }

  async readFile(connectionId: string, path: string): Promise<string> {
    return this.call<string>('read_sftp_file', { connectionId, path }, `读取SFTP文件失败 (${path}):`)
  }

  async writeFile(connectionId: string, path: string, content: string): Promise<void> {
    return this.call<void>('write_sftp_file', { connectionId, path, content }, `写入SFTP文件失败 (${path}):`)
  }

  async downloadFile(connectionId: string, remotePath: string, localPath: string): Promise<void> {
    return this.call<void>('download_sftp_file', { connectionId, remotePath, localPath }, `下载SFTP文件失败 (${remotePath}):`)
  }

  async uploadFile(connectionId: string, localPath: string, remotePath: string): Promise<void> {
    return this.call<void>('upload_sftp_file', { connectionId, localPath, remotePath }, `上传文件到SFTP失败 (${remotePath}):`)
  }

  async deleteFile(connectionId: string, path: string): Promise<void> {
    return this.call<void>('delete_sftp_file', { connectionId, path }, `删除SFTP文件失败 (${path}):`)
  }

  async deleteEntry(connectionId: string, entry: Pick<SftpFileEntry, 'path' | 'is_dir' | 'is_directory'>): Promise<void> {
    const command = entry.is_dir || entry.is_directory ? 'delete_sftp_directory' : 'delete_sftp_file'
    return this.call<void>(command, { connectionId, path: entry.path }, `删除SFTP条目失败 (${entry.path}):`)
  }

  async createDirectory(connectionId: string, path: string): Promise<void> {
    return this.call<void>('create_sftp_directory', { connectionId, remotePath: path }, `创建SFTP目录失败 (${path}):`)
  }

  async getFilePreview(connectionId: string, fileInfo: SftpFileEntry): Promise<FilePreviewInfo | null> {
    if (fileInfo.is_directory || fileInfo.is_dir) return null
    const content = await this.readFile(connectionId, fileInfo.path)
    const extension = fileInfo.name.split('.').pop()?.toLowerCase() ?? ''
    return {
      content,
      language: LANGUAGE_MAP[extension] ?? 'plaintext',
      path: fileInfo.path,
      name: fileInfo.name,
    }
  }

  getLanguageByExtension(extension: string): string {
    return LANGUAGE_MAP[extension] ?? 'plaintext'
  }

  async listDetailed(connectionId: string, path: string): Promise<SftpDetailedEntry[]> {
    return this.call<SftpDetailedEntry[]>('sftp_list_detailed', { connectionId, path }, `列出SFTP详情失败 (${path}):`)
  }

  async stat(connectionId: string, path: string): Promise<SftpDetailedEntry> {
    return this.call<SftpDetailedEntry>('sftp_stat', { connectionId, path }, `获取SFTP文件信息失败 (${path}):`)
  }

  async chmod(connectionId: string, path: string, mode: string): Promise<void> {
    return this.call<void>('sftp_chmod', { connectionId, path, mode }, `修改SFTP权限失败 (${path}):`)
  }

  async chown(connectionId: string, path: string, user: string, group: string): Promise<void> {
    return this.call<void>('sftp_chown', { connectionId, path, user, group }, `修改SFTP所有者失败 (${path}):`)
  }

  async archive(connectionId: string, paths: string[], archiveFormat: string, outputPath: string): Promise<void> {
    return this.call<void>('sftp_archive', { connectionId, paths, archiveFormat, outputPath }, `SFTP归档失败 (${outputPath}):`)
  }

  async uploadContent(
    connectionId: string,
    remotePath: string,
    data: Uint8Array,
    uploadId?: number,
  ): Promise<void> {
    const args: Record<string, unknown> = { connectionId, remotePath, data }
    if (uploadId !== undefined) args.uploadId = uploadId
    return this.call<void>('upload_sftp_content', args, `上传内容到SFTP失败 (${remotePath}):`)
  }

  async diskUsage(connectionId: string, path: string): Promise<SftpDiskUsageInfo> {
    return this.call<SftpDiskUsageInfo>('sftp_disk_usage', { connectionId, path }, `获取SFTP磁盘用量失败 (${path}):`)
  }
}

export default new SftpService()
