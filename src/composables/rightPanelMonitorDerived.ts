import { computed, type ComputedRef, type Ref } from 'vue'
import { DatabaseOutlined, HddOutlined, ThunderboltOutlined } from '@antdv-next/icons'
import { formatBytes, formatTransferSpeed, formatUptime } from '../utils/formatters'
import type {
  CpuInfo,
  DiskInfo,
  MemoryInfo,
  NetworkInfo,
  ProcessInfo,
  SshProfile,
  SystemStaticInfo,
} from '../types/app'

type MonitorAlert = {
  key: string
  type: 'success' | 'info' | 'warning' | 'error'
  message: string
  description: string
}

type ProcessTableRow = {
  key: string
  rank: number
  command: string
  cpuPercent: number
  memoryKb: number
}

type RightPanelMonitorDerivedOptions = {
  systemInfo: Ref<SystemStaticInfo>
  cpuInfo: Ref<CpuInfo>
  memoryInfo: Ref<MemoryInfo>
  diskInfo: Ref<DiskInfo[]>
  networkInfo: Ref<NetworkInfo[]>
  processInfo: Ref<ProcessInfo>
  showAllDisks: Ref<boolean>
  lastUpdate: Ref<number | null>
  rxHistory: Ref<number[]>
  txHistory: Ref<number[]>
  refreshIntervalMs: Ref<number>
  currentTheme: Ref<'light' | 'dark'>
  isEmbeddedMonitor: ComputedRef<boolean>
  connectionId: Ref<string>
  sshProfile: Ref<SshProfile | null>
}

const ignoredAlertInterfacePatterns = [
  /^docker0$/,
  /^veth/,
  /^br-/,
  /^virbr/,
  /^vmnet/,
  /^vboxnet/,
  /^zt/,
  /^tailscale/,
  /^tun/,
  /^tap/,
  /^wg/,
  /^cni/,
  /^flannel/,
  /^kube-ipvs0$/,
]

