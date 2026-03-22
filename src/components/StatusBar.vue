<template>
  <div class="status-bar">
    <div class="status-bar__main">
      <span
        class="status-dot"
        :class="connectionStateClass || { 'is-active': activeConnection && !connectionState }"
      ></span>
      <div class="status-connection-group">
        <span class="status-connection">
          {{ activeConnection || '从顶部连接带或连接中心开始' }}
        </span>
        <a-button
          v-if="activeConnectionCopyText"
          class="status-copy-btn"
          @click="copyActiveConnection"
          aria-label="复制 IP"
          title="复制 IP"
          type="text"
          size="small"
        >
          <CopyOutlined />
        </a-button>
      </div>
    </div>
    <div class="status-bar__meta">
      <a-button
        class="status-panel-btn"
        @click="$emit('showSettings')"
        aria-label="设置"
        title="设置"
        type="text"
        size="small"
      >
        <SettingOutlined />
      </a-button>
      <a-button
        class="status-panel-btn"
        :class="{ 'is-active': rightPanelTab === 'monitor' && !rightPanelCollapsed }"
        @click="$emit('selectRightPanelTab', 'monitor')"
        aria-label="系统监控"
        title="系统监控"
        type="text"
        size="small"
      >
        <DesktopOutlined />
      </a-button>
      <a-button
        class="status-panel-btn"
        :class="{ 'is-active': rightPanelTab === 'download' && !rightPanelCollapsed }"
        @click="$emit('selectRightPanelTab', 'download')"
        aria-label="传输管理"
        title="传输管理"
        type="text"
        size="small"
      >
        <DownloadOutlined />
      </a-button>
      <a-button
        v-if="showFileDrawerToggle"
        class="status-panel-btn"
        :class="{ 'is-active': fileDrawerOpen }"
        @click="$emit('toggleFileDrawer')"
        aria-label="文件区"
        title="文件区"
        type="text"
        size="small"
      >
        <FolderOpenOutlined />
      </a-button>
      <span class="status-hint">{{ tabCount }} 个工作区</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CopyOutlined, DesktopOutlined, DownloadOutlined, FolderOpenOutlined, SettingOutlined } from '@antdv-next/icons'
import { computed } from 'vue'
import type { PropType } from 'vue'
import { getConnectionStatusMeta } from '../constants/connectionStatus'
import type { ConnectionStatus, MonitorTab } from '../types/app'

const props = defineProps({
  activeConnection: {
    type: String,
    default: ''
  },
  activeConnectionCopyText: {
    type: String,
    default: ''
  },
  connectionState: {
    type: String as PropType<ConnectionStatus | ''>,
    default: ''
  },
  tabCount: {
    type: Number,
    default: 0
  },
  rightPanelTab: {
    type: String as PropType<MonitorTab>,
    default: 'monitor'
  },
  rightPanelCollapsed: {
    type: Boolean,
    default: false
  },
  showFileDrawerToggle: {
    type: Boolean,
    default: false
  },
  fileDrawerOpen: {
    type: Boolean,
    default: false
  }
})

defineEmits(['selectRightPanelTab', 'showSettings', 'toggleFileDrawer'])

const connectionStateClass = computed(() => (
  getConnectionStatusMeta(props.connectionState || undefined)?.className || ''
))

async function copyActiveConnection() {
  if (!props.activeConnectionCopyText) return

  try {
    await navigator.clipboard.writeText(props.activeConnectionCopyText)
    message.success('IP 已复制到剪贴板')
  } catch {
    message.error('复制失败')
  }
}
</script>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 4px 10px 6px;
  background: var(--status-strip-bg);
  color: var(--muted-color);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.status-bar__main,
.status-bar__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.status-bar__main {
  flex: 1;
  overflow: hidden;
}

.status-bar__meta {
  flex-shrink: 0;
}

.status-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: rgba(128, 145, 168, 0.7);
}

.status-dot.is-active {
  background: var(--primary-color);
  box-shadow: 0 0 0 4px rgba(45, 125, 255, 0.1);
}

.status-dot.is-connected {
  background: var(--connection-connected);
}

.status-dot.is-connecting {
  background: var(--connection-connecting);
}

.status-dot.is-disconnected {
  background: var(--connection-disconnected);
}

.status-connection-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
}

.status-connection {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
}

.status-hint {
  flex-shrink: 0;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.status-panel-btn {
  width: 26px;
  height: 26px;
  min-width: 26px;
  padding: 0;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  color: var(--muted-color);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.status-panel-btn:hover {
  background: rgba(255, 255, 255, 0.4);
  color: var(--text-color);
}

.status-panel-btn.is-active {
  background: rgba(255, 255, 255, 0.62);
  color: var(--primary-color);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
}

.status-panel-btn:deep(.ant-btn) {
  width: 26px;
  min-width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 8px;
}

.status-panel-btn :deep(.anticon) {
  font-size: 13px;
}

.status-copy-btn {
  width: 24px;
  height: 24px;
  min-width: 24px;
  padding: 0;
  border-radius: 8px;
  color: var(--muted-color);
}

.status-copy-btn:hover {
  color: var(--text-color);
  background: rgba(255, 255, 255, 0.35) !important;
}

.status-copy-btn :deep(.anticon) {
  font-size: 12px;
}

@media (max-width: 768px) {
  .status-bar {
    padding-top: 3px;
  }

  .status-bar__meta {
    gap: 6px;
  }

  .status-hint {
    display: none;
  }
}

.status-bar {
  min-height: 38px;
  padding: 0 12px;
  background: var(--status-strip-bg);
  color: var(--muted-color);
  border-top: 1px solid var(--border-color);
}

.status-dot {
  width: 7px;
  height: 7px;
  background: #c4c4c4;
}

.status-dot.is-active {
  background: var(--text-color);
  box-shadow: none;
}

.status-dot.is-connected,
.status-dot.is-connecting,
.status-dot.is-disconnected {
  box-shadow: none;
}

.status-connection {
  font-size: 12px;
  font-weight: 500;
}

.status-hint {
  padding: 0;
  border-radius: 0;
  background: transparent;
  font-size: 11px;
  letter-spacing: 0;
  text-transform: none;
}

.status-panel-btn,
.status-copy-btn {
  border-radius: 8px;
  background: transparent;
  color: var(--muted-color);
}

.status-panel-btn:hover,
.status-copy-btn:hover {
  background: var(--surface-2) !important;
  color: var(--text-color);
}

.status-panel-btn.is-active {
  background: var(--surface-2);
  color: var(--text-color);
  box-shadow: none;
}

.status-panel-btn :deep(.anticon),
.status-copy-btn :deep(.anticon) {
  color: currentColor;
}
</style>
