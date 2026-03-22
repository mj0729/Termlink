import { h, ref } from 'vue'
import { Modal, message } from 'antdv-next'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type {
  DownloadRequest,
  DownloadProgressPayload,
  TransferItem,
  UploadProgressPayload,
  UploadRequest,
} from '../types/app'

type UploadConflictAction = 'overwrite' | 'rename' | 'skip'

export interface TransferTask extends TransferItem {
  downloadRequest?: DownloadRequest
  uploadRequest?: UploadRequest
  note?: string
  lastProgressAt?: number
  lastTransferred?: number
}

const transfers = ref<TransferTask[]>([])
let transferIdCounter = 0
let listenersReady: Promise<void> | null = null

function getTransferTask(transferId: number) {
  return transfers.value.find((item) => item.id === transferId) || null
}

function dispatchTransferComplete(transfer: TransferItem) {
  window.dispatchEvent(new CustomEvent('transfer-complete', {
    detail: {
      direction: transfer.direction,
      connectionId: transfer.connectionId,
      sourcePath: transfer.sourcePath,
      targetPath: transfer.targetPath,
      status: transfer.status,
    },
  }))
}

function updateTransferMetrics(transfer: TransferTask, transferred: number, total: number, progress: number) {
  const now = Date.now()
  const previousTransferred = transfer.lastTransferred ?? 0
  const previousTime = transfer.lastProgressAt ?? transfer.startTime
  const elapsedSeconds = Math.max((now - previousTime) / 1000, 0.001)
  const delta = Math.max(transferred - previousTransferred, 0)

  transfer.transferred = transferred
  transfer.total = total
  transfer.progress = progress
  transfer.speed = delta / elapsedSeconds
  transfer.lastTransferred = transferred
  transfer.lastProgressAt = now
}

async function ensureListenersReady() {
  if (!listenersReady) {
    listenersReady = (async () => {
      await listen<DownloadProgressPayload>('download-progress', (event) => {
        const { downloadId, downloaded, total, progress } = event.payload
        const transfer = transfers.value.find((item) => item.id === downloadId && item.direction === 'download')
        if (transfer && transfer.status === 'running') {
          updateTransferMetrics(transfer, downloaded, total, progress)
        }
      })

      await listen<UploadProgressPayload>('upload-progress', (event) => {
        const { uploadId, uploaded, total, progress } = event.payload
        const transfer = transfers.value.find((item) => item.id === uploadId && item.direction === 'upload')
        if (transfer && transfer.status === 'running') {
          updateTransferMetrics(transfer, uploaded, total, progress)
        }
      })
    })()
  }

  return listenersReady
}

async function resolveDownloadTarget(request: DownloadRequest) {
  const resolvedPath = await invoke<string>('resolve_local_target_path', {
    path: request.savePath,
  })

  return {
    targetPath: resolvedPath,
    note: resolvedPath !== request.savePath ? '检测到同名本地文件，已自动重命名' : '',
  }
}

function promptUploadConflictAction(request: UploadRequest): Promise<UploadConflictAction> {
  return new Promise((resolve) => {
    let settled = false
    let modalInstance: { destroy: () => void } | null = null
    const finish = (action: UploadConflictAction) => {
      if (settled) return
      settled = true
      modalInstance?.destroy()
      resolve(action)
    }

    modalInstance = Modal.confirm({
      title: '发现同名远程文件',
      content: h('div', { class: 'termlink-confirm-stack' }, [
        h('div', { class: 'termlink-confirm-path' }, request.targetPath),
        h('div', { class: 'termlink-confirm-text' }, `请选择如何处理“${request.fileName}”`),
      ]),
      okCancel: false,
      closable: false,
      maskClosable: false,
      keyboard: false,
      footer: () => h('div', { class: 'termlink-confirm-footer' }, [
        h('button', {
          type: 'button',
          class: 'termlink-confirm-button',
          onClick: () => finish('skip'),
        }, '跳过'),
        h('button', {
          type: 'button',
          class: 'termlink-confirm-button',
          onClick: () => finish('rename'),
        }, '自动重命名'),
        h('button', {
          type: 'button',
          class: 'termlink-confirm-button termlink-confirm-button--primary',
          onClick: () => finish('overwrite'),
        }, '覆盖'),
      ]),
      onClose: () => finish('skip'),
    })
  })
}