export function createRightPanelMonitorDerived(options: RightPanelMonitorDerivedOptions) {
  const isDarkTheme = computed(() => options.currentTheme.value === 'dark')
  const getCurrentProgressColor = (percentage: number) => getProgressColor(percentage, isDarkTheme.value)

  const sortedDiskInfo = computed(() => (
    [...options.diskInfo.value].sort((left, right) => {
      const usageDiff = (right.usage || 0) - (left.usage || 0)
      if (usageDiff !== 0) return usageDiff

      const availableDiff = (left.available || 0) - (right.available || 0)
      if (availableDiff !== 0) return availableDiff

      return (left.mountpoint || left.device || '').localeCompare(right.mountpoint || right.device || '')
    })
  ))

  const hasExtraDiskInfo = computed(() => sortedDiskInfo.value.length > 2)
  const visibleDiskInfo = computed(() => (
    options.showAllDisks.value ? sortedDiskInfo.value : sortedDiskInfo.value.slice(0, 2)
  ))
  const primaryDisk = computed(() => (
    sortedDiskInfo.value.find((disk) => disk.mountpoint === '/') || sortedDiskInfo.value[0] || null
  ))

  const sortedNetworkInfo = computed(() => (
    [...options.networkInfo.value].sort((left, right) => {
      if ((left.status === 'up') !== (right.status === 'up')) {
        return left.status === 'up' ? -1 : 1
      }

      const leftRate = (left.rx_speed || 0) + (left.tx_speed || 0)
      const rightRate = (right.rx_speed || 0) + (right.tx_speed || 0)
      return rightRate - leftRate
    })
  ))

  const networkAggregate = computed(() => (
    sortedNetworkInfo.value.reduce((aggregate, item) => ({
      rx: aggregate.rx + (item.rx_speed || 0),
      tx: aggregate.tx + (item.tx_speed || 0),
    }), { rx: 0, tx: 0 })
  ))

  const monitorHealthValue = computed(() => Math.max(
    options.cpuInfo.value.usage || 0,
    options.memoryInfo.value.usage || 0,
    primaryDisk.value?.usage || 0,
  ))

  const monitorDisconnected = computed(() => Boolean(options.sshProfile.value) && !options.connectionId.value)
  const canRefreshMonitor = computed(() => !monitorDisconnected.value && Boolean(options.connectionId.value))

  const monitorHealthTone = computed(() => {
    if (monitorDisconnected.value) return 'offline'
    return getUsageTone(monitorHealthValue.value)
  })

  const monitorHealthLabel = computed(() => {
    if (monitorDisconnected.value) return '已断开'
    if (monitorHealthTone.value === 'danger') return '高风险'
    if (monitorHealthTone.value === 'warning') return '需关注'
    return '运行稳定'
  })

  const monitorHostTitle = computed(() => (
    options.systemInfo.value.hostname
      || options.sshProfile.value?.name
      || options.sshProfile.value?.host
      || '当前主机'
  ))

  const monitorSummaryText = computed(() => {
    if (monitorDisconnected.value && options.sshProfile.value?.host) {
      return `与 ${options.sshProfile.value.host} 的 SSH 连接已断开，监控已停止刷新`
    }

    const summary = [
      options.systemInfo.value.os,
      options.systemInfo.value.arch,
      options.systemInfo.value.kernel,
    ].filter(Boolean)

    if (summary.length > 0) {
      return summary.join(' · ')
    }

    if (options.sshProfile.value?.host) {
      return `已连接 ${options.sshProfile.value.host}`
    }

    return '等待系统遥测...'
  })

  const lastUpdateText = computed(() => (
    monitorDisconnected.value
      ? '连接已断开'
      : options.lastUpdate.value
        ? `最近刷新 ${new Date(options.lastUpdate.value).toLocaleTimeString('zh-CN', { hour12: false })}`
        : '等待首帧数据'
  ))

  const heroStatistics = computed(() => ([
    {
      key: 'uptime',
      label: options.isEmbeddedMonitor.value ? '运行' : '系统运行时间',
      value: options.isEmbeddedMonitor.value
        ? formatCompactUptime(options.systemInfo.value.uptime)
        : formatUptime(options.systemInfo.value.uptime),
      precision: undefined,
      suffix: undefined,
      meta: monitorDisconnected.value ? '连接已断开' : `刷新间隔 ${Math.round(options.refreshIntervalMs.value / 1000)}s`,
      valueStyle: {
        color: isDarkTheme.value ? '#f5f5f5' : '#111111',
        fontSize: options.isEmbeddedMonitor.value ? '11px' : '24px',
        fontWeight: 700,
      },
    },
    {
      key: 'rx',
      label: options.isEmbeddedMonitor.value ? '下行' : '下行吞吐',
      value: options.isEmbeddedMonitor.value
        ? formatCompactNetworkSpeed(networkAggregate.value.rx)
        : formatNetworkSpeed(networkAggregate.value.rx),
      precision: undefined,
      suffix: undefined,
      meta: `${buildRateTrendLabel(options.rxHistory.value)} · 累计 ${formatSize(sortedNetworkInfo.value.reduce((sum, item) => sum + (item.rx_bytes || 0), 0))}`,
      valueStyle: {
        color: isDarkTheme.value ? '#f5f5f5' : '#111111',
        fontSize: options.isEmbeddedMonitor.value ? '11px' : '24px',
        fontWeight: 700,
      },
    },
    {
      key: 'tx',
      label: options.isEmbeddedMonitor.value ? '上行' : '上行吞吐',
      value: options.isEmbeddedMonitor.value
        ? formatCompactNetworkSpeed(networkAggregate.value.tx)
        : formatNetworkSpeed(networkAggregate.value.tx),
      precision: undefined,
      suffix: undefined,
      meta: `${buildRateTrendLabel(options.txHistory.value)} · 累计 ${formatSize(sortedNetworkInfo.value.reduce((sum, item) => sum + (item.tx_bytes || 0), 0))}`,
      valueStyle: {
        color: isDarkTheme.value ? '#f5f5f5' : '#111111',
        fontSize: options.isEmbeddedMonitor.value ? '11px' : '24px',
        fontWeight: 700,
      },
    },
  ]))

  const resourceHighlights = computed(() => {
    const diskPercent = primaryDisk.value?.usage || 0

    return [
      {
        key: 'cpu',
        label: 'CPU',
        icon: ThunderboltOutlined,
        percent: roundMetric(options.cpuInfo.value.usage),
        color: getCurrentProgressColor(options.cpuInfo.value.usage || 0),
        tone: getUsageTone(options.cpuInfo.value.usage || 0),
        state: getUsageLabel(options.cpuInfo.value.usage || 0),
        value: options.cpuInfo.value.usage || 0,
        suffix: '%',
        precision: 1,
        meta: monitorDisconnected.value ? '监控已停止' : (options.cpuInfo.value.cores?.length ? `${options.cpuInfo.value.cores.length} 核` : 'CPU'),
      },
      {
        key: 'memory',
        label: '内存',
        icon: DatabaseOutlined,
        percent: roundMetric(options.memoryInfo.value.usage),
        color: getCurrentProgressColor(options.memoryInfo.value.usage || 0),
        tone: getUsageTone(options.memoryInfo.value.usage || 0),
        state: getUsageLabel(options.memoryInfo.value.usage || 0),
        value: options.memoryInfo.value.usage || 0,
        suffix: '%',
        precision: 1,
        meta: monitorDisconnected.value ? '监控已停止' : `${formatSize(options.memoryInfo.value.used)} / ${formatSize(options.memoryInfo.value.total)}`,
      },
      {
        key: 'disk',
        label: '磁盘',
        icon: HddOutlined,
        percent: roundMetric(diskPercent),
        color: getCurrentProgressColor(diskPercent),
        tone: getUsageTone(diskPercent),
        state: getUsageLabel(diskPercent),
        value: diskPercent,
        suffix: '%',
        precision: 1,
        meta: monitorDisconnected.value ? '监控已停止' : (primaryDisk.value ? `可用 ${formatSize(primaryDisk.value.available)}` : '等待磁盘遥测'),
      },
    ]
  })

  const topProcesses = computed<ProcessTableRow[]>(() => (
    [...(options.processInfo.value.top || [])]
      .sort((left, right) => {
        const cpuDiff = (right.cpu_percent || 0) - (left.cpu_percent || 0)
        if (cpuDiff !== 0) return cpuDiff
        return (right.memory_kb || 0) - (left.memory_kb || 0)
      })
      .slice(0, 6)
      .map((process, index) => ({
        key: `${process.command || 'process'}-${index}`,
        rank: index + 1,
        command: process.command || '-',
        cpuPercent: process.cpu_percent || 0,
        memoryKb: process.memory_kb || 0,
      }))
  ))

  const processColumns = computed(() => (
    options.isEmbeddedMonitor.value
      ? [
          { title: '#', dataIndex: 'rank', key: 'rank', width: 44, align: 'center' as const },
          { title: '进程命令', dataIndex: 'command', key: 'command', ellipsis: true },
          { title: 'CPU', dataIndex: 'cpuPercent', key: 'cpu', width: 64, align: 'right' as const },
          { title: '内存', dataIndex: 'memoryKb', key: 'memory', width: 88, align: 'right' as const },
        ]
      : [
          { title: '#', dataIndex: 'rank', key: 'rank', width: 56, align: 'center' as const },
          { title: '进程命令', dataIndex: 'command', key: 'command', ellipsis: true },
          { title: 'CPU', dataIndex: 'cpuPercent', key: 'cpu', width: 100, align: 'right' as const },
          { title: '内存', dataIndex: 'memoryKb', key: 'memory', width: 128, align: 'right' as const },
        ]
  ))

  const dashboardAlerts = computed<MonitorAlert[]>(() => {
    if (monitorDisconnected.value) {
      return [{
        key: 'monitor-disconnected',
        type: 'warning',
        message: 'SSH 连接已断开',
        description: '系统监控已停止刷新。重新连接当前标签后将恢复实时数据。',
      }]
    }

    const alerts: MonitorAlert[] = []

    if ((options.cpuInfo.value.usage || 0) > 85) {
      alerts.push({
        key: 'cpu-high',
        type: 'error',
        message: `CPU 已升至 ${formatPercent(options.cpuInfo.value.usage)}`,
        description: '已进入高负载区间，建议优先排查占用 CPU 最高的进程。',
      })
    } else if ((options.cpuInfo.value.usage || 0) > 60) {
      alerts.push({
        key: 'cpu-warn',
        type: 'warning',
        message: `CPU 保持在 ${formatPercent(options.cpuInfo.value.usage)}`,
        description: '处于预警区间，建议结合 Top 进程继续观察。',
      })
    }

    if ((options.memoryInfo.value.usage || 0) > 85) {
      alerts.push({
        key: 'memory-high',
        type: 'error',
        message: `内存占用 ${formatPercent(options.memoryInfo.value.usage)}`,
        description: '可用内存已偏低，建议重点查看缓存与高内存进程。',
      })
    }

    if ((primaryDisk.value?.usage || 0) > 85) {
      alerts.push({
        key: 'disk-high',
        type: 'warning',
        message: `${primaryDisk.value?.mountpoint || '主磁盘'} 使用率 ${formatPercent(primaryDisk.value?.usage)}`,
        description: '磁盘空间接近上限，建议及时清理日志或扩容。',
      })
    }

    const downInterface = sortedNetworkInfo.value.find((item) => (
      isAlertableInterface(item)
      && item.status
      && item.status !== 'up'
      && item.status !== 'unknown'
    ))
    if (downInterface) {
      alerts.push({
        key: `network-${downInterface.name}`,
        type: 'info',
        message: `接口 ${downInterface.name} 当前状态为 ${downInterface.status}`,
        description: '仅对需要关注的非虚拟接口告警；如该接口应长期在线，建议检查链路或远程网络配置。',
      })
    }

    if (alerts.length === 0) {
      alerts.push({
        key: 'healthy',
        type: 'success',
        message: '当前资源状态稳定',
        description: 'CPU、内存和核心磁盘均在安全区间，监控面板未发现需要立即处理的告警。',
      })
    }

    return alerts.slice(0, 4)
  })

  const activeAlerts = computed(() => (
    dashboardAlerts.value.filter((alert) => alert.type !== 'success')
  ))

  const memorySegments = computed(() => {
    const palette = isDarkTheme.value
      ? { used: '#737373', available: '#525252', cached: '#3f3f46' }
      : { used: '#6b7280', available: '#9ca3af', cached: '#d1d5db' }
    const total = options.memoryInfo.value.total || 0
    if (!total) {
      return [
        { label: '已用', percent: 0, value: '0 B', color: palette.used },
        { label: '可用', percent: 0, value: '0 B', color: palette.available },
        { label: '缓存', percent: 0, value: '0 B', color: palette.cached },
      ]
    }

    const cached = Math.min(options.memoryInfo.value.cached || 0, total)
    const used = Math.min(options.memoryInfo.value.used || 0, total)
    const available = Math.min(options.memoryInfo.value.available || 0, Math.max(total - cached, total))

    return [
      { label: '已用', percent: toPercent(used, total), value: formatSize(used), color: palette.used },
      { label: '可用', percent: toPercent(available, total), value: formatSize(available), color: palette.available },
      { label: '缓存', percent: toPercent(cached, total), value: formatSize(cached), color: palette.cached },
    ]
  })

  return {
    canRefreshMonitor,
    sortedDiskInfo,
    hasExtraDiskInfo,
    visibleDiskInfo,
    sortedNetworkInfo,
    monitorHealthTone,
    monitorHealthLabel,
    monitorHostTitle,
    monitorSummaryText,
    lastUpdateText,
    heroStatistics,
    resourceHighlights,
    topProcesses,
    processColumns,
    activeAlerts,
    memorySegments,
    getProgressColor: getCurrentProgressColor,
    formatNetworkSpeed,
    formatPercent,
    formatProcessMemory,
    formatResourceInlineText,
    formatSize,
  }
}

