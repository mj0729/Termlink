<template>
  <div class="right-panel" :class="[`right-panel--${activeTab}`, `right-panel--${placement}`, { 'right-panel--embedded': embedded }]">
    <!-- 内容区 - 可折叠，在左侧 -->
    <div class="panel-content-wrapper" :class="{ collapsed: collapsed }">
      <!-- 系统监控内容 -->
      <div class="panel-content monitor-content" v-if="activeTab === 'monitor'">
        <div class="monitor-dashboard">
          <a-card :bordered="false" class="dashboard-hero-card">
            <div class="dashboard-hero">
              <div class="dashboard-hero__copy">
                <div class="dashboard-hero__title-row">
                  <h3>{{ monitorHostTitle }}</h3>
                  <span v-if="!isEmbeddedMonitor" class="dashboard-health-pill" :class="`is-${monitorHealthTone}`">
                    {{ monitorHealthLabel }}
                  </span>
                </div>
                <p>{{ monitorSummaryText }}</p>
              </div>

              <div class="dashboard-hero__toolbar">
                <div class="dashboard-hero__toolbar-actions">
                  <a-button
                    type="text"
                    size="small"
                    class="collapse-btn"
                    title="收起系统监控"
                    @click="$emit('toggle')"
                  >
                    <LeftOutlined v-if="placement === 'left'" />
                    <RightOutlined v-else />
                  </a-button>
                  <a-button type="primary" size="small" class="hero-refresh-btn" title="手动刷新" :disabled="!canRefreshMonitor" @click="refreshData">
                    <ReloadOutlined />
                  </a-button>
                </div>
                <div class="dashboard-hero__toolbar-meta">
                  <span class="dashboard-hero__timestamp">{{ lastUpdateText }}</span>
                </div>
              </div>
            </div>

            <div class="dashboard-kpi-grid">
              <div
                v-for="item in heroStatistics"
                :key="item.key"
                class="dashboard-kpi"
                :class="`dashboard-kpi--${item.key}`"
              >
                <span class="dashboard-kpi__label">{{ item.label }}</span>
                <a-statistic
                  :value="item.value"
                  :precision="item.precision"
                  :suffix="item.suffix"
                  :value-style="item.valueStyle"
                />
                <span v-if="!isEmbeddedMonitor" class="dashboard-kpi__meta">{{ item.meta }}</span>
              </div>
            </div>

            <div class="hero-summary-memory">
              <div class="hero-summary-memory__head">
                <span>内存构成</span>
                <strong>{{ formatSize(memoryInfo.used) }} / {{ formatSize(memoryInfo.total) }}</strong>
              </div>
              <a-tooltip v-if="isEmbeddedMonitor" placement="topLeft" overlay-class-name="memory-composition-tooltip">
                <template #title>
                  <div class="memory-composition__tooltip">
                    <div v-for="segment in memorySegments" :key="`${segment.label}-tooltip`" class="memory-composition__tooltip-item">
                      <span class="memory-legend-item__dot" :style="{ background: segment.color }"></span>
                      <span>{{ segment.label }}</span>
                      <strong>{{ segment.value }}</strong>
                    </div>
                  </div>
                </template>
                <div class="memory-composition__bar memory-composition__bar--interactive">
                  <span
                    v-for="segment in memorySegments"
                    :key="segment.label"
                    class="memory-composition__segment"
                    :style="{ width: `${segment.percent}%`, background: segment.color }"
                  ></span>
                </div>
              </a-tooltip>
              <div v-else class="memory-composition__bar">
                <span
                  v-for="segment in memorySegments"
                  :key="segment.label"
                  class="memory-composition__segment"
                  :style="{ width: `${segment.percent}%`, background: segment.color }"
                ></span>
              </div>
              <div v-if="!isEmbeddedMonitor" class="hero-summary-memory__legend">
                <div
                  v-for="segment in memorySegments"
                  :key="segment.label"
                  class="hero-summary-memory__legend-item"
                  :style="{ '--memory-segment-color': segment.color }"
                >
                  <span class="memory-legend-item__dot" :style="{ background: segment.color }"></span>
                  <span>{{ segment.label }}</span>
                  <strong v-if="!isEmbeddedMonitor">{{ segment.value }}</strong>
                </div>
              </div>
            </div>

            <div v-if="activeAlerts.length" class="hero-alert-strip">
              <div class="hero-alert-strip__header">
                <strong>告警</strong>
                <span>{{ activeAlerts.length }} 条</span>
              </div>
              <div class="hero-alert-strip__list">
                <div
                  v-for="alert in activeAlerts"
                  :key="alert.key"
                  class="hero-alert-strip__item"
                  :class="`is-${alert.type}`"
                >
                  <span class="hero-alert-strip__message">{{ alert.message }}</span>
                  <span class="hero-alert-strip__description">{{ alert.description }}</span>
                </div>
              </div>
            </div>
          </a-card>

          <div class="dashboard-stack">
            <a-card :bordered="false" class="dashboard-card">
              <div class="dashboard-section-head">
                <div>
                  <h4>关键资源</h4>
                </div>
              </div>

              <div class="resource-highlight-list">
                <div
                  v-for="metric in resourceHighlights"
                  :key="metric.key"
                  class="resource-highlight-row"
                  :class="`resource-highlight-row--${metric.key}`"
                >
                  <div class="resource-highlight-row__main">
                    <div class="resource-highlight-row__label">
                      <span class="resource-highlight-row__name">
                        <component :is="metric.icon" class="resource-highlight-row__icon" />
                        {{ metric.label }}
                      </span>
                      <template v-if="!isEmbeddedMonitor">
                        <span class="resource-highlight-row__tone" :class="`is-${metric.tone}`">
                          {{ metric.state }}
                        </span>
                        <span class="resource-highlight-row__meta">{{ metric.meta }}</span>
                      </template>
                    </div>

                    <div v-if="!isEmbeddedMonitor" class="resource-highlight-row__value">
                      <a-statistic
                        :value="metric.value"
                        :precision="metric.precision"
                        :suffix="metric.suffix"
                        :value-style="{ color: metric.color, fontSize: '20px', fontWeight: 700 }"
                      />
                    </div>
                  </div>

                  <div class="resource-highlight-row__footer" :class="{ 'resource-highlight-row__footer--compact': isEmbeddedMonitor }">
                    <template v-if="isEmbeddedMonitor">
                      <div class="resource-highlight-row__inline-progress">
                        <a-progress
                          class="resource-highlight-row__progress resource-highlight-row__progress--compact"
                          :percent="metric.percent"
                          :show-info="false"
                          :stroke-color="metric.color"
                          :stroke-width="14"
                        />
                        <div class="resource-highlight-row__inline-meta">
                          <span class="resource-highlight-row__inline-percent">{{ formatPercent(metric.value) }}</span>
                          <span class="resource-highlight-row__inline-detail">{{ formatResourceInlineText(metric.meta) }}</span>
                        </div>
                      </div>
                    </template>
                    <a-progress
                      v-else
                      class="resource-highlight-row__progress"
                      :percent="metric.percent"
                      :show-info="false"
                      :stroke-color="metric.color"
                      :stroke-width="8"
                    />
                  </div>
                </div>
              </div>
            </a-card>

            <a-card :bordered="false" class="dashboard-card">
              <div class="dashboard-section-head dashboard-section-head--inline-meta">
                <div>
                  <h4>Top 进程</h4>
                </div>
                <div class="process-summary-chips">
                  <span class="process-summary-chip">运行 {{ processInfo.running || 0 }}</span>
                  <span class="process-summary-chip">休眠 {{ processInfo.sleeping || 0 }}</span>
                </div>
              </div>

              <a-table
                class="process-table"
                :columns="processColumns"
                :data-source="topProcesses"
                :pagination="false"
                size="small"
              >
                <template #bodyCell="{ column, record, text }">
                  <template v-if="column.key === 'rank'">
                    <span class="process-rank">{{ text }}</span>
                  </template>
                  <template v-else-if="column.key === 'cpu'">
                    <span class="process-value process-value--cpu">{{ formatPercent(record.cpuPercent) }}</span>
                  </template>
                  <template v-else-if="column.key === 'memory'">
                    <span class="process-value">{{ formatProcessMemory(record.memoryKb) }}</span>
                  </template>
                  <template v-else-if="column.key === 'command'">
                    <span class="process-command" :title="record.command">{{ record.command }}</span>
                  </template>
                </template>
              </a-table>
            </a-card>
          </div>

          <div class="dashboard-bottom-grid">
            <a-card :bordered="false" class="dashboard-card">
              <div class="dashboard-section-head dashboard-section-head--with-action">
                <div>
                  <h4>磁盘容量</h4>
                </div>
                <a-button
                  v-if="hasExtraDiskInfo"
                  type="text"
                  size="small"
                  class="section-action-btn"
                  @click="showAllDisks = !showAllDisks"
                >
                  {{ showAllDisks ? '收起' : `更多 ${sortedDiskInfo.length - 2}` }}
                </a-button>
              </div>

              <div class="disk-grid">
                <div
                  v-for="disk in visibleDiskInfo"
                  :key="`${disk.device}-${disk.mountpoint}`"
                  class="disk-card"
                >
                  <div v-if="isEmbeddedMonitor" class="disk-card__compact">
                    <div class="disk-card__compact-head">
                      <strong class="disk-card__mountpoint" :title="disk.mountpoint || '-'">{{ disk.mountpoint || '-' }}</strong>
                      <span class="disk-card__percent" :style="{ color: getProgressColor(disk.usage || 0) }">
                        {{ formatPercent(disk.usage) }}
                      </span>
                    </div>
                    <div class="disk-card__compact-meta">
                      <span class="disk-card__device" :title="disk.device">{{ disk.device }}</span>
                      <span class="disk-card__summary" :title="`已用 ${formatSize(disk.used)} · 可用 ${formatSize(disk.available)} · ${disk.filesystem || '-'}`">
                        已用 {{ formatSize(disk.used) }} · 可用 {{ formatSize(disk.available) }} · {{ disk.filesystem || '-' }}
                      </span>
                    </div>
                  </div>
                  <div v-else class="disk-card__row">
                    <div class="disk-card__identity">
                      <strong>{{ disk.mountpoint || '-' }}</strong>
                      <span>{{ disk.device }}</span>
                    </div>
                    <div class="disk-card__usage">
                      <span class="disk-card__percent" :style="{ color: getProgressColor(disk.usage || 0) }">
                        {{ formatPercent(disk.usage) }}
                      </span>
                      <span class="disk-card__summary">
                        已用 {{ formatSize(disk.used) }} · 可用 {{ formatSize(disk.available) }} · {{ disk.filesystem || '-' }}
                      </span>
                    </div>
                  </div>

                  <a-progress
                    :percent="disk.usage || 0"
                    :show-info="false"
                    :stroke-color="getProgressColor(disk.usage || 0)"
                    :stroke-width="10"
                  />

                </div>
              </div>
            </a-card>

            <a-card :bordered="false" class="dashboard-card">
              <div class="dashboard-section-head dashboard-section-head--inline-meta">
                <div>
                  <h4>网络接口</h4>
                </div>
                <span class="dashboard-section-head__meta">{{ sortedNetworkInfo.length }} 个接口</span>
              </div>

              <div class="interface-grid">
                <div
                  v-for="interface_ in sortedNetworkInfo"
                  :key="interface_.name"
                  class="interface-card"
                >
                  <div class="interface-card__row">
                    <div class="interface-card__identity">
                      <strong>{{ interface_.name }}</strong>
                      <span>{{ interface_.ip || '未分配 IP' }}</span>
                    </div>
                    <div class="interface-card__live">
                      <span class="interface-card__metric">
                        ↓ {{ formatNetworkSpeed(interface_.rx_speed || 0) }}
                      </span>
                      <span class="interface-card__metric">
                        ↑ {{ formatNetworkSpeed(interface_.tx_speed || 0) }}
                      </span>
                      <span class="dense-inline-pill" :class="{ 'is-active': interface_.status === 'up' }">
                        {{ interface_.status || 'unknown' }}
                      </span>
                    </div>
                  </div>

                  <div class="interface-card__totals">
                    <span>↓累计 {{ formatSize(interface_.rx_bytes) }}</span>
                    <span>↑累计 {{ formatSize(interface_.tx_bytes) }}</span>
                  </div>
                </div>
              </div>
            </a-card>
          </div>
        </div>
      </div>
    
    <!-- 传输管理内容 -->
      <div class="panel-content download-content" v-if="activeTab === 'download'">
      <div class="transfer-toolbar" v-if="transfers.length > 0">
        <a-segmented
          v-model:value="transferFilter"
          class="transfer-filter"
          :options="transferFilterOptions"
        />
      </div>

      <div v-if="visibleTransferGroups.length === 0" class="empty-state">
        <a-empty description="暂无传输任务" />
      </div>
      
      <div v-else class="download-list">
        <div 
          v-for="group in visibleTransferGroups" 
          :key="group.id"
          class="download-item"
          :class="{ 
            completed: group.status === 'completed', 
            error: group.status === 'error' 
          }"
        >
          <div class="download-info">
            <div class="file-name-row">
              <component
                :is="group.direction === 'download' ? DownloadOutlined : UploadOutlined"
                class="file-direction-icon"
              />
              <div class="file-name">{{ group.label }}</div>
              <span class="direction-badge">{{ group.direction === 'download' ? '下载' : '上传' }}</span>
              <span v-if="group.count > 1" class="direction-badge">{{ group.count }} 项</span>
            </div>
            <div class="file-path"><span class="file-path__label">来源</span>{{ group.sourceLabel }}</div>
            <div class="file-path"><span class="file-path__label">目标</span>{{ group.targetLabel }}</div>
            <div v-if="group.note" class="transfer-note">{{ group.note }}</div>
            
            <!-- 进度条 -->
            <a-progress 
              v-if="group.status === 'running'"
              :percent="group.progress" 
              size="small"
              :show-info="false"
            />
            
            <!-- 状态信息 -->
            <div class="download-status">
              <span v-if="group.status === 'running'">
                <template v-if="group.total > 0">
                  {{ group.direction === 'download' ? '下载中' : '上传中' }} -
                  {{ formatSize(group.transferred) }} / {{ formatSize(group.total) }}
                  <span v-if="group.progress > 0">({{ group.progress }}%)</span>
                  <span v-if="group.speed > 0"> - {{ formatSpeed(group.speed) }}</span>
                </template>
                <template v-else>
                  {{ group.direction === 'download' ? '正在下载...' : '正在上传...' }}
                </template>
              </span>
              <span v-else-if="group.status === 'completed'" class="success">
                {{ group.direction === 'download' ? '下载完成' : '上传完成' }}
                <span v-if="group.total > 0"> - {{ formatSize(group.total) }}</span>
              </span>
              <span v-else-if="group.status === 'error'" class="error">
                失败: {{ group.error }}
              </span>
              <span v-else-if="group.status === 'cancelled'">
                已取消
              </span>
              <span v-else-if="group.status === 'skipped'">
                已跳过
              </span>
            </div>
          </div>
          
          <div class="download-actions">
            <a-button 
              v-if="group.status === 'running'"
              type="text" 
              size="small" 
              danger
              @click="cancelTransferGroup(group.id)"
              title="取消"
            >
              <StopOutlined />
            </a-button>
            
            <a-button 
              v-if="group.status === 'completed' && group.direction === 'download' && group.count === 1"
              type="text" 
              size="small"
              @click="openFileLocation(group.items[0].targetPath)"
              title="打开"
            >
              <FolderOpenOutlined />
            </a-button>

            <a-button
              v-if="group.status === 'error'"
              type="text"
              size="small"
              @click="retryTransferGroup(group.id)"
              title="重试"
            >
              <ReloadOutlined />
            </a-button>
            
            <a-button 
              type="text" 
              size="small" 
              danger
              @click="removeTransferGroup(group.id)"
              title="移除"
            >
              <DeleteOutlined />
            </a-button>
          </div>
        </div>
      </div>
      
      <div class="download-footer" v-if="transfers.length > 0">
        <a-button size="small" @click="clearCompleted">
          清除已完成
        </a-button>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, ref, shallowRef, onMounted, onUnmounted, watch } from 'vue'
