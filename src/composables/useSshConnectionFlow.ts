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
  const autoReconnectTimers = ref(new Map<string, number>())
  const autoReconnectDelays = [1500, 5000]

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
    clearAutoReconnectTimer(id)
  }

  function clearAutoReconnectTimer(id: string) {
    const timer = autoReconnectTimers.value.get(id)
    if (timer) {
      window.clearTimeout(timer)
      autoReconnectTimers.value.delete(id)
    }
  }

  async function removePendingSshTab(id: string) {
    await options.closeTab(id, { skipDisconnect: true })
  }

  async function reconnectSsh(
    tab: ConnectionTab | null,
    flowOptions: { silent?: boolean; source?: 'manual' | 'auto' } = {},
  ) {
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
      clearAutoReconnectTimer(tab.id)
      options.patchSshTab(tab.id, {
        lastError: null,
        reconnectScheduledAt: null,
      })
      options.updateSshTabState(tab.id, 'connecting')
      await SshService.reconnect(tab.id, tab.profile, defaultSshConnectionInteractions)
      options.patchSshTab(tab.id, {
        sshState: 'connected',
        lastError: null,
        reconnectAttempt: 0,
        reconnectScheduledAt: null,
      })
      if (!flowOptions.silent) {
        message.success(`已重新连接 ${tab.title}`)
      }
      return true
    } catch (error) {
      const formattedError = String(error)
      if (isUserCancelledConnection(error)) {
        options.patchSshTab(tab.id, {
          sshState: 'disconnected',
          reconnectScheduledAt: null,
        })
        if (!flowOptions.silent) {
          message.info(`已取消重连 ${tab.title}`)
        }
        return false
      }

      options.patchSshTab(tab.id, {
        sshState: 'disconnected',
        lastError: formattedError,
        reconnectScheduledAt: null,
      })
      if (!flowOptions.silent) {
        message.error(`重连失败: ${tab.title}`)
        options.showLongError(formattedError)
      }
      return false
    }
  }

  function scheduleAutoReconnect(tab: ConnectionTab, reason: string) {
    if (tab.type !== 'ssh' || !tab.profile || closingTabIds.value.has(tab.id) || manualDisconnectingIds.value.has(tab.id)) {
      return
    }

    clearAutoReconnectTimer(tab.id)

    const nextAttempt = (tab.reconnectAttempt || 0) + 1
    const delay = autoReconnectDelays[nextAttempt - 1]

    if (!delay) {
      options.patchSshTab(tab.id, {
        sshState: 'disconnected',
        lastError: reason,
        reconnectScheduledAt: null,
      })
      return
    }

    const scheduledAt = Date.now() + delay
    options.patchSshTab(tab.id, {
      sshState: 'disconnected',
      lastError: reason,
      reconnectAttempt: nextAttempt,
      reconnectScheduledAt: scheduledAt,
    })

    const timer = window.setTimeout(async () => {
      autoReconnectTimers.value.delete(tab.id)
      const currentTab = options.findTabById(tab.id)
      if (!currentTab || currentTab.type !== 'ssh' || currentTab.sshState === 'connected') {
        return
      }

      const success = await reconnectSsh(currentTab, { silent: true, source: 'auto' })
      if (!success) {
        const latestTab = options.findTabById(tab.id)
        if (latestTab?.type === 'ssh') {
          scheduleAutoReconnect(latestTab, latestTab.lastError || reason)
        }
      }
    }, delay)

    autoReconnectTimers.value.set(tab.id, timer)
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
        lastError: null,
        reconnectAttempt: 0,
        reconnectScheduledAt: null,
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
        options.patchSshTab(failedTab.id, {
          sshState: 'disconnected',
          lastError: String(error),
          reconnectScheduledAt: null,
        })
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
      options.patchSshTab(id, {
        sshState: 'disconnected',
        reconnectAttempt: 0,
        reconnectScheduledAt: null,
      })
      manualDisconnectingIds.value.delete(id)
      return
    }

    const tab = options.findTabById(id)
    if (tab?.type === 'ssh' && tab.profile) {
      scheduleAutoReconnect(tab, 'SSH 会话已断开，正在尝试恢复连接')
      return
    }

    void options.closeTab(id, { skipDisconnect: true })
  }

  async function disconnectSshTab(id: string) {
    const tab = options.tabs.value.find((item) => item.id === id)
    if (tab?.type !== 'ssh' || tab.sshState === 'disconnected') return

    manualDisconnectingIds.value.add(id)
    clearAutoReconnectTimer(id)
    try {
      await SshService.closeConnection(id)
      options.patchSshTab(id, {
        sshState: 'disconnected',
        lastError: null,
        reconnectAttempt: 0,
        reconnectScheduledAt: null,
      })
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