async function resolveUploadTarget(request: UploadRequest) {
  const exists = await invoke<boolean>('check_sftp_path_exists', {
    connectionId: request.connectionId,
    path: request.targetPath,
  })

  if (!exists) {
    return {
      action: 'overwrite' as const,
      targetPath: request.targetPath,
      note: '',
    }
  }

  const action = await promptUploadConflictAction(request)

  if (action === 'skip') {
    return {
      action,
      targetPath: request.targetPath,
      note: '检测到同名远程文件，已跳过上传',
    }
  }

  if (action === 'overwrite') {
    return {
      action,
      targetPath: request.targetPath,
      note: '检测到同名远程文件，已选择覆盖上传',
    }
  }

  const resolvedPath = await invoke<string>('resolve_sftp_target_path', {
    connectionId: request.connectionId,
    path: request.targetPath,
  })

  return {
    action,
    targetPath: resolvedPath,
    note: resolvedPath !== request.targetPath ? '检测到同名远程文件，已自动重命名' : '',
  }
}

async function startDownload(transfer: TransferTask) {
  try {
    const task = getTransferTask(transfer.id) || transfer
    const request = task.downloadRequest
    if (!request) {
      throw new Error('下载请求不存在')
    }

    const resolved = await resolveDownloadTarget(request)
    task.targetPath = resolved.targetPath
    task.note = resolved.note

    await invoke('download_sftp_file', {
      connectionId: task.connectionId,
      remotePath: task.sourcePath,
      localPath: task.targetPath,
      downloadId: task.id,
    })

    if (task.status !== 'cancelled') {
      task.status = 'completed'
      task.progress = 100
      task.speed = 0
      message.success(`下载完成: ${task.fileName}`)
      dispatchTransferComplete(task)
    }
  } catch (error) {
    const task = getTransferTask(transfer.id) || transfer
    if (task.status !== 'cancelled') {
      task.status = 'error'
      task.error = String(error)
      task.speed = 0
      message.error(`下载失败: ${task.fileName}`)
      dispatchTransferComplete(task)
    }
  }
}

async function startUpload(transfer: TransferTask, upload: UploadRequest) {
  try {
    const task = getTransferTask(transfer.id) || transfer
    const resolved = await resolveUploadTarget(upload)
    task.targetPath = resolved.targetPath
    task.note = resolved.note

    if (resolved.action === 'skip') {
      task.status = 'skipped'
      task.progress = 0
      task.transferred = 0
      task.total = 0
      task.speed = 0
      task.error = null
      message.info(`已跳过上传: ${task.fileName}`)
      dispatchTransferComplete(task)
      return
    }

    if (upload.source.kind === 'file') {
      const data = Array.from(new Uint8Array(await upload.source.file.arrayBuffer()))
      await invoke('upload_sftp_content', {
        connectionId: task.connectionId,
        remotePath: task.targetPath,
        data,
        uploadId: task.id,
      })
    } else {
      await invoke('upload_sftp_file', {
        connectionId: task.connectionId,
        localPath: upload.source.localPath,
        remotePath: task.targetPath,
        uploadId: task.id,
      })
    }

    if (task.status !== 'cancelled') {
      task.status = 'completed'
      task.progress = 100
      task.speed = 0
      message.success(`上传完成: ${task.fileName}`)
      dispatchTransferComplete(task)
    }
  } catch (error) {
    const task = getTransferTask(transfer.id) || transfer
    if (task.status !== 'cancelled') {
      task.status = 'error'
      task.error = String(error)
      task.speed = 0
      message.error(`上传失败: ${task.fileName}`)
      dispatchTransferComplete(task)
    }
  }
}

