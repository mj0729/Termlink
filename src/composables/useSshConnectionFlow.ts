import { ref } from 'vue'
import { message } from 'antdv-next'
import SshService from '../services/SshService'
import { defaultSshConnectionInteractions } from '../utils/sshConnectionInteractions'
import type { ConnectionTab, SshConnectionPayload, SshProfile } from '../types/app'

type UseSshConnectionFlowOptions = {
  tabs: { value: ConnectionTab[] }
  activateTab: (id: string) => void
  openTabWithMotion: (tab: ConnectionTab, options?: { markFresh?: boolean }) => void
  findTabById: (id: string) => ConnectionTab | null
  patchSshTab: (id: string, patch: Partial<ConnectionTab>) => void
  updateSshTabState: (id: string, state: ConnectionTab['sshState']) => void
  closeTab: (id: string, options?: { skipDisconnect?: boolean }) => Promise<void>
  refreshConnectionData: () => Promise<void>
  showLongError: (content: string, maxWidth?: string) => void
  closeSshModal: () => void
}

export function useSshConnectionFlow(options: UseSshConnectionFlowOptions) {
  const manualDisconnectingIds = ref(new Set<string>())
  const closingTabIds = ref(new Set<string>())

  function isUserCancelledConnection(error: unknown) {
    return String(error).includes('已取消连接')
  }

  function isClosingSshTab(id: string) {
    return closingTabIds.value.has(id)
  }

  function markClosingSshTab(id: string) {
    closingTabIds.value.add(id)
  }

  function clearTrackedSshTab(id: string) {
    manualDisconnectingIds.value.delete(id)
    closingTabIds.value.delete(id)
  }

  async function removePendingSshTab(id: string) {
    await options.closeTab(id, { skipDisconnect: true })
  }

  async function reconnectSsh(tab: ConnectionTab | null, flowOptions: { silent?: boolean } = {}) {
    if (tab?.type !== 'ssh' || !tab.profile) {
      return false
    }

    if (tab.sshState === 'connected') {
      return true
    }

    if (tab.sshState === 'connecting') {
      return false
    }

    try {
      options.updateSshTabState(tab.id, 'connecting')
      await SshService.reconnect(tab.id, tab.profile, defaultSshConnectionInteractions)
      options.updateSshTabState(tab.id, 'connected')
      return true
    } catch (error) {
      if (isUserCancelledConnection(error)) {
        options.updateSshTabState(tab.id, 'disconnected')
        return false
      }

      options.updateSshTabState(tab.id, 'disconnected')
      if (!flowOptions.silent) {
        options.showLongError(String(error))
      }
      return false
    }
  }

  async function launchSavedProfile(profile: SshProfile) {
    try {
      const existingTab = options.tabs.value.find((tab) => tab.type === 'ssh' && tab.profile?.id === profile.id)
      if (existingTab) {
        options.activateTab(existingTab.id)
        if (existingTab.sshState === 'disconnected') {
          await reconnectSsh(existingTab, { silent: true })
        }
        return
      }

      const tabInfo = SshService.createPendingProfileTab(profile)
      options.openTabWithMotion(tabInfo)
      const autoPassword = await SshService.openSavedProfile(tabInfo.id, profile, defaultSshConnectionInteractions)
      const currentSshTab = options.findTabById(tabInfo.id)
      if (!currentSshTab) {
        await SshService.closeConnection(tabInfo.id)
        return
      }

      options.patchSshTab(tabInfo.id, {
        autoPassword,
        sshState: 'connected',
      })
    } catch (error) {
      if (isUserCancelledConnection(error)) {
        const pendingTab = options.tabs.value.find((tab) => tab.type === 'ssh' && tab.profile?.id === profile.id)
        if (pendingTab?.sshState === 'connecting') {
          await removePendingSshTab(pendingTab.id)
        }
        return
      }

      const failedTab = options.tabs.value.find((tab) => tab.type === 'ssh' && tab.profile?.id === profile.id)
      if (failedTab) {
        options.patchSshTab(failedTab.id, { sshState: 'disconnected' })
      }

      console.error('启动SSH连接失败:', error)
      options.showLongError(String(error))
    }
  }

  async function submitSsh(sshData: SshConnectionPayload) {
    try {
      if (sshData.isEdit) {
        await SshService.updateProfile(sshData as SshConnectionPayload & { id: string })
        await options.refreshConnectionData()
        options.closeSshModal()
        return
      }

      const tabInfo = await SshService.createSshConnection(sshData, defaultSshConnectionInteractions)
      options.openTabWithMotion(tabInfo)
      if (sshData.savePassword) {
        await options.refreshConnectionData()
      }
      options.closeSshModal()
    } catch (error) {
      if (isUserCancelledConnection(error)) {
        options.closeSshModal()
        return
      }

      console.error('SSH连接操作失败:', error)
      options.showLongError(String(error))
    }
  }

  function handleSshTabExit(id: string) {
    if (closingTabIds.value.has(id)) return

    if (manualDisconnectingIds.value.has(id)) {
      options.updateSshTabState(id, 'disconnected')
      manualDisconnectingIds.value.delete(id)
      return
    }

    void options.closeTab(id, { skipDisconnect: true })
  }

  async function disconnectSshTab(id: string) {
    const tab = options.tabs.value.find((item) => item.id === id)
    if (tab?.type !== 'ssh' || tab.sshState === 'disconnected') return

    manualDisconnectingIds.value.add(id)
    try {
      await SshService.closeConnection(id)
      options.updateSshTabState(id, 'disconnected')
    } finally {
      manualDisconnectingIds.value.delete(id)
    }
  }

  async function reconnectAllSshTabs() {
    const candidates = options.tabs.value.filter((tab) => (
      tab.type === 'ssh' && tab.sshState === 'disconnected' && tab.profile
    ))

    if (!candidates.length) return

    let successCount = 0
    let failedCount = 0

    for (const tab of candidates) {
      const success = await reconnectSsh(tab, { silent: true })
      if (success) {
        successCount += 1
      } else {
        failedCount += 1
      }
    }

    if (successCount && !failedCount) {
      message.success(`已连接 ${successCount} 个 SSH 标签`)
      return
    }

    if (successCount || failedCount) {
      message.warning(`批量连接完成：成功 ${successCount} 个，失败 ${failedCount} 个`)
    }
  }

  return {
    isUserCancelledConnection,
    isClosingSshTab,
    markClosingSshTab,
    clearTrackedSshTab,
    launchSavedProfile,
    submitSsh,
    reconnectSsh,
    handleSshTabExit,
    disconnectSshTab,
    reconnectAllSshTabs,
  }
}
