import { invoke } from '@tauri-apps/api/core'
import type { ImportPreview, ImportResult } from '../types/app'

class ImportExportService {
  async buildExportPackage(includePasswords: boolean, exportPassword?: string): Promise<string> {
    return invoke<string>('export_connections', {
      includePasswords,
      exportPassword: exportPassword || null,
    })
  }

  async saveExportPackage(path: string, content: string): Promise<void> {
    await invoke('save_export_package', { path, content })
  }

  async previewImport(content: string): Promise<ImportPreview> {
    return invoke<ImportPreview>('import_connections_preview', { content })
  }

  async importPackage(
    content: string,
    exportPassword?: string,
    conflictStrategy: 'overwrite' | 'duplicate' | 'skip' = 'duplicate',
  ): Promise<ImportResult> {
    return invoke<ImportResult>('import_connections', {
      content,
      exportPassword: exportPassword || null,
      conflictStrategy,
    })
  }
}

export default new ImportExportService()
