import { computed, ref, type Ref } from 'vue'
import { useTransferManager, type TransferTask } from './useTransferManager'
import type { MonitorTab, UploadRequest } from '../types/app'

type TransferFilter = 'all' | 'download' | 'upload' | 'running' | 'completed' | 'error'

export interface TransferGroup {
  id: string
  direction: 'download' | 'upload'
  status: 'running' | 'completed' | 'error' | 'cancelled' | 'skipped'
  label: string
  sourceLabel: string
  targetLabel: string
  note: string
  error: string | null
  progress: number
  transferred: number
  total: number
  speed: number
  count: number
  items: TransferTask[]
}

export function useRightPanelTransfers(activeTab: Ref<MonitorTab>) {
  const transferFilter = ref<TransferFilter>('all')
  const transferFilterOptions: Array<{ label: string; value: TransferFilter }> = [
    { label: '全部', value: 'all' },
    { label: '下载', value: 'download' },
    { label: '上传', value: 'upload' },
    { label: '进行中', value: 'running' },
    { label: '失败', value: 'error' },
    { label: '完成', value: 'completed' },
  ]

  const {
    transfers,
    enqueueDownload,
    enqueueUpload,
    cancelTransfers,
    retryTransfer: retryManagedTransfer,
    clearCompleted: clearManagedCompleted,
    openFileLocation: openManagedFileLocation,
  } = useTransferManager()

  const transferGroups = computed(() => {
    const grouped = new Map<string, TransferTask[]>()

    for (const transfer of transfers.value) {
      const key = transfer.batchId || `${transfer.direction}-${transfer.id}`
      const currentGroup = grouped.get(key)
      if (currentGroup) {
        currentGroup.push(transfer)
      } else {
        grouped.set(key, [transfer])
      }
    }

    return Array.from(grouped.entries())
      .map(([id, groupItems]) => buildTransferGroup(id, groupItems))
      .sort((left, right) => {
        const leftTime = Math.max(...left.items.map((item) => item.startTime))
        const rightTime = Math.max(...right.items.map((item) => item.startTime))
        return rightTime - leftTime
      })
  })

  const visibleTransferGroups = computed(() => {
    switch (transferFilter.value) {
      case 'download':
        return transferGroups.value.filter((group) => group.direction === 'download')
      case 'upload':
        return transferGroups.value.filter((group) => group.direction === 'upload')
      case 'running':
        return transferGroups.value.filter((group) => group.status === 'running')
      case 'completed':
        return transferGroups.value.filter((group) => group.status === 'completed')
      case 'error':
        return transferGroups.value.filter((group) => group.status === 'error')
      default:
        return transferGroups.value
    }
  })

  function buildTransferGroup(id: string, items: TransferTask[]): TransferGroup {
    const first = items[0]
    const count = items.length
    const transferred = items.reduce((sum, item) => sum + item.transferred, 0)
    const total = items.reduce((sum, item) => sum + item.total, 0)
    const speed = items.reduce((sum, item) => sum + item.speed, 0)
    const hasRunning = items.some((item) => item.status === 'running')
    const hasError = items.some((item) => item.status === 'error')
    const hasCancelled = items.some((item) => item.status === 'cancelled')
    const hasSkipped = items.some((item) => item.status === 'skipped')

    let status: TransferGroup['status'] = 'completed'
    if (hasRunning) {
      status = 'running'
    } else if (hasError) {
      status = 'error'
    } else if (hasCancelled) {
      status = 'cancelled'
    } else if (hasSkipped) {
      status = 'skipped'
    }

    return {
      id,
      direction: first.direction,
      status,
      label: count > 1 ? (first.batchLabel || `批量${first.direction === 'download' ? '下载' : '上传'} (${count}项)`) : first.fileName,
      sourceLabel: count > 1 ? `${count} 个来源` : first.sourcePath,
      targetLabel: count > 1 ? `${count} 个目标` : first.targetPath,
      note: items.map((item) => item.note).find(Boolean) || '',
      error: items.map((item) => item.error).find(Boolean) || null,
      progress: total > 0 ? Math.round((transferred / total) * 100) : (status === 'completed' ? 100 : 0),
      transferred,
      total,
      speed,
      count,
      items,
    }
  }

  function addDownload(fileName: string, remotePath: string, savePath: string, connectionId: string) {
    enqueueDownload({
      fileName,
      remotePath,
      savePath,
      connectionId,
    })
    activeTab.value = 'download'
  }

  function addUpload(upload: UploadRequest) {
    enqueueUpload(upload)
    activeTab.value = 'download'
  }

  async function cancelTransferGroup(groupId: string) {
    const group = transferGroups.value.find((item) => item.id === groupId)
    if (!group) return
    await cancelTransfers(group.items)
  }

  function retryTransferGroup(groupId: string) {
    const group = transferGroups.value.find((item) => item.id === groupId)
    if (!group) return

    for (const transfer of group.items.filter((item) => item.status === 'error')) {
      retryManagedTransfer(transfer.id)
    }
  }

  async function openFileLocation(filePath: string) {
    await openManagedFileLocation(filePath)
  }

  function removeTransferGroup(groupId: string) {
    const group = transferGroups.value.find((item) => item.id === groupId)
    if (!group) return

    const ids = new Set(group.items.map((item) => item.id))
    transfers.value = transfers.value.filter((item) => !ids.has(item.id))
  }

  function clearCompleted() {
    clearManagedCompleted()
  }

  return {
    transfers,
    transferFilter,
    transferFilterOptions,
    visibleTransferGroups,
    addDownload,
    addUpload,
    cancelTransferGroup,
    retryTransferGroup,
    openFileLocation,
    removeTransferGroup,
    clearCompleted,
  }
}
