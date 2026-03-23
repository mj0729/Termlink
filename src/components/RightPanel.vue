<template>
  <div class="right-panel" :class="[`right-panel--${activeTab}`, `right-panel--${placement}`, { 'right-panel--embedded': embedded }]">
    <div class="panel-content-wrapper" :class="{ collapsed }">
      <RightPanelMonitorView
        v-if="activeTab === 'monitor'"
        :collapsed="collapsed"
        :connection-id="connectionId"
        :ssh-profile="sshProfile"
        :active-tab="activeTab"
        :placement="placement"
        :embedded="embedded"
        @toggle="emit('toggle')"
      />

      <div v-else class="panel-content download-content">
        <div v-if="defaultUploadConflictStrategyLabel" class="transfer-default-strategy">
          <div class="transfer-default-strategy__copy">
            <span class="transfer-default-strategy__label">默认同名文件策略</span>
            <strong>{{ defaultUploadConflictStrategyLabel }}</strong>
          </div>
          <a-button type="text" size="small" @click="clearDefaultUploadConflictStrategy">
            清除
          </a-button>
        </div>

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
              error: group.status === 'error',
            }"
          >
            <div class="download-info">
              <div class="file-name-row">
                <component :is="group.direction === 'download' ? DownloadOutlined : UploadOutlined" class="file-direction-icon" />
                <span class="file-name">{{ group.label }}</span>
                <span class="direction-badge">{{ group.direction === 'download' ? '下载' : '上传' }}</span>
              </div>

              <div class="file-path">
                <span class="file-path__label">源</span>
                <span>{{ group.sourceLabel }}</span>
              </div>
              <div class="file-path">
                <span class="file-path__label">目标</span>
                <span>{{ group.targetLabel }}</span>
              </div>

              <div v-if="group.note" class="transfer-note">{{ group.note }}</div>
              <div v-if="group.count > 1 && group.statusSummary" class="transfer-batch-summary">
                {{ group.statusSummary }}
              </div>

              <div class="download-status">
                <template v-if="group.status === 'running'">
                  进行中 {{ group.progress }}% - {{ formatSize(group.transferred) }} / {{ formatSize(group.total) }}
                  <span v-if="group.speed > 0"> - {{ formatSpeed(group.speed) }}</span>
                </template>
                <span v-else-if="group.status === 'completed'" class="success">
                  已完成 {{ group.count > 1 ? `(${group.count} 项)` : '' }}
                  <span v-if="group.total > 0"> - {{ formatSize(group.total) }}</span>
                </span>
                <span v-else-if="group.status === 'error'" class="error">
                  失败{{ group.error ? `: ${group.error}` : '' }}
                </span>
                <span v-else-if="group.status === 'cancelled'">已取消</span>
                <span v-else-if="group.status === 'skipped'">已跳过</span>
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
                v-if="group.direction === 'download' && group.items[0]?.targetPath"
                type="text"
                size="small"
                @click="openFileLocation(group.items[0].targetPath)"
                title="打开位置"
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
          <a-button size="small" @click="clearCompleted">清除已完成</a-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  DeleteOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  StopOutlined,
  UploadOutlined,
} from '@antdv-next/icons'
import { formatBytes, formatTransferSpeed } from '../utils/formatters'
import RightPanelMonitorView from './right-panel/RightPanelMonitorView.vue'
import { useRightPanelTransfers } from '../composables/useRightPanelTransfers'
import type { MonitorTab, SshProfile } from '../types/app'

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

const activeTab = ref<MonitorTab>(props.activeTab)
const {
  transfers,
  defaultUploadConflictStrategyLabel,
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
  clearDefaultUploadConflictStrategy,
} = useRightPanelTransfers(activeTab)

const formatSize = formatBytes
const formatSpeed = formatTransferSpeed

watch(() => props.activeTab, (newTab) => {
  activeTab.value = newTab
})

watch(activeTab, (newTab) => {
  emit('tab-change', newTab)
}, { immediate: true })

defineExpose({
  addDownload,
  addUpload,
})
</script>

<style scoped>
.right-panel {
  display: flex;
  height: 100%;
  min-height: 0;
  background: transparent;
  position: relative;
}

.panel-content-wrapper {
  display: flex;
  flex-direction: column;
  width: 286px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--surface-1);
  border-left: 1px solid var(--border-color);
  transition:
    width 0.28s ease,
    opacity 0.28s ease;
}

.right-panel--left .panel-content-wrapper {
  border-left: none;
  border-right: 1px solid var(--border-color);
}

.right-panel--embedded.right-panel--monitor .panel-content-wrapper {
  width: 100%;
  border-right: none;
}

.panel-content-wrapper.collapsed {
  width: 0;
  opacity: 0;
  pointer-events: none;
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

.download-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.transfer-default-strategy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--surface-2);
}

.transfer-default-strategy__copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.transfer-default-strategy__label {
  font-size: 11px;
  color: var(--muted-color);
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
  color: var(--muted-color);
  font-size: 10px;
  font-weight: 700;
}

.transfer-filter:deep(.ant-segmented-item-selected) {
  color: var(--primary-color);
  background: var(--surface-1);
  border-color: var(--primary-ring);
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
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

.download-list {
  flex: 1;
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
  min-width: 0;
  margin-right: 8px;
}

.file-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
}

.file-name {
  color: var(--text-color);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.file-path {
  color: var(--muted-color);
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
  font-size: 10px;
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

.transfer-batch-summary {
  margin-top: 6px;
  color: var(--muted-color);
  font-size: 10px;
}

.download-status {
  margin-top: 6px;
  color: var(--muted-color);
  font-size: 10px;
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

.download-footer {
  padding: 8px 0 4px;
}

@media (max-width: 768px) {
  .panel-content-wrapper {
    width: 236px;
  }

  .right-panel--embedded.right-panel--monitor .panel-content-wrapper {
    width: 100%;
  }
}
</style>
