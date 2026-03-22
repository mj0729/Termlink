<template>
  <div class="download-manager" v-if="downloads.length > 0">
    <div class="download-header">
      <span>下载管理器</span>
      <a-button type="text" size="small" @click="clearCompleted" title="清除已完成">
        <ClearOutlined />
      </a-button>
    </div>
    
    <div class="download-list">
      <div 
        v-for="download in downloads" 
        :key="download.id"
        class="download-item"
        :class="{ completed: download.status === 'completed', error: download.status === 'error' }"
      >
        <div class="download-info">
          <div class="file-name">{{ download.fileName }}</div>
          <div class="file-path">{{ download.targetPath }}</div>
          
          <!-- 进度条 -->
          <a-progress 
            v-if="download.status === 'running'"
            :percent="download.progress" 
            size="small"
            :show-info="false"
          />
          
          <!-- 状态信息 -->
          <div class="download-status">
            <span v-if="download.status === 'running'">
              {{ formatSize(download.transferred) }} / {{ formatSize(download.total) }}
              ({{ download.progress }}%) - {{ formatSpeed(download.speed) }}
            </span>
            <span v-else-if="download.status === 'completed'" class="success">
              下载完成 - {{ formatSize(download.total) }}
            </span>
            <span v-else-if="download.status === 'error'" class="error">
              下载失败: {{ download.error }}
            </span>
            <span v-else-if="download.status === 'cancelled'" class="cancelled">
              已取消
            </span>
          </div>
        </div>
        
        <div class="download-actions">
          <a-button 
            v-if="download.status === 'running'"
            type="text" 
            size="small" 
            danger
            @click="cancelDownload(download.id)"
            title="取消下载"
          >
            <StopOutlined />
          </a-button>
          
          <a-button 
            v-if="download.status === 'completed'"
            type="text" 
            size="small"
            @click="openFileLocation(download.targetPath)"
            title="打开文件位置"
          >
            <FolderOpenOutlined />
          </a-button>
          
          <a-button 
            v-if="download.status === 'error'"
            type="text" 
            size="small"
            @click="retryDownload(download.id)"
            title="重试下载"
          >
            <ReloadOutlined />
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { 
  ClearOutlined, 
  StopOutlined, 
  FolderOpenOutlined, 
  ReloadOutlined,
  DeleteOutlined 
} from '@antdv-next/icons'
import type { DownloadRequest } from '../types/app'
import { useTransferManager } from '../composables/useTransferManager'
import { formatBytes, formatTransferSpeed } from '../utils/formatters'

const {
  transfers,
  enqueueDownload,
  cancelTransfer,
  retryTransfer,
  removeTransfer,
  clearCompleted,
  openFileLocation,
} = useTransferManager()

const downloads = computed(() => (
  transfers.value.filter((transfer) => transfer.direction === 'download')
))

// 添加下载任务
function addDownload(fileName: string, remotePath: string, savePath: string, connectionId: string) {
  const transfer = enqueueDownload({
    fileName,
    remotePath,
    savePath,
    connectionId,
  } satisfies DownloadRequest)

  return transfer.id
}

// 取消下载
async function cancelDownload(downloadId: number) {
  await cancelTransfer(downloadId)
}

// 重试下载
function retryDownload(downloadId: number) {
  retryTransfer(downloadId)
}

// 移除下载记录
function removeDownload(downloadId: number) {
  removeTransfer(downloadId)
}

const formatSize = formatBytes
const formatSpeed = formatTransferSpeed

// 暴露方法给父组件
defineExpose({
  addDownload,
  cancelDownload
})
</script>

<style scoped>
.download-manager {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 400px;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.download-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--panel-header-bg);
  border-bottom: 1px solid var(--border-color);
  border-radius: 8px 8px 0 0;
  font-weight: 500;
}

.download-list {
  max-height: 300px;
  overflow-y: auto;
}

.download-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.download-item:last-child {
  border-bottom: none;
}

.download-item.completed {
  background: rgba(82, 196, 26, 0.05);
}

.download-item.error {
  background: rgba(255, 77, 79, 0.05);
}

.download-info {
  flex: 1;
  margin-right: 12px;
}

.file-name {
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--text-color);
}

.file-path {
  font-size: 12px;
  color: var(--muted-color);
  margin-bottom: 8px;
  font-family: monospace;
}

.download-status {
  font-size: 12px;
  margin-top: 4px;
}

.download-status .success {
  color: var(--success-color);
}

.download-status .error {
  color: var(--error-color);
}

.download-status .cancelled {
  color: var(--muted-color);
}

.download-actions {
  display: flex;
  gap: 4px;
}

</style>
