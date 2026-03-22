import { computed, ref, watch } from 'vue'
import { message } from 'antdv-next'
import type { ConnectionStatus, ConnectionTab, DownloadRequest, MonitorTab, UploadRequest } from '../types/app'

type RightPanelRef = {
  addDownload: (fileName: string, remotePath: string, savePath: string, connectionId: string) => void
  addUpload: (upload: UploadRequest) => void
}

type UseWorkspaceChromeOptions = {
  currentTab: { value: ConnectionTab | null }
  appMode: string
  rightPanelRef: { value: RightPanelRef | null }
}

export function useWorkspaceChrome({ currentTab, appMode, rightPanelRef }: UseWorkspaceChromeOptions) {
  const rightPanelCollapsed = ref(true)
  const embeddedMonitorCollapsed = ref(false)
  const rightPanelTab = ref<MonitorTab>('monitor')

  const isConnectionCenterLayout = computed(() => currentTab.value?.type === 'connections')
  const isSshWorkspaceLayout = computed(() => currentTab.value?.type === 'ssh')
  const shouldEmbedMonitorInSsh = computed(() => (
    isSshWorkspaceLayout.value && rightPanelTab.value === 'monitor'
  ))
  const effectiveRightPanelCollapsed = computed(() => (
    shouldEmbedMonitorInSsh.value || isConnectionCenterLayout.value
      ? true
      : rightPanelCollapsed.value
  ))

  const activeConnection = computed(() => {
    const tab = currentTab.value
    if (!tab || tab.type === 'connections') return ''
    if (tab.type === 'ssh') {
      const username = tab.profile?.username
      const host = tab.profile?.host
      if (username && host) return `${username}@${host}`
      return host || ''
    }
    return tab.title
  })

  const activeConnectionCopyText = computed(() => {
    const tab = currentTab.value
    if (tab?.type !== 'ssh') return ''
    return tab.profile?.host || ''
  })

  const activeConnectionState = computed<ConnectionStatus | ''>(() => {
    const tab = currentTab.value
    if (tab?.type !== 'ssh') return ''
    return tab.sshState || 'disconnected'
  })

  watch(isSshWorkspaceLayout, (nextIsSsh, previousIsSsh) => {
    if (nextIsSsh && !previousIsSsh && rightPanelTab.value === 'monitor') {
      embeddedMonitorCollapsed.value = false
    }
  })

  function handleStartDownload(downloadInfo: DownloadRequest) {
    if (appMode === 'remote-files') {
      message.info('独立文件窗口暂不展示传输队列，请在主窗口查看下载进度。')
    }
    rightPanelTab.value = 'download'
    rightPanelCollapsed.value = false
    rightPanelRef.value?.addDownload(
      downloadInfo.fileName,
      downloadInfo.remotePath,
      downloadInfo.savePath,
      downloadInfo.connectionId,
    )
  }

  function handleStartUpload(uploadInfo: UploadRequest) {
    if (appMode === 'remote-files') {
      message.info('独立文件窗口暂不展示传输队列，请在主窗口查看上传进度。')
    }
    rightPanelTab.value = 'download'
    rightPanelCollapsed.value = false
    rightPanelRef.value?.addUpload(uploadInfo)
  }

  function handleRightPanelTabSelect(tab: MonitorTab) {
    if (tab === 'monitor' && isSshWorkspaceLayout.value) {
      if (rightPanelTab.value === 'monitor') {
        embeddedMonitorCollapsed.value = !embeddedMonitorCollapsed.value
        return
      }

      rightPanelTab.value = tab
      embeddedMonitorCollapsed.value = false
      return
    }

    if (rightPanelTab.value === tab) {
      rightPanelCollapsed.value = !rightPanelCollapsed.value
      return
    }

    rightPanelTab.value = tab
    rightPanelCollapsed.value = false
  }

  return {
    rightPanelCollapsed,
    embeddedMonitorCollapsed,
    rightPanelTab,
    isConnectionCenterLayout,
    isSshWorkspaceLayout,
    shouldEmbedMonitorInSsh,
    effectiveRightPanelCollapsed,
    activeConnection,
    activeConnectionCopyText,
    activeConnectionState,
    handleStartDownload,
    handleStartUpload,
    handleRightPanelTabSelect,
  }
}
