import { h, ref, type Ref } from 'vue'
import { Input, Modal, message } from 'antdv-next'
import { invoke } from '@tauri-apps/api/core'
import type { SftpFileEntry } from '../types/app'

type RenameState = {
  path: string
  value: string
}

type PermissionModalState = {
  loading: boolean
  path: string
  open: boolean
}

type ChownModalState = {
  loading: boolean
  path: string
  open: boolean
}

type UseRemoteFileActionsOptions = {
  connectionId: Ref<string>
  currentPath: Ref<string>
  files: Ref<SftpFileEntry[]>
  selectedPaths: Ref<string[]>
  contextMenuEntry: Ref<SftpFileEntry | null>
  renameState: RenameState
  permissionModal: PermissionModalState
  chownModal: ChownModalState
  refreshCurrentPath: () => void
  refreshTree: () => void
  addAuditLog: (command: string, status?: 'success' | 'error') => void
  cancelInlineRename: () => void
}

export function useRemoteFileActions(options: UseRemoteFileActionsOptions) {
  function normalizeDirPrefix(path: string) {
    return path.endsWith('/') ? path : `${path}/`
  }

  function isNestedMoveTarget(sourcePath: string, targetPath: string) {
    return targetPath.startsWith(normalizeDirPrefix(sourcePath))
  }

  function syncMutation(command?: string) {
    options.refreshCurrentPath()
    options.refreshTree()
    if (command) {
      options.addAuditLog(command)
    }
  }

  async function executeShellMutation(command: string, successMessage: string, errorMessage: string, close: () => void) {
    try {
      await invoke('execute_ssh_command', {
        connectionId: options.connectionId.value,
        command,
      })
      message.success(successMessage)
      close()
      options.refreshCurrentPath()
      options.addAuditLog(command)
    } catch {
      message.error(errorMessage)
    }
  }

  async function submitInlineRename(path: string, value: string) {
    const nextName = value.trim()
    if (!path || path !== options.renameState.path) return
    if (!nextName) {
      message.warning('名称不能为空')
      return
    }

    const currentEntry = options.files.value.find((file) => file.path === path)
      || (options.contextMenuEntry.value?.path === path ? options.contextMenuEntry.value : null)
    const currentName = currentEntry?.name || path.split('/').filter(Boolean).pop() || ''
    if (nextName === currentName) {
      options.cancelInlineRename()
      return
    }

    const parent = path.substring(0, path.lastIndexOf('/')) || '/'
    const newPath = parent === '/' ? `/${nextName}` : `${parent}/${nextName}`

    try {
      await invoke('rename_sftp_file', {
        connectionId: options.connectionId.value,
        oldPath: path,
        newPath,
      })
      message.success('重命名成功')
      options.cancelInlineRename()
      syncMutation(`mv ${path} ${newPath}`)
    } catch {
      message.error('重命名失败')
    }
  }

  async function createFolder() {
    options.cancelInlineRename()
    const folderName = ref('')

    Modal.confirm({
      title: '新建文件夹',
      content: () => h(Input, {
        value: folderName.value,
        placeholder: '请输入名称',
        'onUpdate:value': (nextValue: string) => {
          folderName.value = nextValue
        },
      }),
      onOk: async () => {
        if (!folderName.value) return

        const path = options.currentPath.value === '/'
          ? `/${folderName.value}`
          : `${options.currentPath.value}/${folderName.value}`

        try {
          await invoke('create_sftp_directory', {
            connectionId: options.connectionId.value,
            path,
          })
          message.success('创建成功')
          syncMutation(`mkdir ${path}`)
        } catch {
          message.error('创建失败')
        }
      },
    })
  }

  async function deleteSelected(entriesToDelete?: SftpFileEntry[]) {
    options.cancelInlineRename()
    const targets = entriesToDelete || options.files.value.filter((file) => options.selectedPaths.value.includes(file.path))
    if (!targets.length) return

    Modal.confirm({
      title: `确认删除这 ${targets.length} 项吗？`,
      okType: 'danger',
      onOk: async () => {
        const deletedPaths: string[] = []
        const failedPaths: string[] = []

        for (const entry of targets) {
          try {
            if (entry.is_dir || entry.is_directory) {
              await invoke('delete_sftp_directory', {
                connectionId: options.connectionId.value,
                path: entry.path,
              })
            } else {
              await invoke('delete_sftp_file', {
                connectionId: options.connectionId.value,
                path: entry.path,
              })
            }
            deletedPaths.push(entry.path)
          } catch (error) {
            console.error(`Delete failed: ${entry.path}`, error)
            failedPaths.push(entry.path)
          }
        }

        if (deletedPaths.length) {
          syncMutation(`rm -rf ${deletedPaths.join(' ')}`)
        }

        if (!failedPaths.length) {
          message.success(`删除完成，共 ${deletedPaths.length} 项`)
          return
        }

        if (!deletedPaths.length) {
          message.error(`删除失败，共 ${failedPaths.length} 项`)
          return
        }

        message.warning(`删除部分完成：成功 ${deletedPaths.length} 项，失败 ${failedPaths.length} 项`)
      },
    })
  }

  async function moveEntriesToDirectory(entries: SftpFileEntry[], targetPath: string) {
    const movedEntries: string[] = []
    const blockedEntries: string[] = []
    const failedEntries: string[] = []

    for (const entry of entries) {
      const newPath = targetPath === '/' ? `/${entry.name}` : `${targetPath}/${entry.name}`
      if (entry.path === newPath) continue

      if ((entry.is_dir || entry.is_directory) && isNestedMoveTarget(entry.path, targetPath)) {
        blockedEntries.push(entry.name)
        continue
      }

      try {
        await invoke('rename_sftp_file', {
          connectionId: options.connectionId.value,
          oldPath: entry.path,
          newPath,
        })
        movedEntries.push(entry.name)
      } catch {
        failedEntries.push(entry.name)
      }
    }

    syncMutation(movedEntries.length ? `mv ${movedEntries.join(' ')} -> ${targetPath}` : undefined)

    if (movedEntries.length && !failedEntries.length && !blockedEntries.length) {
      message.success(`已移动 ${movedEntries.length} 项到 ${targetPath}`)
      return
    }

    if (movedEntries.length) {
      const details = [
        `已移动 ${movedEntries.length} 项`,
        blockedEntries.length ? `${blockedEntries.length} 项因目标位于自身子目录而跳过` : '',
        failedEntries.length ? `${failedEntries.length} 项移动失败` : '',
      ].filter(Boolean)
      message.warning(details.join('，'))
      return
    }

    if (blockedEntries.length && !failedEntries.length) {
      message.warning('不能把文件夹拖入它自己的子目录')
      return
    }

    message.error(failedEntries.length > 1 ? '部分文件移动失败' : `移动 ${failedEntries[0] || '文件'} 失败`)
  }

  async function applyEntryPermissions(mode: number, recursive: boolean, _scope?: string) {
    options.permissionModal.loading = true
    const command = recursive
      ? `chmod -R ${mode.toString(8)} ${options.permissionModal.path}`
      : `chmod ${mode.toString(8)} ${options.permissionModal.path}`

    await executeShellMutation(
      command,
      '修改成功',
      '修改失败',
      () => {
        options.permissionModal.open = false
      },
    )

    options.permissionModal.loading = false
  }

  async function applyChown(user: string, group: string, recursive: boolean) {
    options.chownModal.loading = true
    const target = group ? `${user}:${group}` : user
    const command = recursive
      ? `chown -R ${target} ${options.chownModal.path}`
      : `chown ${target} ${options.chownModal.path}`

    await executeShellMutation(
      command,
      '修改成功',
      '修改失败',
      () => {
        options.chownModal.open = false
      },
    )

    options.chownModal.loading = false
  }

  return {
    submitInlineRename,
    createFolder,
    deleteSelected,
    moveEntriesToDirectory,
    applyEntryPermissions,
    applyChown,
  }
}