function isAlertableInterface(interfaceInfo: NetworkInfo) {
  const kind = interfaceInfo.kind?.toLowerCase()
  if (kind === 'virtual' || kind === 'loopback') {
    return false
  }

  return !ignoredAlertInterfacePatterns.some((pattern) => pattern.test(interfaceInfo.name))
}

function getProgressColor(percentage: number, isDarkTheme: boolean) {
  if (isDarkTheme) {
    if (percentage <= 60) return '#6b7280'
    if (percentage <= 85) return '#8a6a2a'
    return '#7a3a3a'
  }

  if (percentage <= 60) return '#9ca3af'
  if (percentage <= 85) return '#d4a24a'
  return '#c06b6b'
}

function formatSize(bytes?: number) {
  return formatBytes(bytes || 0)
}

function formatNetworkSpeed(bytesPerSecond?: number) {
  return formatTransferSpeed(bytesPerSecond || 0)
}

function formatCompactNetworkSpeed(bytesPerSecond?: number) {
  return formatTransferSpeed(bytesPerSecond || 0).replace(/\s+/g, '')
}

function formatPercent(value?: number) {
  return `${roundMetric(value)}%`
}

function formatProcessMemory(memoryKb?: number) {
  return formatSize((memoryKb || 0) * 1024)
}

