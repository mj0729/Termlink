<template>
  <div class="right-panel">
    <!-- 内容区 - 可折叠，在左侧 -->
    <div class="panel-content-wrapper" :class="{ collapsed: collapsed }">
    
      <!-- 标题栏 -->
      <div class="panel-header">
        <div class="panel-header__copy">
          <span class="panel-header__eyebrow">Insights</span>
          <span class="panel-header__title">{{ activeTab === 'monitor' ? '系统监控' : '下载管理' }}</span>
        </div>
        <span class="panel-header__meta">
          {{ activeTab === 'monitor' ? '实时遥测' : `${downloads.length} 个任务` }}
        </span>
        <a-button 
          type="text" 
          size="small" 
          class="collapse-btn"
          @click="$emit('toggle')"
        >
          <RightOutlined />
        </a-button>
      </div>
      
      <!-- 系统监控内容 -->
      <div class="panel-content monitor-content" v-if="activeTab === 'monitor'">
        <!-- 系统基本信息 -->
        <div class="info-section">
          <div class="section-header">
            <DesktopOutlined class="section-icon" />
            <h4>系统信息</h4>
          </div>
          <div class="info-card">
            <div class="info-item">
              <div class="info-label">
                <LaptopOutlined class="item-icon" />
                主机名
              </div>
              <div class="info-value">{{ systemInfo.hostname || '-' }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">
                <WindowsOutlined class="item-icon" />
                操作系统
              </div>
              <div class="info-value">{{ systemInfo.os || '-' }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">
                <ControlOutlined class="item-icon" />
                架构
              </div>
              <div class="info-value">{{ systemInfo.arch || '-' }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">
                <CodeOutlined class="item-icon" />
                内核
              </div>
              <div class="info-value">{{ systemInfo.kernel || '-' }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">
                <ClockCircleOutlined class="item-icon" />
                运行时间
              </div>
              <div class="info-value">{{ formatUptime(systemInfo.uptime) }}</div>
            </div>
          </div>
        </div>
        
        <!-- CPU信息 -->
        <div class="info-section">
          <div class="section-header">
            <ThunderboltOutlined class="section-icon" />
            <h4>CPU使用率</h4>
          </div>
          <div class="info-card">
            <div class="cpu-info">
              <div class="cpu-model">{{ cpuInfo.model || 'CPU' }}</div>
              <div class="cpu-usage">{{ cpuInfo.usage?.toFixed(1) || 0 }}%</div>
            </div>
            <div class="progress-container">
              <a-progress 
                :percent="cpuInfo.usage || 0" 
                :show-info="false"
                :stroke-color="getProgressColor(cpuInfo.usage || 0)"
                :stroke-width="8"
              />
            </div>
          </div>
        </div>
        
        <!-- 内存信息 -->
        <div class="info-section">
          <div class="section-header">
            <DatabaseOutlined class="section-icon" />
            <h4>内存使用</h4>
          </div>
          <div class="info-card">
            <div class="memory-info">
              <div class="memory-stats">
                <span class="memory-label">物理内存</span>
                <span class="memory-usage">{{ formatSize(memoryInfo.used) }} / {{ formatSize(memoryInfo.total) }}</span>
              </div>
              <div class="usage-percent">{{ memoryInfo.usage?.toFixed(1) || 0 }}%</div>
            </div>
            <div class="progress-container">
              <a-progress 
                :percent="memoryInfo.usage || 0" 
                :show-info="false"
                :stroke-color="getProgressColor(memoryInfo.usage || 0)"
                :stroke-width="8"
              />
            </div>
            <div class="memory-details">
              <div class="detail-item">
                <span class="detail-label">可用:</span>
                <span class="detail-value">{{ formatSize(memoryInfo.available) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">缓存:</span>
                <span class="detail-value">{{ formatSize(memoryInfo.cached) }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 磁盘信息 -->
        <div class="info-section">
          <div class="section-header">
            <HddOutlined class="section-icon" />
            <h4>磁盘使用</h4>
          </div>
          <div class="info-card">
            <div 
              v-for="disk in diskInfo.slice(0, 2)" 
              :key="disk.device"
              class="disk-item"
            >
              <div class="disk-header">
                <div class="disk-info">
                  <span class="disk-device">{{ disk.device }}</span>
                  <span class="disk-mount">{{ disk.mountpoint }}</span>
                </div>
                <span class="disk-usage">{{ disk.usage?.toFixed(1) || 0 }}%</span>
              </div>
              <div class="progress-container">
                <a-progress 
                  :percent="disk.usage || 0" 
                  :show-info="false"
                  :stroke-color="getProgressColor(disk.usage || 0)"
                  :stroke-width="6"
                />
              </div>
              <div class="disk-stats">
                <span class="disk-stat">{{ formatSize(disk.used) }} / {{ formatSize(disk.total) }}</span>
                <span class="disk-type">{{ disk.filesystem }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 网络信息 -->
        <div class="info-section">
          <div class="section-header">
            <WifiOutlined class="section-icon" />
            <h4>网络接口</h4>
          </div>
          <div class="info-card">
            <div 
              v-for="interface_ in networkInfo.slice(0, 2)" 
              :key="interface_.name"
              class="network-item"
            >
              <div class="network-header">
                <div class="interface-info">
                  <span class="interface-name">{{ interface_.name }}</span>
                  <span class="interface-ip" v-if="interface_.ip">{{ interface_.ip }}</span>
                </div>
                <span class="interface-status" :class="{ active: interface_.status === 'up' }">
                  {{ interface_.status }}
                </span>
              </div>
              <div class="network-stats">
                <div class="network-stat">
                  <div class="stat-item">
                    <span class="stat-icon">↓</span>
                    <span class="stat-label">接收</span>
                    <span class="stat-value">{{ formatSize(interface_.rx_bytes) }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-icon">↑</span>
                    <span class="stat-label">发送</span>
                    <span class="stat-value">{{ formatSize(interface_.tx_bytes) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
    
    <!-- 下载管理内容 -->
    <div class="panel-content download-content" v-if="activeTab === 'download'">
      <div v-if="downloads.length === 0" class="empty-state">
        <a-empty description="暂无下载任务" />
      </div>
      
      <div v-else class="download-list">
        <div 
          v-for="download in downloads" 
          :key="download.id"
          class="download-item"
          :class="{ 
            completed: download.status === 'completed', 
            error: download.status === 'error' 
          }"
        >
          <div class="download-info">
            <div class="file-name">{{ download.fileName }}</div>
            <div class="file-path">{{ download.savePath }}</div>
            
            <!-- 进度条 -->
            <a-progress 
              v-if="download.status === 'downloading'"
              :percent="download.progress" 
              size="small"
              :show-info="false"
            />
            
            <!-- 状态信息 -->
            <div class="download-status">
              <span v-if="download.status === 'downloading'">
                <template v-if="download.total > 0">
                  {{ formatSize(download.downloaded) }} / {{ formatSize(download.total) }}
                  <span v-if="download.progress > 0">({{ download.progress }}%)</span>
                </template>
                <template v-else>
                  正在下载...
                </template>
              </span>
              <span v-else-if="download.status === 'completed'" class="success">
                完成 - {{ formatSize(download.total) }}
              </span>
              <span v-else-if="download.status === 'error'" class="error">
                失败: {{ download.error }}
              </span>
            </div>
          </div>
          
          <div class="download-actions">
            <a-button 
              v-if="download.status === 'downloading'"
              type="text" 
              size="small" 
              danger
              @click="cancelDownload(download.id)"
              title="取消"
            >
              <StopOutlined />
            </a-button>
            
            <a-button 
              v-if="download.status === 'completed'"
              type="text" 
              size="small"
              @click="openFileLocation(download.savePath)"
              title="打开"
            >
              <FolderOpenOutlined />
            </a-button>
            
            <a-button 
              type="text" 
              size="small" 
              danger
              @click="removeDownload(download.id)"
              title="移除"
            >
              <DeleteOutlined />
            </a-button>
          </div>
        </div>
      </div>
      
      <div class="download-footer" v-if="downloads.length > 0">
        <a-button size="small" @click="clearCompleted">
          清除已完成
        </a-button>
      </div>
    </div>
    </div>
    
    <!-- 按钮栏 - 始终显示，在最右侧 -->
    <div class="sidebar-buttons">
      <a-tooltip placement="left" title="系统监控">
        <a-button 
          :type="activeTab === 'monitor' ? 'primary' : 'default'"
          size="large"
          @click="handleTabClick('monitor')"
          class="sidebar-btn"
        >
          <DesktopOutlined />
        </a-button>
      </a-tooltip>
      
      <a-tooltip placement="left" title="下载管理">
        <a-button 
          :type="activeTab === 'download' ? 'primary' : 'default'"
          size="large"
          @click="handleTabClick('download')"
          class="sidebar-btn"
        >
          <DownloadOutlined />
        </a-button>
      </a-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
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
  StopOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
  RightOutlined
} from '@antdv-next/icons'
import { message } from 'antdv-next'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type {
  DownloadItem,
  DownloadProgressPayload,
  MonitorTab,
  SshProfile,
  SystemInfoBatch,
  SystemStaticInfo,
  CpuInfo,
  MemoryInfo,
  DiskInfo,
  NetworkInfo,
} from '../types/app'

const props = withDefaults(defineProps<{
  collapsed?: boolean
  connectionId?: string
  sshProfile?: SshProfile | null
}>(), {
  collapsed: false,
  connectionId: '',
  sshProfile: null
})

const emit = defineEmits(['toggle'])

// 状态数据
const systemInfo = ref<SystemStaticInfo>({})
const cpuInfo = ref<CpuInfo>({})
const memoryInfo = ref<MemoryInfo>({})
const diskInfo = ref<DiskInfo[]>([])
const networkInfo = ref<NetworkInfo[]>([])

// 下载管理状态
const activeTab = ref<MonitorTab>('monitor')
const downloads = ref<DownloadItem[]>([])
let downloadIdCounter = 0
let progressUnlisten: (() => void) | null = null

// 活跃下载数量
const activeDownloads = computed(() => {
  return downloads.value.filter(d => d.status === 'downloading').length
})

// 处理标签点击
function handleTabClick(tab: MonitorTab) {
  // 如果点击的是当前激活的标签，切换折叠状态
  if (activeTab.value === tab) {
    emit('toggle')
  } else {
    // 切换到新标签
    activeTab.value = tab
    // 如果当前是折叠状态，自动展开
    if (props.collapsed) {
      emit('toggle')
    }
  }
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null
let refreshInterval = 3000 // 初始刷新间隔3秒
const minInterval = 3000 // 最小间隔3秒
const maxInterval = 30000 // 最大间隔30秒
let errorCount = 0

// 存储监控连接的配置信息
let monitoringProfile: SshProfile | null = null
let monitoringConnectionEstablished = false

// 确保监控SSH连接已建立
async function ensureMonitoringConnection() {
  if (!props.connectionId) {
    console.warn('connectionId为空，无法建立监控连接')
    return false
  }
  
  // 如果连接已经建立，直接返回
  if (monitoringConnectionEstablished) {
    return true
  }
  
  try {
    // 使用传入的profile信息（从App.vue传递）
    if (!props.sshProfile) {
      console.error('未收到SSH配置信息')
      return false
    }
    
    // 获取密码
    let password: string | null = null
    if (props.sshProfile.save_password) {
      try {
        password = await invoke<string>('get_ssh_password', { id: props.sshProfile.id })
      } catch (pwdError) {
        console.error('获取SSH密码失败:', pwdError)
        return false
      }
    }
    
    // 建立或复用监控连接
    await invoke('connect_ssh_for_monitoring', {
      connectionId: props.connectionId,
      host: props.sshProfile.host,
      port: props.sshProfile.port,
      username: props.sshProfile.username,
      password: password
    })
    
    // 保存配置信息以便后续使用
    monitoringProfile = props.sshProfile
    monitoringConnectionEstablished = true
    console.log('✓ 监控SSH连接已建立/复用')
    return true
    
  } catch (error) {
    console.error('建立监控SSH连接失败:', error)
    monitoringConnectionEstablished = false
    return false
  }
}

// 监控数据刷新
async function refreshData() {
  if (!props.connectionId) return
  
  const startTime = Date.now()
  
  try {
    // 确保监控连接已建立
    const connected = await ensureMonitoringConnection()
    if (!connected) {
      throw new Error('无法建立监控SSH连接')
    }
    
    // 使用批量命令一次性获取所有系统信息，大幅减少SSH请求次数
    const batchInfo = await invoke<SystemInfoBatch>('get_all_system_info_batch', { connectionId: props.connectionId })
    
    // 更新所有数据
    if (batchInfo.system.hostname) systemInfo.value = batchInfo.system
    if (batchInfo.cpu.usage !== undefined) cpuInfo.value = batchInfo.cpu
    if (batchInfo.memory.total) memoryInfo.value = batchInfo.memory
    if (batchInfo.disk.length > 0) diskInfo.value = batchInfo.disk
    if (batchInfo.network.length > 0) networkInfo.value = batchInfo.network
    
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
  
  scheduleNext()
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
  
  // 断开监控连接
  if (props.connectionId && monitoringConnectionEstablished) {
    invoke('disconnect_ssh_monitoring', { connectionId: props.connectionId })
      .then(() => {
        monitoringConnectionEstablished = false
        console.log('✓ 监控SSH连接已断开')
      })
      .catch(err => console.error('断开监控连接失败:', err))
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

// 生命周期
onMounted(async () => {
  // 不自动刷新，等待用户手动展开
  
  // 监听下载进度事件
  progressUnlisten = await listen<DownloadProgressPayload>('download-progress', (event) => {
    const { downloadId, downloaded, total, progress } = event.payload
    const download = downloads.value.find(d => d.id === downloadId)
    if (download && download.status === 'downloading') {
      download.downloaded = downloaded
      download.total = total
      download.progress = progress
      console.log(`📥 下载进度: ${download.fileName} - ${progress}% (${formatSize(downloaded)}/${formatSize(total)})`)
    }
  })
})

onUnmounted(() => {
  stopAutoRefresh()
  // 取消事件监听
  if (progressUnlisten) {
    progressUnlisten()
  }
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

// ============ 下载管理函数 ============

// 添加下载任务
function addDownload(fileName: string, remotePath: string, savePath: string, connectionId: string) {
  console.log('=== addDownload 被调用 ===', {
    fileName,
    remotePath,
    savePath,
    connectionId
  })
  
  const downloadId = ++downloadIdCounter
  const download: DownloadItem = {
    id: downloadId,
    fileName,
    remotePath,
    savePath,
    connectionId,
    status: 'downloading',
    progress: 0,
    downloaded: 0,
    total: 0,
    speed: 0,
    startTime: Date.now(),
    error: null
  }
  
  downloads.value.push(download)
  console.log('下载任务已添加到列表，开始下载...')
  startDownload(download)
  
  // 自动切换到下载标签页
  activeTab.value = 'download'
  
  return downloadId
}

// 开始下载
async function startDownload(download: DownloadItem) {
  console.log('=== startDownload 开始（真实进度）===', download)
  
  try {
    console.log('开始调用 download_sftp_file API（带真实进度）...')
    
    // 调用后端下载API（带真实进度）
    await invoke('download_sftp_file', {
      connectionId: download.connectionId,
      remotePath: download.remotePath,
      localPath: download.savePath,
      downloadId: download.id
    })
    
    console.log('✓ download_sftp_file API 调用成功')
    
    if (download.status !== 'cancelled') {
      download.status = 'completed'
      download.progress = 100
      console.log('✓ 下载完成！')
      message.success(`文件下载完成: ${download.fileName}`)
    }
  } catch (error) {
    console.error('✗ 下载过程中出错:', error)
    if (download.status !== 'cancelled') {
      download.status = 'error'
      download.error = error.toString()
      message.error(`下载失败: ${download.fileName}`)
    }
  }
}

// 取消下载
function cancelDownload(downloadId: number) {
  const download = downloads.value.find(d => d.id === downloadId)
  if (download) {
    download.status = 'cancelled'
    message.info(`已取消下载: ${download.fileName}`)
  }
}

// 打开文件位置
async function openFileLocation(filePath: string) {
  console.log('打开文件位置:', filePath)
  try {
    await invoke('open_file_location', { path: filePath })
    message.success('已打开文件所在位置')
  } catch (error) {
    console.error('打开文件位置失败:', error)
    message.error('无法打开文件位置: ' + error)
  }
}

// 移除下载记录
function removeDownload(downloadId: number) {
  const index = downloads.value.findIndex(d => d.id === downloadId)
  if (index !== -1) {
    downloads.value.splice(index, 1)
  }
}

// 清除已完成的下载
function clearCompleted() {
  downloads.value = downloads.value.filter(d => 
    d.status === 'downloading'
  )
}

// 暴露方法给父组件
defineExpose({
  addDownload
})
</script>

<style scoped>
.right-panel {
  display: flex;
  height: 100%;
  background: var(--panel-bg);
  position: relative;
}

.panel-content-wrapper {
  display: flex;
  flex-direction: column;
  width: 328px;
  border-left: 1px solid var(--border-subtle);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.38), rgba(255, 255, 255, 0)),
    var(--panel-bg);
  transition:
    width 0.28s ease,
    opacity 0.28s ease;
  overflow: hidden;
  flex-shrink: 0;
}

.panel-content-wrapper.collapsed {
  width: 0;
  opacity: 0;
  pointer-events: none;
  border-left: none;
}

.sidebar-buttons {
  width: 72px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 12px;
  background: var(--monitor-rail-bg);
  border-left: 1px solid var(--border-subtle);
  margin-left: auto;
}

.sidebar-btn {
  width: 48px !important;
  height: 48px !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: var(--surface-1) !important;
}

.sidebar-btn :deep(.anticon) {
  font-size: 20px;
}

.panel-header {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 10px;
  padding: 18px 18px 16px;
  background: var(--panel-header-bg);
  border-bottom: 1px solid var(--border-subtle);
}

.panel-header__copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.panel-header__eyebrow {
  color: var(--muted-color);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.panel-header__title {
  margin-top: 4px;
  color: var(--text-color);
  font-size: 17px;
  font-weight: 700;
}

.panel-header__meta {
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border-color);
  color: var(--muted-color);
  font-size: 11px;
  font-weight: 700;
}

.collapse-btn {
  width: 34px !important;
  height: 34px !important;
  border-radius: 12px;
  color: var(--muted-color);
}

.panel-content {
  padding: 16px;
  overflow-y: auto;
}

.monitor-content {
  flex: 1;
  min-height: 0;
}

.info-section {
  margin-bottom: 18px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 0 4px;
}

.section-icon {
  color: var(--primary-color);
  font-size: 16px;
}

.section-header h4 {
  margin: 0;
  color: var(--text-color);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.info-card {
  padding: 14px;
  border-radius: 20px;
  background: var(--monitor-card-bg);
  border: 1px solid var(--border-color);
  box-shadow: 0 14px 28px rgba(41, 71, 116, 0.08);
}

.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--muted-color);
  font-size: 12px;
  font-weight: 600;
}

.item-icon {
  color: var(--primary-color);
  font-size: 14px;
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
  font-size: 12px;
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
  margin-bottom: 12px;
}

.cpu-model,
.memory-label {
  color: var(--text-color);
  font-size: 12px;
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
  font-size: 20px;
  font-weight: 700;
}

.memory-stats,
.disk-info,
.interface-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.memory-usage,
.disk-mount,
.interface-ip,
.detail-label,
.stat-label,
.disk-type {
  color: var(--muted-color);
  font-size: 11px;
}

.progress-container {
  margin: 8px 0 0;
}

.memory-details,
.disk-stats,
.network-stats {
  margin-top: 12px;
}

.memory-details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.detail-item,
.disk-item,
.network-item,
.stat-item {
  border-radius: 16px;
  border: 1px solid var(--border-color);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  background: var(--surface-1);
  align-items: flex-start;
}

.disk-item,
.network-item {
  padding: 12px;
  background: var(--monitor-card-strong);
}

.disk-item + .disk-item,
.network-item + .network-item {
  margin-top: 10px;
}

.disk-device,
.interface-name {
  color: var(--text-color);
  font-size: 12px;
  font-weight: 700;
}

.disk-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.disk-type {
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--surface-1);
  text-transform: uppercase;
}

.interface-status {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
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
  gap: 8px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: var(--surface-1);
}

.stat-icon {
  color: var(--primary-color);
  font-size: 14px;
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

.download-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.download-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: var(--monitor-card-bg);
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.download-item:hover {
  transform: translateY(-1px);
  border-color: var(--strong-border);
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
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.download-info .file-path {
  margin-bottom: 8px;
  color: var(--muted-color);
  font-size: 11px;
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.download-status {
  margin-top: 6px;
  font-size: 11px;
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

.download-footer {
  padding: 12px 16px 16px;
  border-top: 1px solid var(--border-subtle);
  background: var(--panel-header-bg);
}

@media (max-width: 768px) {
  .panel-content-wrapper {
    width: 250px;
  }

  .sidebar-buttons {
    width: 60px;
    padding-inline: 8px;
  }
}
</style>