import { 
  ThunderboltOutlined,
  DatabaseOutlined,
  HddOutlined,
  DownloadOutlined,
  UploadOutlined,
  StopOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
  ReloadOutlined,
  LeftOutlined,
  RightOutlined
} from '@antdv-next/icons'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type {
  DownloadRequest,
  DownloadProgressPayload,
  MonitorTab,
  ProcessInfo,
  SshProfile,
  SystemInfoBatch,
  SystemStaticInfo,
  CpuInfo,
  MemoryInfo,
  DiskInfo,
  NetworkInfo,
  TransferItem,
  UploadProgressPayload,
  UploadRequest,
} from '../types/app'

type TransferFilter = 'all' | 'download' | 'upload' | 'running' | 'completed' | 'error'
type UploadConflictAction = 'overwrite' | 'rename' | 'skip'

interface TransferTask extends TransferItem {
  downloadRequest?: DownloadRequest
  uploadRequest?: UploadRequest
  note?: string
  lastProgressAt?: number
  lastTransferred?: number
}

interface TransferGroup {
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

interface MonitorAlert {
  key: string
  type: 'success' | 'info' | 'warning' | 'error'
  message: string
  description: string
}

interface ProcessTableRow {
  key: string
  rank: number
  command: string
  cpuPercent: number
  memoryKb: number
}

const props = withDefaults(defineProps<{
  collapsed?: boolean
  connectionId?: string
  sshProfile?: SshProfile | null
  activeTab?: MonitorTab
  placement?: 'right' | 'left'
  embedded?: boolean
}>(), {
  collapsed: false,
  connectionId: '',
  sshProfile: null,
  activeTab: 'monitor',
  placement: 'right',
  embedded: false,
})

const emit = defineEmits(['toggle', 'tab-change'])

// 状态数据 - 使用 shallowRef 避免大对象深度代理开销
const systemInfo = shallowRef<SystemStaticInfo>({})
const cpuInfo = shallowRef<CpuInfo>({})
const memoryInfo = shallowRef<MemoryInfo>({})
const diskInfo = shallowRef<DiskInfo[]>([])
const networkInfo = shallowRef<NetworkInfo[]>([])
const processInfo = shallowRef<ProcessInfo>({})
const showAllDisks = ref(false)
const lastUpdate = ref<number | null>(null)
const cpuHistory = ref<number[]>([])
const memoryHistory = ref<number[]>([])
const diskHistory = ref<number[]>([])
const rxHistory = ref<number[]>([])
const txHistory = ref<number[]>([])
const historyLimit = 18

// 下载管理状态
const activeTab = ref<MonitorTab>(props.activeTab)
const isEmbeddedMonitor = computed(() => props.embedded && activeTab.value === 'monitor')
const transfers = ref<TransferTask[]>([])
const transferFilter = ref<TransferFilter>('all')
let transferIdCounter = 0
let downloadProgressUnlisten: (() => void) | null = null
let uploadProgressUnlisten: (() => void) | null = null

let refreshTimer: ReturnType<typeof setTimeout> | null = null
let refreshInterval = 3000 // 初始刷新间隔3秒
const minInterval = 3000 // 最小间隔3秒
const maxInterval = 30000 // 最大间隔30秒
let errorCount = 0

const transferFilterOptions: Array<{ label: string; value: TransferFilter }> = [
  { label: '全部', value: 'all' },
  { label: '下载', value: 'download' },
  { label: '上传', value: 'upload' },
  { label: '进行中', value: 'running' },
  { label: '失败', value: 'error' },
  { label: '完成', value: 'completed' },
]

const transferStats = computed(() => ({
  running: transfers.value.filter((item) => item.status === 'running').length,
  completed: transfers.value.filter((item) => item.status === 'completed').length,
  error: transfers.value.filter((item) => item.status === 'error').length,
}))

const sortedDiskInfo = computed(() => (
  [...diskInfo.value].sort((left, right) => {
    const usageDiff = (right.usage || 0) - (left.usage || 0)
    if (usageDiff !== 0) return usageDiff

    const availableDiff = (left.available || 0) - (right.available || 0)
    if (availableDiff !== 0) return availableDiff

    return (left.mountpoint || left.device || '').localeCompare(right.mountpoint || right.device || '')
  })
))

const hasExtraDiskInfo = computed(() => sortedDiskInfo.value.length > 2)
const visibleDiskInfo = computed(() => (
  showAllDisks.value ? sortedDiskInfo.value : sortedDiskInfo.value.slice(0, 2)
))

const primaryDisk = computed(() => (
  sortedDiskInfo.value.find((disk) => disk.mountpoint === '/') || sortedDiskInfo.value[0] || null
))

const sortedNetworkInfo = computed(() => (
  [...networkInfo.value].sort((left, right) => {
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
  cpuInfo.value.usage || 0,
  memoryInfo.value.usage || 0,
  primaryDisk.value?.usage || 0,
))

const monitorDisconnected = computed(() => Boolean(props.sshProfile) && !props.connectionId)
const canRefreshMonitor = computed(() => !monitorDisconnected.value && Boolean(props.connectionId))

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
  systemInfo.value.hostname ||
  props.sshProfile?.name ||
  props.sshProfile?.host ||
  '当前主机'
))

const monitorSummaryText = computed(() => {
  if (monitorDisconnected.value && props.sshProfile?.host) {
    return `与 ${props.sshProfile.host} 的 SSH 连接已断开，监控已停止刷新`
  }

  const summary = [
    systemInfo.value.os,
    systemInfo.value.arch,
    systemInfo.value.kernel,
  ].filter(Boolean)

  if (summary.length > 0) {
    return summary.join(' · ')
  }

  if (props.sshProfile?.host) {
    return `已连接 ${props.sshProfile.host}`
  }

  return '等待系统遥测...'
})

const lastUpdateText = computed(() => (
  monitorDisconnected.value
    ? '连接已断开'
    : lastUpdate.value
      ? `最近刷新 ${new Date(lastUpdate.value).toLocaleTimeString('zh-CN', { hour12: false })}`
      : '等待首帧数据'
))

const heroStatistics = computed(() => ([
  {
    key: 'uptime',
    label: isEmbeddedMonitor.value ? '运行' : '系统运行时间',
    value: formatUptime(systemInfo.value.uptime),
    precision: undefined,
    suffix: undefined,
    meta: monitorDisconnected.value ? '连接已断开' : `刷新间隔 ${Math.round(refreshInterval / 1000)}s`,
    valueStyle: { color: '#1890ff', fontSize: '24px', fontWeight: 700 },
  },
  {
    key: 'rx',
    label: isEmbeddedMonitor.value ? '下行' : '下行吞吐',
    value: formatNetworkSpeed(networkAggregate.value.rx),
    precision: undefined,
    suffix: undefined,
    meta: `${buildRateTrendLabel(rxHistory.value)} · 累计 ${formatSize(sortedNetworkInfo.value.reduce((sum, item) => sum + (item.rx_bytes || 0), 0))}`,
    valueStyle: { color: '#52c41a', fontSize: '24px', fontWeight: 700 },
  },
  {
    key: 'tx',
    label: isEmbeddedMonitor.value ? '上行' : '上行吞吐',
    value: formatNetworkSpeed(networkAggregate.value.tx),
    precision: undefined,
    suffix: undefined,
    meta: `${buildRateTrendLabel(txHistory.value)} · 累计 ${formatSize(sortedNetworkInfo.value.reduce((sum, item) => sum + (item.tx_bytes || 0), 0))}`,
    valueStyle: { color: '#faad14', fontSize: '24px', fontWeight: 700 },
  },
]))

const resourceHighlights = computed(() => {
  const diskPercent = primaryDisk.value?.usage || 0

  return [
    {
      key: 'cpu',
      label: 'CPU',
      icon: ThunderboltOutlined,
      percent: roundMetric(cpuInfo.value.usage),
      color: getProgressColor(cpuInfo.value.usage || 0),
      tone: getUsageTone(cpuInfo.value.usage || 0),
      state: getUsageLabel(cpuInfo.value.usage || 0),
      value: cpuInfo.value.usage || 0,
      suffix: '%',
      precision: 1,
      meta: monitorDisconnected.value ? '监控已停止' : (cpuInfo.value.cores?.length ? `${cpuInfo.value.cores.length} 核` : 'CPU'),
    },
    {
      key: 'memory',
      label: '内存',
      icon: DatabaseOutlined,
      percent: roundMetric(memoryInfo.value.usage),
      color: getProgressColor(memoryInfo.value.usage || 0),
      tone: getUsageTone(memoryInfo.value.usage || 0),
      state: getUsageLabel(memoryInfo.value.usage || 0),
      value: memoryInfo.value.usage || 0,
      suffix: '%',
      precision: 1,
      meta: monitorDisconnected.value ? '监控已停止' : `${formatSize(memoryInfo.value.used)} / ${formatSize(memoryInfo.value.total)}`,
    },
    {
      key: 'disk',
      label: '磁盘',
      icon: HddOutlined,
      percent: roundMetric(diskPercent),
      color: getProgressColor(diskPercent),
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
  [...(processInfo.value.top || [])]
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
  isEmbeddedMonitor.value
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

  if ((cpuInfo.value.usage || 0) > 85) {
    alerts.push({
      key: 'cpu-high',
      type: 'error',
      message: `CPU 已升至 ${formatPercent(cpuInfo.value.usage)}`,
      description: '已进入高负载区间，建议优先排查占用 CPU 最高的进程。',
    })
  } else if ((cpuInfo.value.usage || 0) > 60) {
    alerts.push({
      key: 'cpu-warn',
      type: 'warning',
      message: `CPU 保持在 ${formatPercent(cpuInfo.value.usage)}`,
      description: '处于预警区间，建议结合 Top 进程继续观察。',
    })
  }

  if ((memoryInfo.value.usage || 0) > 85) {
    alerts.push({
      key: 'memory-high',
      type: 'error',
      message: `内存占用 ${formatPercent(memoryInfo.value.usage)}`,
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

  const downInterface = sortedNetworkInfo.value.find((item) => item.status && item.status !== 'up')
  if (downInterface) {
    alerts.push({
      key: `network-${downInterface.name}`,
      type: 'info',
      message: `接口 ${downInterface.name} 当前状态为 ${downInterface.status}`,
      description: '如该接口应长期在线，建议检查链路或远程网络配置。',
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
  const total = memoryInfo.value.total || 0
  if (!total) {
    return [
      { label: '已用', percent: 0, value: '0 B', color: '#1890ff' },
      { label: '可用', percent: 0, value: '0 B', color: '#52c41a' },
      { label: '缓存', percent: 0, value: '0 B', color: '#faad14' },
    ]
  }

  const cached = Math.min(memoryInfo.value.cached || 0, total)
  const used = Math.min(memoryInfo.value.used || 0, total)
  const available = Math.min(memoryInfo.value.available || 0, Math.max(total - cached, total))

  return [
    { label: '已用', percent: toPercent(used, total), value: formatSize(used), color: '#1890ff' },
    { label: '可用', percent: toPercent(available, total), value: formatSize(available), color: '#52c41a' },
    { label: '缓存', percent: toPercent(cached, total), value: formatSize(cached), color: '#faad14' },
  ]
})

const transferGroups = computed<TransferGroup[]>(() => {
  const map = new Map<string, TransferTask[]>()

  for (const transfer of transfers.value) {
    const key = transfer.batchId || `${transfer.direction}-${transfer.id}`
    const group = map.get(key)
    if (group) {
      group.push(transfer)
    } else {
      map.set(key, [transfer])
    }
  }

  return Array.from(map.entries())
    .map(([id, items]) => buildTransferGroup(id, items))
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

function getTransferTask(transferId: number) {
  return transfers.value.find((item) => item.id === transferId) || null
}

function appendHistory(series: { value: number[] }, metric: number) {
  if (!Number.isFinite(metric)) return
  const nextValue = roundMetric(metric)
  series.value = [...series.value.slice(-(historyLimit - 1)), nextValue]
}

function resetMonitorDerivedState() {
  lastUpdate.value = null
  cpuHistory.value = []
  memoryHistory.value = []
  diskHistory.value = []
  rxHistory.value = []
  txHistory.value = []
  showAllDisks.value = false
}

function recordMonitorSnapshot(batchInfo: SystemInfoBatch) {
  appendHistory(cpuHistory, batchInfo.cpu.usage || 0)
  appendHistory(memoryHistory, batchInfo.memory.usage || 0)
  appendHistory(diskHistory, batchInfo.disk.find((disk) => disk.mountpoint === '/')?.usage || batchInfo.disk[0]?.usage || 0)
  appendHistory(rxHistory, batchInfo.network.reduce((sum, item) => sum + (item.rx_speed || 0), 0))
  appendHistory(txHistory, batchInfo.network.reduce((sum, item) => sum + (item.tx_speed || 0), 0))
  lastUpdate.value = Date.now()
}

// 监控数据刷新
async function refreshData() {
  if (!props.connectionId) return
  
  const startTime = Date.now()
  
  try {
    // 使用批量命令一次性获取所有系统信息，大幅减少SSH请求次数
    const batchInfo = await invoke<SystemInfoBatch>('get_all_system_info_batch', { connectionId: props.connectionId })
    
    // 更新所有数据
    if (batchInfo.system.hostname) systemInfo.value = batchInfo.system
    if (batchInfo.cpu.usage !== undefined) cpuInfo.value = batchInfo.cpu
    if (batchInfo.memory.total) memoryInfo.value = batchInfo.memory
    if (batchInfo.disk.length > 0) diskInfo.value = batchInfo.disk
    if (batchInfo.network.length > 0) networkInfo.value = batchInfo.network
    processInfo.value = batchInfo.process
    recordMonitorSnapshot(batchInfo)
    
    errorCount = 0 // 重置错误计数
    
    // 成功后减少刷新间隔（更频繁），但不低于最小值
    refreshInterval = Math.max(minInterval, refreshInterval * 0.95)
    
    const elapsed = Date.now() - startTime
    console.log(`系统监控刷新完成，耗时: ${elapsed}ms，下次刷新间隔: ${refreshInterval}ms`)
    
  } catch (error) {
    console.error('获取系统信息失败:', error)
    errorCount++
    const errorText = String(error)
    const connectionMissing = !props.connectionId || errorText.includes('SSH连接不存在') || errorText.includes('未找到')

    if (connectionMissing) {
      stopAutoRefresh()
      return
    }

    message.error('获取系统信息失败: ' + error)
    
    // 错误时增加刷新间隔（降低频率）
    refreshInterval = Math.min(maxInterval, refreshInterval * 2.0)
  }
}

// 自动刷新
function startAutoRefresh() {
  stopAutoRefresh()

  if (!props.connectionId || props.collapsed) {
    return
  }
  
  function scheduleNext() {
    refreshTimer = setTimeout(async () => {
      if (!props.collapsed && props.connectionId) {
        await refreshData()
        // 只有在刷新成功后才会继续调度下一次
        if (!props.collapsed && props.connectionId) {
          scheduleNext() // 递归调度下一次刷新
        }
      }
    }, refreshInterval)
  }

  refreshData()
    .catch(() => {})
    .finally(() => {
      if (!props.collapsed && props.connectionId) {
        scheduleNext()
      }
    })
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
}

// 格式化文件大小
function formatSize(bytes?: number) {
  if (!bytes || bytes === 0) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

// 格式化运行时间
function formatUptime(seconds?: number) {
  if (!seconds) return '-'
  
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) {
    return `${days}天 ${hours}小时`
  } else if (hours > 0) {
    return `${hours}小时 ${minutes}分钟`
  } else {
    return `${minutes}分钟`
  }
}

// 获取进度条颜色
function getProgressColor(percentage: number) {
  if (percentage <= 60) return '#52c41a'
  if (percentage <= 85) return '#faad14'
  return '#f5222d'
}

function formatSpeed(bytesPerSecond: number) {
  return `${formatSize(bytesPerSecond)}/s`
}

function formatNetworkSpeed(bytesPerSecond?: number) {
  return formatSpeed(bytesPerSecond || 0)
}

function formatPercent(value?: number) {
  return `${roundMetric(value)}%`
}

function formatResourceInlineText(meta: string) {
  return meta.replace(/\s+/g, ' ').trim()
}

function roundMetric(value?: number) {
  return Math.round((value || 0) * 10) / 10
}

function toPercent(value: number, total: number) {
  if (!total) return 0
  return Math.max(0, Math.min(100, (value / total) * 100))
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

function buildRateTrendLabel(history: number[]) {
  if (history.length < 2) return '等待趋势数据'

  const previous = history[history.length - 2] || 0
  const current = history[history.length - 1] || 0
  const diff = current - previous

  if (Math.abs(diff) < 1024) return '吞吐基本持平'
  const absDiff = Math.abs(diff)
  return diff > 0 ? `较上次 +${formatSize(absDiff)}/s` : `较上次 -${formatSize(absDiff)}/s`
}

function formatProcessMemory(memoryKb?: number) {
  return formatSize((memoryKb || 0) * 1024)
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

  const progress = total > 0 ? Math.round((transferred / total) * 100) : (status === 'completed' ? 100 : 0)
  const note = items.map((item) => item.note).find(Boolean) || ''
  const error = items.map((item) => item.error).find(Boolean) || null

  return {
    id,
    direction: first.direction,
    status,
    label: count > 1 ? (first.batchLabel || `批量${first.direction === 'download' ? '下载' : '上传'} (${count}项)`) : first.fileName,
    sourceLabel: count > 1 ? `${count} 个来源` : first.sourcePath,
    targetLabel: count > 1 ? `${count} 个目标` : first.targetPath,
    note,
    error,
    progress,
    transferred,
    total,
    speed,
    count,
    items,
  }
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

async function resolveDownloadTarget(request: DownloadRequest) {
  const resolvedPath = await invoke<string>('resolve_local_target_path', {
    path: request.savePath,
  })

  return {
    targetPath: resolvedPath,
    note: resolvedPath !== request.savePath ? '检测到同名本地文件，已自动重命名' : '',
  }
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

function promptUploadConflictAction(request: UploadRequest): Promise<UploadConflictAction> {
  return new Promise((resolve) => {
    let settled = false
    let modalInstance: { destroy: () => void } | null = null
    const contentStyle = 'display:grid;gap:8px;line-height:1.6;'
    const pathStyle = 'padding:10px 12px;border-radius:10px;background:rgba(15,23,42,.06);color:var(--text-color);font-family:"SFMono-Regular","JetBrains Mono",Consolas,monospace;font-size:12px;word-break:break-all;'
    const descStyle = 'color:var(--muted-color);font-size:13px;'
    const footerStyle = 'display:flex;justify-content:flex-end;gap:8px;width:100%;'
    const baseButtonStyle = 'min-width:88px;height:32px;border-radius:8px;font-size:13px;cursor:pointer;transition:all .2s ease;padding:0 14px;'
    const finish = (action: UploadConflictAction) => {
      if (settled) return
      settled = true
      modalInstance?.destroy()
      resolve(action)
    }

    modalInstance = Modal.confirm({
      title: '发现同名远程文件',
      content: h('div', { style: contentStyle }, [
        h('div', { style: pathStyle }, request.targetPath),
        h('div', { style: descStyle }, `请选择如何处理“${request.fileName}”`),
      ]),
      okCancel: false,
      closable: false,
      maskClosable: false,
      keyboard: false,
      footer: () => h('div', { style: footerStyle }, [
        h('button', {
          type: 'button',
          style: `${baseButtonStyle}border:1px solid rgba(148,163,184,.38);background:#fff;color:var(--text-color);`,
          onClick: () => finish('skip'),
        }, '跳过'),
        h('button', {
          type: 'button',
          style: `${baseButtonStyle}border:1px solid rgba(59,130,246,.24);background:rgba(59,130,246,.08);color:var(--text-color);`,
          onClick: () => finish('rename'),
        }, '自动重命名'),
        h('button', {
          type: 'button',
          style: `${baseButtonStyle}border:1px solid var(--primary-color);background:var(--primary-color);color:#fff;`,
          onClick: () => finish('overwrite'),
        }, '覆盖'),
      ]),
      onClose: () => finish('skip'),
    })
  })
}

// 生命周期
onMounted(async () => {
  downloadProgressUnlisten = await listen<DownloadProgressPayload>('download-progress', (event) => {
    const { downloadId, downloaded, total, progress } = event.payload
    const transfer = transfers.value.find(item => item.id === downloadId && item.direction === 'download')
    if (transfer && transfer.status === 'running') {
      updateTransferMetrics(transfer, downloaded, total, progress)
    }
  })

  uploadProgressUnlisten = await listen<UploadProgressPayload>('upload-progress', (event) => {
    const { uploadId, uploaded, total, progress } = event.payload
    const transfer = transfers.value.find(item => item.id === uploadId && item.direction === 'upload')
    if (transfer && transfer.status === 'running') {
      updateTransferMetrics(transfer, uploaded, total, progress)
      if (total > 0 && uploaded >= total) {
        transfer.status = 'completed'
        transfer.progress = 100
        transfer.speed = 0
        dispatchTransferComplete(transfer)
      }
    }
  })

  if (!props.collapsed && props.connectionId) {
    startAutoRefresh()
  }
})

onUnmounted(() => {
  stopAutoRefresh()
  // 取消事件监听
  downloadProgressUnlisten?.()
  uploadProgressUnlisten?.()
})

// 监听属性变化
watch(() => props.collapsed, (newCollapsed) => {
  if (!newCollapsed && props.connectionId) {
    // 展开时才开始刷新数据
    startAutoRefresh()
  } else {
    // 折叠时停止刷新
    stopAutoRefresh()
  }
})

watch(() => props.connectionId, (newConnectionId) => {
  resetMonitorDerivedState()
  if (newConnectionId && !props.collapsed) {
    // 只有在面板展开且有连接时才刷新
    startAutoRefresh()
  } else {
    // 没有连接或面板折叠时停止刷新
    stopAutoRefresh()
  }
})

watch(() => props.activeTab, (newTab) => {
  activeTab.value = newTab
})

watch(activeTab, (newTab) => {
  emit('tab-change', newTab)
}, { immediate: true })

// ============ 传输管理函数 ============

function addDownload(fileName: string, remotePath: string, savePath: string, connectionId: string) {
  const request: DownloadRequest = {
    fileName,
    remotePath,
    savePath,
    connectionId,
  }

  const transfer: TransferTask = {
    id: ++transferIdCounter,
    direction: 'download',
    fileName,
    sourcePath: remotePath,
    targetPath: savePath,
    connectionId,
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
  startDownload(transfer)
  activeTab.value = 'download'
}

function addUpload(upload: UploadRequest) {
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
  startUpload(transfer, upload)
  activeTab.value = 'download'
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
      downloadId: task.id
    })

    if (task.status !== 'cancelled') {
      task.status = 'completed'
      task.progress = 100
      message.success(`下载完成: ${task.fileName}`)
      dispatchTransferComplete(task)
    }
  } catch (error) {
    const task = getTransferTask(transfer.id) || transfer
    if (task.status !== 'cancelled') {
      task.status = 'error'
      task.error = error.toString()
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
      message.success(`上传完成: ${task.fileName}`)
      dispatchTransferComplete(task)
    }
  } catch (error) {
    const task = getTransferTask(transfer.id) || transfer
    if (task.status !== 'cancelled') {
      task.status = 'error'
      task.error = error.toString()
      message.error(`上传失败: ${task.fileName}`)
      dispatchTransferComplete(task)
    }
  }
}

function cancelTransfer(transferId: number) {
  const transfer = transfers.value.find(item => item.id === transferId)
  if (!transfer) return

  transfer.status = 'cancelled'
  message.info(`${transfer.direction === 'download' ? '已取消下载' : '已取消上传'}: ${transfer.fileName}`)
  dispatchTransferComplete(transfer)
}

async function cancelTransferGroup(groupId: string) {
  const group = transferGroups.value.find((item) => item.id === groupId)
  if (!group) return

  for (const transfer of group.items.filter((item) => item.status === 'running')) {
    try {
      await invoke('cancel_download', { downloadId: transfer.id })
    } catch (error) {
      console.error('取消传输失败:', error)
    }
    cancelTransfer(transfer.id)
  }
}

function retryTransfer(transferId: number) {
  const transfer = transfers.value.find((item) => item.id === transferId)
  if (!transfer) return

  transfer.status = 'running'
  transfer.progress = 0
  transfer.transferred = 0
  transfer.total = 0
  transfer.error = null
  transfer.note = ''
  transfer.startTime = Date.now()

  if (transfer.direction === 'download' && transfer.downloadRequest) {
    startDownload(transfer)
    return
  }

  if (transfer.direction === 'upload' && transfer.uploadRequest) {
    startUpload(transfer, transfer.uploadRequest)
  }
}

function retryTransferGroup(groupId: string) {
  const group = transferGroups.value.find((item) => item.id === groupId)
  if (!group) return

  for (const transfer of group.items.filter((item) => item.status === 'error')) {
    retryTransfer(transfer.id)
  }
}

async function openFileLocation(filePath: string) {
  try {
    await invoke('open_file_location', { path: filePath })
  } catch (error) {
    message.error('无法打开文件位置: ' + error)
  }
}

function removeTransfer(transferId: number) {
  const index = transfers.value.findIndex(item => item.id === transferId)
  if (index !== -1) {
    transfers.value.splice(index, 1)
  }
}

function removeTransferGroup(groupId: string) {
  const group = transferGroups.value.find((item) => item.id === groupId)
  if (!group) return

  const ids = new Set(group.items.map((item) => item.id))
  transfers.value = transfers.value.filter((item) => !ids.has(item.id))
}

function clearCompleted() {
  transfers.value = transfers.value.filter(item => 
    item.status === 'running' || item.status === 'error'
  )
}

// 暴露方法给父组件
defineExpose({
  addDownload,
  addUpload,
})
</script>

<style scoped>
.right-panel {
  display: flex;
  height: 100%;
  background: transparent;
  position: relative;
  min-height: 0;
}

.panel-content-wrapper {
  display: flex;
  flex-direction: column;
  width: 282px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-1) 92%, transparent), color-mix(in srgb, var(--surface-0) 88%, transparent)),
    var(--surface-0);
  transition:
    width 0.28s ease,
    opacity 0.28s ease;
  overflow: hidden;
  flex-shrink: 0;
  border-radius: 14px 0 0 14px;
  backdrop-filter: blur(14px);
  box-shadow:
    inset 1px 0 0 var(--border-subtle),
    inset 0 0 0 1px var(--border-color);
}

.right-panel--left .panel-content-wrapper {
  border-radius: 0 14px 14px 0;
  box-shadow:
    inset -1px 0 0 var(--border-subtle),
    inset 0 0 0 1px var(--border-color);
}

.right-panel--embedded.right-panel--monitor .panel-content-wrapper {
  width: 100%;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(240, 242, 245, 0.96));
  border-radius: 0 18px 18px 0;
  backdrop-filter: none;
  box-shadow:
    inset -1px 0 0 rgba(24, 144, 255, 0.08),
    0 18px 40px rgba(15, 23, 42, 0.08);
}

.panel-content-wrapper.collapsed {
  width: 0;
  opacity: 0;
  pointer-events: none;
}

.collapse-btn {
  width: 28px !important;
  height: 28px !important;
  border-radius: 10px;
  color: var(--text-color);
  background: var(--surface-1) !important;
  border: 1px solid var(--border-color) !important;
}

.collapse-btn:hover {
  background: var(--surface-2) !important;
  border-color: var(--strong-border) !important;
}

.panel-content {
  padding: 8px 8px 10px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.34) transparent;
}

.panel-content::-webkit-scrollbar {
  width: 8px;
}

.panel-content::-webkit-scrollbar-track {
  background: transparent;
}

.panel-content::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.34);
  border-radius: 999px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.5);
}

.monitor-content {
  flex: 1;
  min-height: 0;
  padding: 14px 16px 18px;
  background:
    radial-gradient(circle at top left, rgba(24, 144, 255, 0.08), transparent 28%),
    linear-gradient(180deg, #f7f9fc 0%, #f0f2f5 100%);
}

.monitor-dashboard {
  display: grid;
  gap: 16px;
}

.dashboard-hero-card,
.dashboard-card {
  border-radius: 8px !important;
  background: rgba(255, 255, 255, 0.94) !important;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.07) !important;
  overflow: hidden;
}

.dashboard-hero-card :deep(.ant-card-body),
.dashboard-card :deep(.ant-card-body) {
  padding: 18px !important;
}

.dashboard-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.dashboard-hero__copy {
  min-width: 0;
}

.dashboard-hero__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.dashboard-hero__title-row h3 {
  margin: 0;
  color: #162236;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
}

.dashboard-hero__copy p {
  margin-top: 8px;
  color: #5f7188;
  font-size: 14px;
}

.dashboard-health-pill {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.dashboard-health-pill.is-healthy {
  background: rgba(82, 196, 26, 0.12);
  color: #389e0d;
}

.dashboard-health-pill.is-warning {
  background: rgba(250, 173, 20, 0.14);
  color: #d48806;
}

.dashboard-health-pill.is-danger {
  background: rgba(245, 34, 45, 0.12);
  color: #cf1322;
}

.dashboard-health-pill.is-offline {
  background: rgba(128, 148, 177, 0.16);
  color: #5f7188;
}

.dashboard-hero__toolbar {
  display: grid;
  justify-items: end;
  align-content: start;
  gap: 6px;
  flex-shrink: 0;
}

.dashboard-hero__toolbar-meta {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.dashboard-hero__toolbar-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-left: auto;
}

.dashboard-hero__timestamp {
  color: #7f8c9f;
  font-size: 12px;
  font-weight: 600;
}

.dashboard-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.dashboard-kpi {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(247, 250, 252, 0.96), rgba(240, 244, 248, 0.9));
  border: 1px solid rgba(24, 144, 255, 0.06);
}

.dashboard-kpi__label {
  color: #7f8c9f;
  font-size: 12px;
  font-weight: 600;
}

.dashboard-kpi__meta {
  color: #687b93;
  font-size: 12px;
}

.hero-summary-memory {
  padding: 10px 12px;
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(247, 250, 252, 0.98), rgba(244, 247, 251, 0.92));
  border: 1px solid rgba(24, 144, 255, 0.06);
}
.hero-summary-memory__head span,
.hero-summary-memory__legend-item span {
  color: #6c7d93;
  font-size: 11px;
}

.hero-summary-memory__head strong,
.hero-summary-memory__legend-item strong {
  color: #162236;
  font-size: 12px;
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
}

.hero-summary-memory {
  display: grid;
  gap: 8px;
  margin-top: 8px;
}

.hero-summary-memory__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.hero-summary-memory__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
}

.hero-summary-memory__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.hero-alert-strip {
  display: grid;
  gap: 8px;
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(245, 34, 45, 0.12), rgba(245, 34, 45, 0.06));
  border: 1px solid rgba(245, 34, 45, 0.22);
}

.hero-alert-strip__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.hero-alert-strip__header strong {
  color: #cf1322;
  font-size: 12px;
  font-weight: 700;
}

.hero-alert-strip__header span {
  color: #a61d24;
  font-size: 11px;
  font-weight: 600;
}

.hero-alert-strip__list {
  display: grid;
  gap: 6px;
}

.hero-alert-strip__item {
  display: grid;
  gap: 3px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.7);
  border-left: 3px solid #f5222d;
}

