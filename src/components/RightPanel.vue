<template>
  <div class="right-panel" :class="[`right-panel--${activeTab}`, `right-panel--${placement}`, { 'right-panel--embedded': embedded }]">
    <!-- 内容区 - 可折叠，在左侧 -->
    <div class="panel-content-wrapper" :class="{ collapsed: collapsed }">
    
      <!-- 标题栏 -->
      <div class="panel-header">
        <div class="panel-header__copy">
          <span class="panel-header__eyebrow">Insights</span>
          <span class="panel-header__title">{{ activeTab === 'monitor' ? '系统监控' : '传输管理' }}</span>
        </div>
        <span class="panel-header__meta">
          {{ activeTab === 'monitor' ? '实时遥测' : `运行 ${transferStats.running} / 完成 ${transferStats.completed} / 失败 ${transferStats.error}` }}
        </span>
        <a-button 
          type="text" 
          size="small" 
          class="collapse-btn"
          @click="$emit('toggle')"
        >
          <LeftOutlined v-if="placement === 'left'" />
          <RightOutlined v-else />
        </a-button>
      </div>
      
      <!-- 系统监控内容 -->
      <div class="panel-content monitor-content" v-if="activeTab === 'monitor'">
        <div class="info-section info-section--dense">
          <div class="section-header section-header--dense">
            <DesktopOutlined class="section-icon" />
            <h4>系统信息</h4>
          </div>
          <div class="info-card info-card--dense">
            <div class="compact-kv-list">
              <div class="compact-kv-row">
                <span class="compact-kv-label"><LaptopOutlined class="item-icon" />主机名</span>
                <span class="compact-kv-value">{{ systemInfo.hostname || '-' }}</span>
              </div>
              <div class="compact-kv-row">
                <span class="compact-kv-label"><WindowsOutlined class="item-icon" />操作系统</span>
                <span class="compact-kv-value">{{ systemInfo.os || '-' }}</span>
              </div>
              <div class="compact-kv-row">
                <span class="compact-kv-label"><ControlOutlined class="item-icon" />架构</span>
                <span class="compact-kv-value">{{ systemInfo.arch || '-' }}</span>
              </div>
              <div class="compact-kv-row">
                <span class="compact-kv-label"><CodeOutlined class="item-icon" />内核</span>
                <span class="compact-kv-value">{{ systemInfo.kernel || '-' }}</span>
              </div>
              <div class="compact-kv-row">
                <span class="compact-kv-label"><ClockCircleOutlined class="item-icon" />运行时间</span>
                <span class="compact-kv-value">{{ formatUptime(systemInfo.uptime) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="info-section info-section--dense">
          <div class="section-header section-header--dense">
            <ThunderboltOutlined class="section-icon" />
            <h4>资源使用</h4>
          </div>
          <div class="info-card info-card--dense">
            <div class="resource-rows">
              <div class="resource-row">
                <div class="resource-row__label">CPU</div>
                <div class="resource-row__bar">
                  <a-progress 
                    :percent="cpuInfo.usage || 0" 
                    :show-info="false"
                    :stroke-color="getProgressColor(cpuInfo.usage || 0)"
                    :stroke-width="5"
                  />
                </div>
                <div class="resource-row__value">{{ cpuInfo.usage?.toFixed(1) || 0 }}%</div>
                <div class="resource-row__meta">{{ cpuInfo.cores?.length ? `${cpuInfo.cores.length} 核` : (cpuInfo.model || 'CPU') }}</div>
              </div>

              <div class="resource-row">
                <div class="resource-row__label">内存</div>
                <div class="resource-row__bar">
                  <a-progress 
                    :percent="memoryInfo.usage || 0" 
                    :show-info="false"
                    :stroke-color="getProgressColor(memoryInfo.usage || 0)"
                    :stroke-width="5"
                  />
                </div>
                <div class="resource-row__value">{{ memoryInfo.usage?.toFixed(1) || 0 }}%</div>
                <div class="resource-row__meta">{{ formatSize(memoryInfo.used) }} / {{ formatSize(memoryInfo.total) }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="info-section info-section--dense">
          <div class="section-header section-header--dense">
            <ControlOutlined class="section-icon" />
            <h4>活跃进程</h4>
          </div>
          <div class="info-card info-card--dense">
            <div class="process-mini-table">
              <div class="process-mini-table__head">
                <span>内存</span>
                <span>CPU</span>
                <span>命令</span>
              </div>
              <div
                v-for="process in processInfo.top || []"
                :key="`${process.command}-${process.memory_kb}-${process.cpu_percent}`"
                class="process-mini-table__row"
              >
                <span class="process-mini-table__memory">{{ formatProcessMemory(process.memory_kb) }}</span>
                <span class="process-mini-table__cpu">{{ formatProcessCpu(process.cpu_percent) }}</span>
                <span class="process-mini-table__command">{{ process.command || '-' }}</span>
              </div>
            </div>
            <div class="process-mini-summary">
              <span>总 {{ processInfo.total || 0 }}</span>
              <span>运行 {{ processInfo.running || 0 }}</span>
              <span>休眠 {{ processInfo.sleeping || 0 }}</span>
            </div>
          </div>
        </div>

        <div class="info-section info-section--dense">
          <div class="section-header section-header--dense">
            <DatabaseOutlined class="section-icon" />
            <h4>内存细节</h4>
          </div>
          <div class="info-card info-card--dense">
            <div class="dense-detail-grid">
              <div class="dense-detail-card">
                <span class="dense-detail-label">可用</span>
                <span class="dense-detail-value">{{ formatSize(memoryInfo.available) }}</span>
              </div>
              <div class="dense-detail-card">
                <span class="dense-detail-label">缓存</span>
                <span class="dense-detail-value">{{ formatSize(memoryInfo.cached) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="info-section info-section--dense">
          <div class="section-header section-header--dense section-header--spread">
            <HddOutlined class="section-icon" />
            <div class="section-header__title-wrap">
              <h4>磁盘使用</h4>
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
          <div class="dense-list-card">
            <div 
              v-for="disk in visibleDiskInfo" 
              :key="`${disk.device}-${disk.mountpoint}`"
              class="dense-list-row"
            >
              <div class="metric-head metric-head--row">
                <div class="metric-copy">
                  <div class="metric-title">{{ disk.device }}</div>
                  <div class="metric-sub">{{ disk.mountpoint || '-' }}</div>
                </div>
                <div class="metric-value">{{ disk.usage?.toFixed(1) || 0 }}%</div>
              </div>
              <div class="dense-meter-row">
                <div class="dense-meter-track">
                  <a-progress 
                    :percent="disk.usage || 0" 
                    :show-info="false"
                    :stroke-color="getProgressColor(disk.usage || 0)"
                    :stroke-width="5"
                  />
                </div>
                <span class="dense-meter-text">{{ formatSize(disk.available) }} / {{ formatSize(disk.total) }}</span>
                <span class="dense-inline-pill">{{ disk.filesystem || '-' }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="info-section info-section--dense">
          <div class="section-header section-header--dense">
            <WifiOutlined class="section-icon" />
            <h4>网络接口</h4>
          </div>
          <div class="dense-list-card">
            <div 
              v-for="interface_ in networkInfo.slice(0, 2)" 
              :key="interface_.name"
              class="dense-list-row"
            >
              <div class="metric-head metric-head--row">
                <div class="metric-copy">
                  <div class="metric-title">{{ interface_.name }}</div>
                  <div class="metric-sub">{{ interface_.ip || '未分配 IP' }}</div>
                </div>
                <span class="dense-inline-pill" :class="{ 'is-active': interface_.status === 'up' }">
                  {{ interface_.status || 'unknown' }}
                </span>
              </div>
              <div class="dense-network-grid">
                <div class="dense-network-item">
                  <span class="dense-network-label">↓ 接收</span>
                  <span class="dense-network-value">{{ formatSize(interface_.rx_bytes) }}</span>
                </div>
                <div class="dense-network-item">
                  <span class="dense-network-label">↑ 发送</span>
                  <span class="dense-network-value">{{ formatSize(interface_.tx_bytes) }}</span>
                </div>
              </div>
            </div>
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
import { computed, h, ref, onMounted, onUnmounted, watch } from 'vue'
import { 
  DesktopOutlined,
  LaptopOutlined,
  WindowsOutlined,
  ControlOutlined,
  CodeOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  HddOutlined,
  WifiOutlined,
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
  ProcessEntry,
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

// 状态数据
const systemInfo = ref<SystemStaticInfo>({})
const cpuInfo = ref<CpuInfo>({})
const memoryInfo = ref<MemoryInfo>({})
const diskInfo = ref<DiskInfo[]>([])
const networkInfo = ref<NetworkInfo[]>([])
const processInfo = ref<ProcessInfo>({})
const showAllDisks = ref(false)

// 下载管理状态
const activeTab = ref<MonitorTab>(props.activeTab)
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

function rankDisk(disk: DiskInfo) {
  const mountpoint = disk.mountpoint || ''
  if (mountpoint === '/') return 0
  if (mountpoint === '/boot/efi') return 1
  if (mountpoint === '/boot') return 2
  if (mountpoint === '/home') return 3
  if (mountpoint === '/var') return 4
  if ((disk.device || '').startsWith('/dev/')) return 10
  return 20
}

const sortedDiskInfo = computed(() => (
  [...diskInfo.value].sort((left, right) => {
    const rankDiff = rankDisk(left) - rankDisk(right)
    if (rankDiff !== 0) return rankDiff
    return (left.mountpoint || left.device || '').localeCompare(right.mountpoint || right.device || '')
  })
))

const hasExtraDiskInfo = computed(() => sortedDiskInfo.value.length > 2)
const visibleDiskInfo = computed(() => (
  showAllDisks.value ? sortedDiskInfo.value : sortedDiskInfo.value.slice(0, 2)
))

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
    
    errorCount = 0 // 重置错误计数
    
    // 成功后减少刷新间隔（更频繁），但不低于最小值
    refreshInterval = Math.max(minInterval, refreshInterval * 0.95)
    
    const elapsed = Date.now() - startTime
    console.log(`系统监控刷新完成，耗时: ${elapsed}ms，下次刷新间隔: ${refreshInterval}ms`)
    
  } catch (error) {
    console.error('获取系统信息失败:', error)
    errorCount++
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
  if (percentage < 50) return '#52c41a'
  if (percentage < 80) return '#faad14'
  return '#ff4d4f'
}

function formatSpeed(bytesPerSecond: number) {
  return `${formatSize(bytesPerSecond)}/s`
}

function formatProcessMemory(memoryKb?: number) {
  return formatSize((memoryKb || 0) * 1024)
}

function formatProcessCpu(cpuPercent?: number) {
  return `${(cpuPercent || 0).toFixed(1)}`
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

.panel-content-wrapper.collapsed {
  width: 0;
  opacity: 0;
  pointer-events: none;
}

.panel-header {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 8px;
  padding: 10px 10px 8px;
  background: transparent;
  border-bottom: 1px solid var(--border-color);
}

.panel-header__copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.panel-header__eyebrow {
  color: var(--muted-color);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.panel-header__title {
  margin-top: 2px;
  color: var(--text-color);
  font-size: 16px;
  font-weight: 700;
}

.panel-header__meta {
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--surface-1);
  border: 1px solid var(--border-color);
  color: var(--muted-color);
  font-size: 9px;
  font-weight: 800;
  max-width: 132px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
}

.monitor-content {
  flex: 1;
  min-height: 0;
  padding: 6px 6px 8px;
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
</style>
