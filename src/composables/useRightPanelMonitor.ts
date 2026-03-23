import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from 'vue'
import { message } from 'antdv-next'
import { invoke } from '@tauri-apps/api/core'
import { createRightPanelMonitorDerived } from './rightPanelMonitorDerived'
import type {
  CpuInfo,
  DiskInfo,
  MemoryInfo,
  MonitorTab,
  NetworkInfo,
  ProcessInfo,
  SshProfile,
  SystemInfoBatch,
  SystemStaticInfo,
} from '../types/app'

type UseRightPanelMonitorOptions = {
  activeTab: Ref<MonitorTab>
  collapsed: Ref<boolean>
  connectionId: Ref<string>
  embedded: Ref<boolean>
  sshProfile: Ref<SshProfile | null>
}

const INITIAL_REFRESH_INTERVAL = 3000
const MIN_REFRESH_INTERVAL = 3000
const MAX_REFRESH_INTERVAL = 30000
const HISTORY_LIMIT = 18

export function useRightPanelMonitor(options: UseRightPanelMonitorOptions) {
  const systemInfo = shallowRef<SystemStaticInfo>({})
  const cpuInfo = shallowRef<CpuInfo>({})
  const memoryInfo = shallowRef<MemoryInfo>({})
  const diskInfo = shallowRef<DiskInfo[]>([])
  const networkInfo = shallowRef<NetworkInfo[]>([])
  const processInfo = shallowRef<ProcessInfo>({})
  const showAllDisks = ref(false)
  const lastUpdate = ref<number | null>(null)
  const rxHistory = ref<number[]>([])
  const txHistory = ref<number[]>([])
  const currentTheme = ref<'light' | 'dark'>('light')
  const refreshIntervalMs = ref(INITIAL_REFRESH_INTERVAL)
  const isEmbeddedMonitor = computed(() => options.embedded.value && options.activeTab.value === 'monitor')
  const isMonitorVisible = computed(() => options.activeTab.value === 'monitor' && !options.collapsed.value)

  let themeObserver: MutationObserver | null = null
  let refreshTimer: ReturnType<typeof setTimeout> | null = null
  let hasReportedRefreshError = false

  const derived = createRightPanelMonitorDerived({
    systemInfo,
    cpuInfo,
    memoryInfo,
    diskInfo,
    networkInfo,
    processInfo,
    showAllDisks,
    lastUpdate,
    rxHistory,
    txHistory,
    refreshIntervalMs,
    currentTheme,
    isEmbeddedMonitor,
    connectionId: options.connectionId,
    sshProfile: options.sshProfile,
  })

  function appendHistory(series: Ref<number[]>, metric: number) {
    if (!Number.isFinite(metric)) return
    const nextValue = Math.round(metric * 10) / 10
    series.value = [...series.value.slice(-(HISTORY_LIMIT - 1)), nextValue]
  }

  function resetMonitorState() {
    lastUpdate.value = null
    rxHistory.value = []
    txHistory.value = []
    showAllDisks.value = false
    refreshIntervalMs.value = INITIAL_REFRESH_INTERVAL
    hasReportedRefreshError = false
  }

  function recordMonitorSnapshot(batchInfo: SystemInfoBatch) {
    appendHistory(rxHistory, batchInfo.network.reduce((sum, item) => sum + (item.rx_speed || 0), 0))
    appendHistory(txHistory, batchInfo.network.reduce((sum, item) => sum + (item.tx_speed || 0), 0))
    lastUpdate.value = Date.now()
  }

  async function refreshData() {
    if (!options.connectionId.value) return

    try {
      const batchInfo = await invoke<SystemInfoBatch>('get_all_system_info_batch', {
        connectionId: options.connectionId.value,
      })

      if (batchInfo.system.hostname) systemInfo.value = batchInfo.system
      if (batchInfo.cpu.usage !== undefined) cpuInfo.value = batchInfo.cpu
      if (batchInfo.memory.total) memoryInfo.value = batchInfo.memory
      if (batchInfo.disk.length > 0) diskInfo.value = batchInfo.disk
      if (batchInfo.network.length > 0) networkInfo.value = batchInfo.network
      processInfo.value = batchInfo.process
      recordMonitorSnapshot(batchInfo)
      refreshIntervalMs.value = Math.max(MIN_REFRESH_INTERVAL, refreshIntervalMs.value * 0.95)
      hasReportedRefreshError = false
    } catch (error) {
      const errorText = String(error)
      const connectionMissing = !options.connectionId.value || errorText.includes('SSH连接不存在') || errorText.includes('未找到')

      if (connectionMissing) {
        stopAutoRefresh()
        return
      }

      if (!hasReportedRefreshError) {
        message.error(`获取系统信息失败: ${errorText}`)
        hasReportedRefreshError = true
      }
      refreshIntervalMs.value = Math.min(MAX_REFRESH_INTERVAL, refreshIntervalMs.value * 2)
    }
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh()

    if (!options.connectionId.value || !isMonitorVisible.value) {
      return
    }

    const scheduleNext = () => {
      refreshTimer = setTimeout(async () => {
        if (isMonitorVisible.value && options.connectionId.value) {
          await refreshData()
          if (isMonitorVisible.value && options.connectionId.value) {
            scheduleNext()
          }
        }
      }, refreshIntervalMs.value)
    }

    refreshData()
      .catch(() => {})
      .finally(() => {
        if (isMonitorVisible.value && options.connectionId.value) {
          scheduleNext()
        }
      })
  }

  onMounted(() => {
    if (isMonitorVisible.value && options.connectionId.value) {
      startAutoRefresh()
    }

    const body = document.body
    currentTheme.value = body.dataset.theme === 'dark' ? 'dark' : 'light'
    themeObserver = new MutationObserver(() => {
      currentTheme.value = body.dataset.theme === 'dark' ? 'dark' : 'light'
    })
    themeObserver.observe(body, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
  })

  onBeforeUnmount(() => {
    stopAutoRefresh()
    themeObserver?.disconnect()
    themeObserver = null
  })

  watch(isMonitorVisible, (visible) => {
    if (visible && options.connectionId.value) {
      startAutoRefresh()
    } else {
      stopAutoRefresh()
    }
  })

  watch(options.connectionId, (nextConnectionId) => {
    resetMonitorState()
    if (nextConnectionId && isMonitorVisible.value) {
      startAutoRefresh()
    } else {
      stopAutoRefresh()
    }
  })

  return {
    processInfo,
    memoryInfo,
    showAllDisks,
    isEmbeddedMonitor,
    refreshData,
    ...derived,
  }
}