.hero-alert-strip__item.is-warning {
  border-left-color: #faad14;
}

.hero-alert-strip__item.is-info {
  border-left-color: #1890ff;
}

.hero-alert-strip__message {
  color: #431418;
  font-size: 12px;
  font-weight: 700;
}

.hero-alert-strip__description {
  color: #7a1f28;
  font-size: 11px;
  line-height: 1.45;
}

.dashboard-kpi :deep(.ant-statistic) {
  line-height: 1;
}

.dashboard-kpi :deep(.ant-statistic-content) {
  color: inherit;
  font-size: 24px;
}

.dashboard-main-grid,
.dashboard-bottom-grid {
  display: grid;
  gap: 16px;
}

.dashboard-main-grid {
  grid-template-columns: minmax(0, 1.7fr) minmax(300px, 1fr);
}

.dashboard-bottom-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.dashboard-stack {
  display: grid;
  gap: 16px;
}

.dashboard-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.dashboard-section-head h4 {
  margin: 6px 0 0;
  color: #162236;
  font-size: 18px;
  font-weight: 700;
}

.dashboard-section-head__meta {
  color: #7f8c9f;
  font-size: 12px;
  font-weight: 600;
}

.resource-highlight-list {
  display: grid;
  gap: 8px;
}

.resource-highlight-row {
  display: grid;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(250, 252, 255, 0.98), rgba(244, 247, 251, 0.92));
  border: 1px solid rgba(24, 144, 255, 0.08);
}