function markTransferCancelled(transfer: TransferTask) {
  transfer.status = 'cancelled'
  transfer.speed = 0
  message.info(`${transfer.direction === 'download' ? '已取消下载' : '已取消上传'}: ${transfer.fileName}`)
  dispatchTransferComplete(transfer)
}

function resetTransferForRetry(transfer: TransferTask) {
  transfer.status = 'running'
  transfer.progress = 0
  transfer.transferred = 0
  transfer.total = 0
  transfer.speed = 0
  transfer.error = null
  transfer.note = ''
  transfer.startTime = Date.now()
  transfer.lastProgressAt = undefined
  transfer.lastTransferred = undefined
}

export function useTransferManager() {
  void ensureListenersReady()

  function enqueueDownload(request: DownloadRequest) {
    const transfer: TransferTask = {
      id: ++transferIdCounter,
      direction: 'download',
      fileName: request.fileName,
      sourcePath: request.remotePath,
      targetPath: request.savePath,
      connectionId: request.connectionId,
      batchId: request.batchId,
      batchLabel: request.batchLabel,
      status: 'running',
      progress: 0,
      transferred: 0,
      total: 0,
      speed: 0,
      startTime: Date.now(),
      error: null,
      downloadRequest: request,
    }

    transfers.value.push(transfer)
    void startDownload(transfer)
    return transfer
  }

  function enqueueUpload(upload: UploadRequest) {
    const sourcePath = upload.source.kind === 'local-path' ? upload.source.localPath : upload.fileName
    const transfer: TransferTask = {
      id: ++transferIdCounter,
      direction: 'upload',
      fileName: upload.fileName,
      sourcePath,
      targetPath: upload.targetPath,
      connectionId: upload.connectionId,
      batchId: upload.batchId,
      batchLabel: upload.batchLabel,
      status: 'running',
      progress: 0,
      transferred: 0,
      total: 0,
      speed: 0,
      startTime: Date.now(),
      error: null,
      uploadRequest: upload,
    }

    transfers.value.push(transfer)
    void startUpload(transfer, upload)
    return transfer
  }

  async function cancelTransfer(transferId: number) {
    const transfer = getTransferTask(transferId)
    if (!transfer || transfer.status !== 'running') return

    try {
      await invoke('cancel_transfer', { transferId })
    } catch (error) {
      console.error('取消传输失败:', error)
      message.error(`取消${transfer.direction === 'download' ? '下载' : '上传'}失败: ${transfer.fileName}`)
      return
    }

    markTransferCancelled(transfer)
  }

  async function cancelTransfers(items: TransferTask[]) {
    for (const transfer of items.filter((item) => item.status === 'running')) {
      await cancelTransfer(transfer.id)
    }
  }

  function retryTransfer(transferId: number) {
    const transfer = getTransferTask(transferId)
    if (!transfer) return

    resetTransferForRetry(transfer)

    if (transfer.direction === 'download' && transfer.downloadRequest) {
      void startDownload(transfer)
      return
    }

    if (transfer.direction === 'upload' && transfer.uploadRequest) {
      void startUpload(transfer, transfer.uploadRequest)
    }
  }

  function removeTransfer(transferId: number) {
    const index = transfers.value.findIndex((item) => item.id === transferId)
    if (index !== -1) {
      transfers.value.splice(index, 1)
    }
  }

  function clearCompleted() {
    transfers.value = transfers.value.filter((item) => item.status === 'running' || item.status === 'error')
  }

  async function openFileLocation(filePath: string) {
    try {
      await invoke('open_file_location', { path: filePath })
    } catch (error) {
      message.error('无法打开文件位置: ' + error)
    }
  }

  return {
    transfers,
    enqueueDownload,
    enqueueUpload,
    cancelTransfer,
    cancelTransfers,
    retryTransfer,
    removeTransfer,
    clearCompleted,
    openFileLocation,
  }
}