function formatResourceInlineText(meta: string) {
  return meta.replace(/\s+/g, ' ').trim()
}

function getUsageTone(percentage: number) {
  if (percentage > 85) return 'danger'
  if (percentage > 60) return 'warning'
  return 'healthy'
}

function getUsageLabel(percentage: number) {
  if (percentage > 85) return '高压'
  if (percentage > 60) return '预警'
  return '健康'
}

function roundMetric(value?: number) {
  return Math.round((value || 0) * 10) / 10
}

function toPercent(value: number, total: number) {
  if (!total) return 0
  return Math.max(0, Math.min(100, (value / total) * 100))
}

function buildRateTrendLabel(history: number[]) {
  if (history.length < 2) return '等待趋势数据'

  const previous = history[history.length - 2] || 0
  const current = history[history.length - 1] || 0
  const diff = current - previous

  if (Math.abs(diff) < 1024) return '吞吐基本持平'
  const absDiff = Math.abs(diff)
  return diff > 0 ? `较上次 +${formatSize(absDiff)}/s` : `较上次 -${formatSize(absDiff)}/s`
}

function formatCompactUptime(seconds?: number) {
  if (!seconds) return '-'

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) {
    return `${days}天${hours}时`
  }

  if (hours > 0) {
    return `${hours}时${minutes}分`
  }

  return `${minutes}分`
}