.resource-highlight-row__main,
.memory-composition__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.resource-highlight-row__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-wrap: nowrap;
}

.resource-highlight-row__name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #162236;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.resource-highlight-row__meta {
  color: #6c7d93;
  font-size: 12px;
  white-space: nowrap;
}

.resource-highlight-row__icon {
  color: #1890ff;
  font-size: 14px;
}

.resource-highlight-row__tone {
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}

.resource-highlight-row__tone.is-healthy {
  color: #389e0d;
  background: rgba(82, 196, 26, 0.12);
}

.resource-highlight-row__tone.is-warning {
  color: #d48806;
  background: rgba(250, 173, 20, 0.14);
}

.resource-highlight-row__tone.is-danger {
  color: #cf1322;
  background: rgba(245, 34, 45, 0.12);
}

.resource-highlight-row__value {
  display: inline-flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
}

.resource-highlight-row__footer {
  margin-top: 4px;
}

.resource-highlight-row__inline-progress {
  position: relative;
}

.resource-highlight-row__inline-meta {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
  gap: 8px;
  padding: 0 8px;
  pointer-events: none;
  white-space: nowrap;
}

.resource-highlight-row__inline-percent,
.resource-highlight-row__inline-detail {
  color: #203044;
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.38);
  min-width: 0;
}

.resource-highlight-row__inline-percent {
  flex: 0 0 auto;
}

.resource-highlight-row__inline-detail {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  text-align: right;
}

.resource-highlight-row__progress :deep(.ant-progress) {
  margin: 0;
}
.disk-card__identity span,
.interface-card__identity span,
.interface-card__totals,
.memory-legend-item,
.network-summary-item span {
  color: #6c7d93;
  font-size: 12px;
}

.process-summary-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.process-summary-chip {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(24, 144, 255, 0.08);
  color: #4f6480;
  font-size: 12px;
  font-weight: 700;
}

.process-table :deep(.ant-table-wrapper),
.process-table :deep(.ant-table),
.process-table :deep(.ant-table-container) {
  background: transparent !important;
}

.process-table :deep(.ant-table-thead > tr > th) {
  color: #6c7d93;
  font-size: 12px;
  font-weight: 700;
  background: rgba(24, 144, 255, 0.06) !important;
}

.process-table :deep(.ant-table-tbody > tr > td) {
  border-bottom-color: rgba(22, 34, 54, 0.06) !important;
  background: transparent !important;
}

.process-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(24, 144, 255, 0.08);
  color: #1890ff;
  font-size: 12px;
  font-weight: 700;
}

.process-value,
.process-command,
.disk-card__percent,
.network-summary-item strong,
.system-fact strong,
.memory-legend-item strong,
.interface-card__metric {
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
}

.process-value {
  color: #162236;
  font-size: 12px;
  font-weight: 700;
}

.process-value--cpu {
  color: #1890ff;
}

.process-command {
  display: inline-block;
  max-width: 100%;
  color: #162236;
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alert-stack {
  display: grid;
  gap: 10px;
}

.alert-stack :deep(.ant-alert) {
  border-radius: 8px;
  border: none;
}

.system-facts-grid,
.network-summary-grid,
.disk-grid,
.interface-grid {
  display: grid;
  gap: 12px;
}

.system-facts-grid,
.network-summary-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.system-fact,
.network-summary-item,
.disk-card,
.interface-card {
  padding: 14px 16px;
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(247, 250, 252, 0.98), rgba(244, 247, 251, 0.92));
  border: 1px solid rgba(24, 144, 255, 0.06);
}

.system-fact {
  display: grid;
  gap: 8px;
}

.system-fact span {
  color: #6c7d93;
  font-size: 12px;
}

.system-fact strong {
  color: #162236;
  font-size: 13px;
}

.memory-composition {
  display: grid;
  gap: 12px;
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 8px;
  background: rgba(240, 244, 248, 0.72);
}

.memory-composition__header span {
  color: #6c7d93;
  font-size: 12px;
  font-weight: 600;
}

.memory-composition__header strong {
  color: #162236;
  font-size: 13px;
}

.memory-composition__bar {
  position: relative;
  display: flex;
  width: 100%;
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.14);
}

.memory-composition__segment {
  min-width: 2%;
}

.memory-composition__bar--interactive {
  cursor: help;
}

.memory-composition__tooltip {
  display: grid;
  gap: 6px;
  min-width: 160px;
}

.memory-composition__tooltip-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.92);
  font-size: 12px;
}

.memory-composition__tooltip-item strong {
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
  font-size: 12px;
}

.memory-composition__legend {
  display: grid;
  gap: 8px;
}

.memory-legend-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.memory-legend-item__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 8px;
  flex-shrink: 0;
}

.memory-legend-item span:nth-child(2) {
  margin-right: auto;
}

.network-summary-grid {
  margin-top: 16px;
}

.network-summary-item {
  display: grid;
  gap: 8px;
}

.network-summary-item strong,
.interface-card__metric {
  color: #162236;
  font-size: 14px;
}

.right-panel--embedded.right-panel--monitor .monitor-content {
  padding: 4px;
}

.right-panel--embedded.right-panel--monitor .monitor-dashboard,
.right-panel--embedded.right-panel--monitor .dashboard-stack,
.right-panel--embedded.right-panel--monitor .dashboard-main-grid,
.right-panel--embedded.right-panel--monitor .dashboard-bottom-grid {
  gap: 6px;
}

.right-panel--embedded.right-panel--monitor .dashboard-hero-card :deep(.ant-card-body),
.right-panel--embedded.right-panel--monitor .dashboard-card :deep(.ant-card-body) {
  padding: 8px !important;
}

.right-panel--embedded.right-panel--monitor .dashboard-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    "copy actions"
    "meta actions";
  align-items: start;
  gap: 4px 8px;
}

.right-panel--embedded.right-panel--monitor .dashboard-hero__copy {
  grid-area: copy;
  display: grid;
  gap: 2px;
  min-width: 0;
}

.right-panel--embedded.right-panel--monitor .dashboard-hero__toolbar {
  display: contents;
}

.right-panel--embedded.right-panel--monitor .dashboard-hero__toolbar-meta {
  grid-area: meta;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
}

.right-panel--embedded.right-panel--monitor .dashboard-hero__toolbar-actions {
  grid-area: actions;
  width: auto;
  display: grid;
  justify-items: end;
  margin-left: 0;
  gap: 6px;
}

.right-panel--embedded.right-panel--monitor .dashboard-hero__title-row {
  gap: 4px 6px;
  align-items: flex-start;
  flex-wrap: wrap;
  margin-top: 0;
}

.right-panel--embedded.right-panel--monitor .dashboard-hero__title-row h3 {
  display: -webkit-box;
  font-size: 12px;
  line-height: 1.15;
  word-break: break-word;
  overflow-wrap: anywhere;
  min-width: 0;
  max-width: 100%;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.right-panel--embedded.right-panel--monitor .dashboard-hero__copy p {
  margin-top: 0;
  font-size: 9px;
  line-height: 1.2;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.right-panel--embedded.right-panel--monitor .dashboard-health-pill {
  min-height: 18px;
  padding: 0 6px;
  font-size: 9px;
}

.right-panel--embedded.right-panel--monitor .hero-refresh-btn,
.right-panel--embedded.right-panel--monitor .dashboard-hero__timestamp {
  font-size: 8px;
}

.right-panel--embedded.right-panel--monitor .hero-refresh-btn {
  width: 28px;
  min-width: 28px;
  height: 28px;
  padding-inline: 0;
}

.right-panel--embedded.right-panel--monitor .dashboard-kpi,
.right-panel--embedded.right-panel--monitor .resource-highlight,
.right-panel--embedded.right-panel--monitor .system-fact,
.right-panel--embedded.right-panel--monitor .network-summary-item,
.right-panel--embedded.right-panel--monitor .disk-card,
.right-panel--embedded.right-panel--monitor .interface-card,
.right-panel--embedded.right-panel--monitor .memory-composition {
  padding: 6px 7px;
}

.right-panel--embedded.right-panel--monitor .dashboard-kpi-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  margin-top: 4px;
}

.right-panel--embedded.right-panel--monitor .dashboard-kpi {
  gap: 4px;
  padding: 6px;
  min-height: 0;
}

.right-panel--embedded.right-panel--monitor .dashboard-kpi--uptime :deep(.ant-statistic-content) {
  font-size: 14px !important;
}

.right-panel--embedded.right-panel--monitor .dashboard-kpi--rx :deep(.ant-statistic-content),
.right-panel--embedded.right-panel--monitor .dashboard-kpi--tx :deep(.ant-statistic-content) {
  font-size: 13px !important;
}

.right-panel--embedded.right-panel--monitor .dashboard-kpi__label {
  white-space: nowrap;
}

.right-panel--embedded.right-panel--monitor .dashboard-kpi :deep(.ant-statistic),
.right-panel--embedded.right-panel--monitor .dashboard-kpi :deep(.ant-statistic-content),
.right-panel--embedded.right-panel--monitor .dashboard-kpi :deep(.ant-statistic-content-value),
.right-panel--embedded.right-panel--monitor .dashboard-kpi :deep(.ant-statistic-content-value-int),
.right-panel--embedded.right-panel--monitor .dashboard-kpi :deep(.ant-statistic-content-value-decimal),
.right-panel--embedded.right-panel--monitor .dashboard-kpi :deep(.ant-statistic-content-suffix) {
  white-space: nowrap !important;
  line-height: 1.05 !important;
  letter-spacing: -0.03em;
}

.right-panel--embedded.right-panel--monitor .hero-summary-memory {
  padding: 6px 7px;
}

.right-panel--embedded.right-panel--monitor .hero-summary-memory {
  gap: 4px;
}

.right-panel--embedded.right-panel--monitor .hero-summary-memory__head {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.right-panel--embedded.right-panel--monitor .hero-summary-memory__legend {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
}

.right-panel--embedded.right-panel--monitor .hero-summary-memory__legend-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 3px;
  min-width: 0;
  padding: 3px 5px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--memory-segment-color) 10%, rgba(255, 255, 255, 0.92));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--memory-segment-color) 18%, rgba(177, 190, 206, 0.2));
}

.right-panel--embedded.right-panel--monitor .hero-alert-strip {
  gap: 4px;
  padding: 6px 7px;
}

.right-panel--embedded.right-panel--monitor .hero-alert-strip__item {
  gap: 2px;
  padding: 5px 6px;
}

.right-panel--embedded.right-panel--monitor .hero-alert-strip__header strong,
.right-panel--embedded.right-panel--monitor .hero-alert-strip__message {
  font-size: 10px;
}

.right-panel--embedded.right-panel--monitor .hero-alert-strip__header span,
.right-panel--embedded.right-panel--monitor .hero-alert-strip__description {
  font-size: 9px;
}

.right-panel--embedded.right-panel--monitor .hero-summary-memory__head span,
.right-panel--embedded.right-panel--monitor .hero-summary-memory__legend-item span {
  font-size: 9px;
}

.right-panel--embedded.right-panel--monitor .hero-summary-memory__head strong,
.right-panel--embedded.right-panel--monitor .hero-summary-memory__legend-item strong {
  font-size: 10px;
}

.right-panel--embedded.right-panel--monitor .hero-summary-memory__head span {
  color: #6d8098;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.right-panel--embedded.right-panel--monitor .hero-summary-memory__head strong {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: inset 0 0 0 1px rgba(188, 204, 223, 0.38);
}

.right-panel--embedded.right-panel--monitor .memory-composition__bar {
  height: 16px;
  border-radius: 999px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    inset 0 0 0 1px rgba(201, 214, 229, 0.3);
}

.right-panel--embedded.right-panel--monitor .memory-composition__segment {
  min-width: 3%;
}

.right-panel--embedded.right-panel--monitor .memory-legend-item__dot {
  width: 8px;
  height: 8px;
  margin-right: 0;
}

.right-panel--embedded.right-panel--monitor .hero-summary-memory__legend-item span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.right-panel--embedded.right-panel--monitor .hero-summary-memory__legend-item strong {
  justify-self: end;
}

.right-panel--embedded.right-panel--monitor .dashboard-main-grid,
.right-panel--embedded.right-panel--monitor .dashboard-bottom-grid,
.right-panel--embedded.right-panel--monitor .disk-grid,
.right-panel--embedded.right-panel--monitor .interface-grid,
.right-panel--embedded.right-panel--monitor .disk-card__meta,
.right-panel--embedded.right-panel--monitor .interface-card__stats {
  grid-template-columns: 1fr;
}

.right-panel--embedded.right-panel--monitor .system-facts-grid,
.right-panel--embedded.right-panel--monitor .network-summary-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.right-panel--embedded.right-panel--monitor .dashboard-section-head {
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 4px;
  margin-bottom: 4px;
}

.right-panel--embedded.right-panel--monitor .dashboard-section-head h4 {
  white-space: normal;
}

.right-panel--embedded.right-panel--monitor .dashboard-section-head--with-action {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.right-panel--embedded.right-panel--monitor .dashboard-section-head--inline-meta {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.right-panel--embedded.right-panel--monitor .dashboard-section-head--inline-meta .process-summary-chips {
  width: auto;
  justify-content: flex-end;
}

.right-panel--embedded.right-panel--monitor .memory-composition__header {
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
}

.right-panel--embedded.right-panel--monitor .dashboard-section-head h4 {
  margin-top: 1px;
  font-size: 13px;
}

.right-panel--embedded.right-panel--monitor .dashboard-section-head__meta,
.right-panel--embedded.right-panel--monitor .dashboard-kpi__label,
.right-panel--embedded.right-panel--monitor .dashboard-kpi__meta,
.right-panel--embedded.right-panel--monitor .system-fact span,
.right-panel--embedded.right-panel--monitor .network-summary-item span,
.right-panel--embedded.right-panel--monitor .resource-highlight-row__meta,
.right-panel--embedded.right-panel--monitor .resource-highlight-row__trend,
.right-panel--embedded.right-panel--monitor .sparkline-panel span,
.right-panel--embedded.right-panel--monitor .disk-card__identity span,
.right-panel--embedded.right-panel--monitor .interface-card__identity span,
.right-panel--embedded.right-panel--monitor .interface-card__totals {
  font-size: 9px;
}

.right-panel--embedded.right-panel--monitor .dashboard-kpi :deep(.ant-statistic-content),
.right-panel--embedded.right-panel--monitor .resource-highlight-row__value :deep(.ant-statistic-content) {
  font-size: 13px !important;
}

.right-panel--embedded.right-panel--monitor .resource-highlight-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 4px 8px;
  padding: 5px 6px;
}

.right-panel--embedded.right-panel--monitor .resource-highlight-row__main {
  display: flex;
  align-items: center;
  min-width: 0;
}

.right-panel--embedded.right-panel--monitor .resource-highlight-row__label {
  display: inline-flex;
  align-items: center;
  width: auto;
  min-width: 0;
}

.right-panel--embedded.right-panel--monitor .resource-highlight-row__name {
  font-size: 11px;
  gap: 3px;
  min-width: 0;
  white-space: nowrap;
}

.right-panel--embedded.right-panel--monitor .resource-highlight-row__meta,
.right-panel--embedded.right-panel--monitor .resource-highlight-row__trend {
  font-size: 8px;
  grid-column: 1 / -1;
  white-space: normal;
}

.right-panel--embedded.right-panel--monitor .resource-highlight-row__footer {
  margin-top: 0;
  min-width: 0;
}

.right-panel--embedded.right-panel--monitor .resource-highlight-row__footer--compact {
  margin-top: 0;
}

.right-panel--embedded.right-panel--monitor .resource-highlight-row__inline-progress :deep(.ant-progress),
.right-panel--embedded.right-panel--monitor .resource-highlight-row__inline-progress :deep(.ant-progress-outer) {
  width: 100%;
}

.right-panel--embedded.right-panel--monitor .resource-highlight-row__progress--compact :deep(.ant-progress-inner) {
  border-radius: 4px;
  background: rgba(222, 230, 240, 0.72);
}

.right-panel--embedded.right-panel--monitor .resource-highlight-row__progress--compact :deep(.ant-progress-bg) {
  border-radius: 4px;
}

.right-panel--embedded.right-panel--monitor .resource-highlight-row__inline-meta {
  padding: 0 6px;
  gap: 6px;
}

.right-panel--embedded.right-panel--monitor .resource-highlight-row__inline-percent,
.right-panel--embedded.right-panel--monitor .resource-highlight-row__inline-detail {
  font-size: 9px;
}

.right-panel--embedded.right-panel--monitor .resource-highlight-row__inline-detail {
  text-align: right;
}

.right-panel--embedded.right-panel--monitor .resource-highlight-row__progress :deep(.ant-progress-bg) {
  border-radius: 999px;
}

.right-panel--embedded.right-panel--monitor .process-summary-chips {
  width: 100%;
  gap: 4px;
  justify-content: flex-start;
}

.right-panel--embedded.right-panel--monitor .process-summary-chip {
  padding: 1px 6px;
  font-size: 9px;
}

.right-panel--embedded.right-panel--monitor .process-table :deep(.ant-table-thead > tr > th),
.right-panel--embedded.right-panel--monitor .process-table :deep(.ant-table-tbody > tr > td) {
  padding: 4px 3px !important;
}

.right-panel--embedded.right-panel--monitor .process-table :deep(.ant-table) {
  table-layout: fixed;
}

.right-panel--embedded.right-panel--monitor .process-table :deep(.ant-table-thead > tr > th),
.right-panel--embedded.right-panel--monitor .process-table :deep(.ant-table-tbody > tr > td) {
  font-size: 9px;
}

.right-panel--embedded.right-panel--monitor .process-rank {
  width: 22px;
  height: 22px;
  font-size: 10px;
}

.right-panel--embedded.right-panel--monitor .process-command,
.right-panel--embedded.right-panel--monitor .process-value {
  font-size: 10px;
}

.right-panel--embedded.right-panel--monitor .alert-stack {
  gap: 6px;
}

.right-panel--embedded.right-panel--monitor .alert-stack :deep(.ant-alert) {
  padding: 8px 10px;
}

.right-panel--embedded.right-panel--monitor .alert-stack :deep(.ant-alert-message) {
  margin-bottom: 2px !important;
  font-size: 12px !important;
}

.right-panel--embedded.right-panel--monitor .alert-stack :deep(.ant-alert-description) {
  font-size: 11px !important;
  line-height: 1.45 !important;
}

.right-panel--embedded.right-panel--monitor .memory-composition {
  gap: 4px;
  margin-top: 4px;
}

.right-panel--embedded.right-panel--monitor .disk-card,
.right-panel--embedded.right-panel--monitor .interface-card {
  gap: 3px;
}

.right-panel--embedded.right-panel--monitor .disk-card__compact {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.right-panel--embedded.right-panel--monitor .disk-card__compact-head,
.right-panel--embedded.right-panel--monitor .disk-card__compact-meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 8px;
  min-width: 0;
}

.right-panel--embedded.right-panel--monitor .disk-card__mountpoint,
.right-panel--embedded.right-panel--monitor .disk-card__device {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.right-panel--embedded.right-panel--monitor .disk-card__mountpoint {
  color: #162236;
  font-size: 11px;
  font-weight: 700;
}

.right-panel--embedded.right-panel--monitor .disk-card__device {
  color: #7b8da3;
  font-size: 8px;
}

.right-panel--embedded.right-panel--monitor .disk-card__row,
.right-panel--embedded.right-panel--monitor .interface-card__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 3px 8px;
}

.right-panel--embedded.right-panel--monitor .disk-card__identity,
.right-panel--embedded.right-panel--monitor .interface-card__identity {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.right-panel--embedded.right-panel--monitor .disk-card__usage {
  display: grid;
  justify-items: end;
  gap: 1px;
  width: auto;
}

.right-panel--embedded.right-panel--monitor .disk-card__summary {
  color: #2f3d4f;
  font-size: 8px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
  max-width: 148px;
}

.right-panel--embedded.right-panel--monitor .interface-card__live {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 2px 8px;
  width: auto;
}

.right-panel--embedded.right-panel--monitor .interface-card__metric {
  color: #162236;
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}

.right-panel--embedded.right-panel--monitor .interface-card__totals {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 8px;
  white-space: normal;
  overflow-wrap: anywhere;
}

.right-panel--embedded.right-panel--monitor .network-summary-item,
.right-panel--embedded.right-panel--monitor .system-fact {
  gap: 4px;
}

.right-panel--embedded.right-panel--monitor .memory-legend-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
}

.right-panel--embedded.right-panel--monitor .dashboard-card,
.right-panel--embedded.right-panel--monitor .dashboard-hero-card,
.right-panel--embedded.right-panel--monitor .dashboard-kpi,
.right-panel--embedded.right-panel--monitor .resource-highlight,
.right-panel--embedded.right-panel--monitor .system-fact,
.right-panel--embedded.right-panel--monitor .network-summary-item,
.right-panel--embedded.right-panel--monitor .disk-card,
.right-panel--embedded.right-panel--monitor .interface-card,
.right-panel--embedded.right-panel--monitor .memory-composition {
  min-width: 0;
}

.disk-grid,
.interface-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.disk-card,
.interface-card {
  display: grid;
  gap: 8px;
}

.disk-card__identity strong,
.interface-card__identity strong {
  color: #162236;
  font-size: 14px;
}

.disk-card__summary {
  color: #2f3d4f;
  font-weight: 500;
}

.disk-card__identity,
.interface-card__identity {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.disk-card__percent {
  font-size: 13px;
  font-weight: 700;
}

.interface-card__totals {
  gap: 4px 10px;
}

.info-section {
  margin-bottom: 8px;
}

.info-section--dense {
  margin-bottom: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding: 0 2px;
}

.section-header--dense {
  gap: 6px;
  margin-bottom: 5px;
  padding: 0 1px;
}

.section-header--spread {
  justify-content: space-between;
}

.section-header__title-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin-right: auto;
}

.section-action-btn {
  min-height: 20px !important;
  padding-inline: 7px !important;
  border-radius: 999px !important;
  color: var(--muted-color) !important;
  background: var(--surface-1) !important;
  border: 1px solid var(--border-color) !important;
  font-size: 9px !important;
  font-weight: 700 !important;
}

.section-icon {
  color: var(--primary-color);
  font-size: 14px;
}

.section-header h4 {
  margin: 0;
  color: var(--text-color);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.info-card {
  padding: 9px;
  border-radius: 12px;
  background: var(--monitor-card-bg);
  box-shadow:
    inset 0 0 0 1px var(--border-subtle),
    var(--shadow-card);
}

.info-card--dense {
  padding: 7px 8px;
  border-radius: 10px;
}

.compact-kv-list {
  display: grid;
  gap: 0;
}

.compact-kv-row {
  display: grid;
  grid-template-columns: minmax(70px, 82px) minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  padding: 6px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.compact-kv-row:last-child {
  border-bottom: none;
  padding-bottom: 2px;
}

.compact-kv-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted-color);
  font-size: 10px;
  font-weight: 700;
}

.compact-kv-value {
  color: var(--text-color);
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.45;
  word-break: break-word;
  text-align: right;
}

.resource-rows {
  display: grid;
  gap: 6px;
}

.resource-row {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 42px;
  gap: 6px 8px;
  align-items: center;
  padding: 4px 0;
}

.resource-row__label {
  color: var(--text-color);
  font-size: 10px;
  font-weight: 700;
}

.resource-row__bar {
  min-width: 0;
}

.resource-row__bar :deep(.ant-progress) {
  margin: 0;
}

.resource-row__value {
  color: var(--primary-color);
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
  font-size: 11px;
  font-weight: 700;
  text-align: right;
}

.resource-row__meta {
  grid-column: 2 / 4;
  color: var(--muted-color);
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
  font-size: 9px;
  font-weight: 700;
  line-height: 1.2;
}

.process-mini-table {
  display: grid;
  gap: 0;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
}

.process-mini-table__head,
.process-mini-table__row {
  display: grid;
  grid-template-columns: 52px 40px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.process-mini-table__head {
  padding: 5px 7px;
  background: color-mix(in srgb, var(--primary-color) 12%, var(--surface-1));
  color: var(--muted-color);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.process-mini-table__row {
  padding: 6px 7px;
  border-top: 1px solid var(--border-subtle);
  background: var(--monitor-card-strong);
}

.process-mini-table__memory,
.process-mini-table__cpu,
.process-mini-table__command {
  min-width: 0;
  color: var(--text-color);
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
}

.process-mini-table__command {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.process-mini-summary {
  display: flex;
  gap: 8px;
  margin-top: 7px;
  color: var(--muted-color);
  font-size: 9px;
  font-weight: 700;
}

.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--muted-color);
  font-size: 11px;
  font-weight: 600;
}

.item-icon {
  color: var(--primary-color);
  font-size: 13px;
}

.info-value,
.cpu-usage,
.usage-percent,
.disk-usage,
.disk-device,
.interface-name,
.stat-value,
.disk-stat,
.detail-value {
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
}

.info-value {
  color: var(--text-color);
  font-size: 11px;
  font-weight: 700;
}

.cpu-info,
.memory-info,
.disk-header,
.network-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.cpu-info,
.memory-info {
  margin-bottom: 10px;
}

.metric-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.metric-head--row {
  align-items: center;
}

.metric-copy {
  min-width: 0;
  flex: 1;
}

.metric-title {
  color: var(--text-color);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.35;
  word-break: break-word;
}

.metric-sub {
  margin-top: 2px;
  color: var(--muted-color);
  font-size: 9px;
  line-height: 1.35;
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
  word-break: break-word;
}

.metric-value {
  flex-shrink: 0;
  color: var(--primary-color);
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

.cpu-model,
.memory-label {
  color: var(--text-color);
  font-size: 11px;
  font-weight: 700;
  flex: 1;
  min-width: 0;
}

.cpu-model {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cpu-usage,
.usage-percent,
.disk-usage {
  color: var(--primary-color);
  font-size: 17px;
  font-weight: 700;
}

.memory-stats,
.disk-info,
.interface-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.memory-usage,
.disk-mount,
.interface-ip,
.detail-label,
.stat-label,
.disk-type {
  color: var(--muted-color);
  font-size: 10px;
}

.progress-container {
  margin: 6px 0 0;
}

.progress-container--dense {
  margin-top: 6px;
}

.dense-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 7px;
}

.dense-detail-card {
  display: grid;
  gap: 2px;
  padding: 7px 8px;
  border-radius: 10px;
  background: var(--surface-1);
}

.dense-detail-label {
  color: var(--muted-color);
  font-size: 9px;
  font-weight: 700;
}

.dense-detail-value {
  color: var(--text-color);
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
}

.dense-list-card {
  display: grid;
  gap: 6px;
}

.dense-list-row {
  padding: 7px 8px;
  border-radius: 10px;
  background: var(--monitor-card-bg);
  box-shadow:
    inset 0 0 0 1px var(--border-subtle),
    var(--shadow-card);
}

.dense-inline-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
}

.dense-meter-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.dense-meter-track {
  min-width: 0;
}

.dense-meter-track :deep(.ant-progress) {
  margin: 0;
}

.dense-meter-text {
  color: var(--text-color);
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}

.dense-inline-text {
  color: var(--text-color);
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
}

.dense-inline-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 18px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--surface-1);
  border: 1px solid var(--border-color);
  color: var(--muted-color);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
}

.dense-inline-pill.is-active {
  color: var(--success-color);
  background: rgba(74, 169, 107, 0.12);
  border-color: rgba(74, 169, 107, 0.16);
}

.dense-network-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 6px;
}

.dense-network-item {
  display: grid;
  gap: 2px;
  padding: 7px 8px;
  border-radius: 10px;
  background: var(--surface-1);
}

.dense-network-label {
  color: var(--muted-color);
  font-size: 9px;
  font-weight: 700;
}

.dense-network-value {
  color: var(--text-color);
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
}

.memory-details,
.disk-stats,
.network-stats {
  margin-top: 10px;
}

.memory-details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.detail-item,
.disk-item,
.network-item,
.stat-item {
  border-radius: 12px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px;
  background: var(--surface-1);
  align-items: flex-start;
}

.disk-item,
.network-item {
  padding: 10px;
  background: var(--monitor-card-strong);
}

.disk-item + .disk-item,
.network-item + .network-item {
  margin-top: 8px;
}

.disk-device,
.interface-name {
  color: var(--text-color);
  font-size: 11px;
  font-weight: 700;
}

.disk-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.disk-type {
  padding: 3px 7px;
  border-radius: 999px;
  background: var(--surface-1);
  text-transform: uppercase;
}

.interface-status {
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  background: rgba(234, 95, 97, 0.14);
  color: var(--error-color);
}

.interface-status.active {
  background: rgba(74, 169, 107, 0.14);
  color: var(--success-color);
}

.network-stat {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  background: var(--surface-1);
}

.stat-icon {
  color: var(--primary-color);
  font-size: 13px;
  font-weight: 700;
}

.download-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.transfer-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.transfer-filter {
  max-width: 100%;
  background: var(--surface-2);
  border: 1px solid var(--border-color);
}

.transfer-filter:deep(.ant-segmented-group) {
  flex-wrap: wrap;
}

.transfer-filter:deep(.ant-segmented-item) {
  min-height: 26px;
  font-size: 10px;
  font-weight: 700;
  color: var(--muted-color);
}

.transfer-filter:deep(.ant-segmented-item-selected) {
  color: var(--primary-color);
  background: var(--surface-1);
  border-color: var(--primary-ring);
}

.download-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.download-item {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 10px;
  border-radius: 12px;
  background: var(--monitor-card-bg);
  box-shadow: inset 0 0 0 1px var(--border-subtle);
  transition:
    transform 0.2s ease,
    background-color 0.2s ease;
}

.download-item:hover {
  transform: translateY(-1px);
  background: var(--monitor-card-strong);
}

.download-item.completed {
  background: linear-gradient(180deg, rgba(74, 169, 107, 0.12), rgba(74, 169, 107, 0.05));
}

.download-item.error {
  background: linear-gradient(180deg, rgba(234, 95, 97, 0.12), rgba(234, 95, 97, 0.05));
}

.download-info {
  flex: 1;
  margin-right: 8px;
  min-width: 0;
}

.download-info .file-name {
  color: var(--text-color);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
}

.file-direction-icon {
  color: var(--primary-color);
  font-size: 13px;
}

.direction-badge {
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--surface-1);
  border: 1px solid var(--border-color);
  color: var(--muted-color);
  font-size: 9px;
  font-weight: 700;
  flex-shrink: 0;
}

.download-info .file-path {
  color: var(--muted-color);
  font-size: 10px;
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
  margin-bottom: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-path__label {
  display: inline-block;
  min-width: 26px;
  margin-right: 6px;
  color: var(--text-color);
  opacity: 0.72;
}

.transfer-note {
  margin-top: 4px;
  color: var(--warning-color);
  font-size: 10px;
}

.download-status {
  margin-top: 6px;
  font-size: 10px;
  color: var(--muted-color);
}

.download-status .success {
  color: var(--success-color);
}

.download-status .error {
  color: var(--error-color);
}

.download-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.download-actions :deep(.ant-btn) {
  background: var(--surface-1) !important;
  border: 1px solid var(--border-color) !important;
  color: var(--text-color) !important;
}

.download-actions :deep(.ant-btn:hover) {
  background: var(--surface-2) !important;
  border-color: var(--strong-border) !important;
}

.empty-state :deep(.ant-empty) {
  color: var(--muted-color);
}

.empty-state :deep(.ant-empty-image) {
  opacity: 0.82;
}

.empty-state :deep(.ant-empty-description) {
  color: var(--muted-color) !important;
}

.download-footer {
  padding: 8px 0 4px;
}

@media (max-width: 768px) {
  .panel-content-wrapper {
    width: 236px;
  }

  .right-panel--embedded.right-panel--monitor .panel-content-wrapper {
    width: 100%;
    border-radius: 0;
  }

  .monitor-content {
    padding: 12px;
  }

  .dashboard-hero,
  .dashboard-section-head,
  .resource-highlight-row__main,
  .memory-composition__header {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: flex-start;
  }

  .dashboard-hero__toolbar {
    width: 100%;
    justify-items: stretch;
  }

  .dashboard-hero__toolbar-actions {
    width: 100%;
    justify-content: space-between;
    margin-left: 0;
  }

  .dashboard-kpi-grid,
  .dashboard-main-grid,
  .dashboard-bottom-grid,
  .resource-highlight-list,
  .system-facts-grid,
  .network-summary-grid,
  .disk-grid,
  .interface-grid {
    grid-template-columns: 1fr;
  }

  .disk-card__row,
  .interface-card__row {
    flex-direction: column;
    align-items: flex-start;
  }

  .compact-kv-row,
  .metric-head,
  .dense-inline-meta {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: flex-start;
  }

  .compact-kv-value {
    text-align: left;
  }

  .dense-network-grid,
  .dense-detail-grid,
  .network-stat,
  .memory-details {
    grid-template-columns: 1fr;
  }

  .dense-meter-row {
    grid-template-columns: 1fr;
    align-items: flex-start;
  }
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .monitor-content) {
  background:
    radial-gradient(circle at top left, rgba(113, 167, 255, 0.12), transparent 30%),
    linear-gradient(180deg, rgba(11, 18, 32, 0.96), rgba(8, 14, 24, 0.96)) !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-hero-card),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-card) {
  background: linear-gradient(180deg, rgba(17, 28, 44, 0.96), rgba(13, 22, 35, 0.94)) !important;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.32) !important;
  border: 1px solid rgba(53, 81, 120, 0.4) !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-kpi),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .hero-summary-memory),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .disk-card),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .interface-card),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .memory-composition) {
  background: linear-gradient(180deg, rgba(20, 33, 51, 0.96), rgba(15, 24, 39, 0.9)) !important;
  border-color: rgba(53, 81, 120, 0.34) !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-kpi) {
  --monitor-accent: var(--text-color);
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-kpi--uptime) {
  --monitor-accent: #8fc6ff;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-kpi--rx) {
  --monitor-accent: #7fdda0;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-kpi--tx) {
  --monitor-accent: #ffd36f;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row--cpu) {
  --monitor-accent: #7fdda0;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row--memory) {
  --monitor-accent: #ffd36f;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row--disk) {
  --monitor-accent: #ff8e8e;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-hero__title-row h3),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-section-head h4),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row__name),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .hero-summary-memory__head strong),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .hero-summary-memory__legend-item strong),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .disk-card__identity strong),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .disk-card__percent),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .interface-card__identity strong),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .interface-card__metric),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .process-command),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .process-value) {
  color: var(--text-color) !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-hero__copy p),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-hero__timestamp),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-kpi__label),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-kpi__meta),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .hero-summary-memory__head span),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .hero-summary-memory__legend-item span),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row__meta),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row__trend),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .disk-card__identity span),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .interface-card__identity span),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .interface-card__totals),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .process-table .ant-table-thead > tr > th),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .process-table .ant-table-tbody > tr > td) {
  color: var(--muted-color) !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-kpi .ant-statistic),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row__value .ant-statistic) {
  color: var(--monitor-accent, var(--text-color)) !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-kpi .ant-statistic-content),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-kpi .ant-statistic-content-value),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-kpi .ant-statistic-content-value-int),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-kpi .ant-statistic-content-value-decimal),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-kpi .ant-statistic-content-suffix),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row__value .ant-statistic-content),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row__value .ant-statistic-content-value),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row__value .ant-statistic-content-value-int),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row__value .ant-statistic-content-value-decimal),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row__value .ant-statistic-content-suffix) {
  color: var(--monitor-accent, var(--text-color)) !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-kpi .ant-statistic-content) {
  font-weight: 700 !important;
  letter-spacing: -0.02em;
  text-shadow: 0 8px 22px rgba(0, 0, 0, 0.22);
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-kpi .ant-statistic-content-suffix) {
  font-size: 0.58em !important;
  font-weight: 600 !important;
  opacity: 0.96;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row__value .ant-statistic-content) {
  font-weight: 650 !important;
  letter-spacing: -0.01em;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row__value .ant-statistic-content-suffix) {
  font-size: 0.65em !important;
  font-weight: 600 !important;
  opacity: 0.92;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row__trend) {
  color: #7f93ad !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row__inline-percent),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row__inline-detail) {
  color: #eef4ff !important;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.28);
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row__progress--compact .ant-progress-inner) {
  background: rgba(50, 67, 94, 0.82) !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-kpi__label) {
  color: #a8b8cf !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dashboard-kpi__meta),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row__meta),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .hero-summary-memory__head span),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .hero-summary-memory__legend-item span),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .disk-card__identity span),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .interface-card__identity span),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .interface-card__totals) {
  color: #8ea2bc !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .disk-card__summary) {
  color: #d6e2f1 !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .hero-summary-memory__head strong) {
  background: rgba(26, 39, 60, 0.9) !important;
  box-shadow: inset 0 0 0 1px rgba(90, 114, 147, 0.4) !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .hero-summary-memory__legend-item) {
  background: color-mix(in srgb, var(--memory-segment-color) 14%, rgba(24, 35, 53, 0.96)) !important;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--memory-segment-color) 18%, rgba(80, 98, 124, 0.28)) !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .resource-highlight-row__progress .ant-progress-inner),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .disk-card .ant-progress-inner),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .memory-composition__bar) {
  background: rgba(148, 164, 187, 0.16) !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .process-table .ant-table-thead > tr > th) {
  background: rgba(113, 167, 255, 0.1) !important;
  border-bottom-color: rgba(53, 81, 120, 0.34) !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .process-table .ant-table-tbody > tr > td) {
  border-bottom-color: rgba(53, 81, 120, 0.22) !important;
  background: transparent !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .process-rank),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .process-summary-chip) {
  background: rgba(113, 167, 255, 0.14) !important;
  color: #9bc2ff !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .collapse-btn) {
  background: rgba(20, 33, 51, 0.92) !important;
  border-color: rgba(53, 81, 120, 0.42) !important;
  color: var(--text-color) !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .collapse-btn:hover) {
  background: rgba(27, 41, 64, 0.96) !important;
  border-color: rgba(113, 167, 255, 0.42) !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dense-inline-pill) {
  background: rgba(20, 33, 51, 0.9) !important;
  border-color: rgba(53, 81, 120, 0.34) !important;
  color: var(--muted-color) !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .dense-inline-pill.is-active) {
  background: rgba(85, 194, 122, 0.14) !important;
  border-color: rgba(85, 194, 122, 0.24) !important;
  color: #7be29c !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .hero-alert-strip) {
  background: linear-gradient(180deg, rgba(245, 34, 45, 0.18), rgba(114, 28, 36, 0.2)) !important;
  border-color: rgba(245, 34, 45, 0.28) !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .hero-alert-strip__item) {
  background: rgba(21, 11, 14, 0.46) !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .hero-alert-strip__header strong),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .hero-alert-strip__message) {
  color: #ffb3b8 !important;
}

:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .hero-alert-strip__header span),
:global(body[data-theme="dark"] .right-panel--embedded.right-panel--monitor .hero-alert-strip__description) {
  color: #ffc8cc !important;
}
</style>
