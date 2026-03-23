<template>
  <div class="remote-status-bar" :class="{ 'remote-status-bar--compact': compact }">
    <div class="remote-status-bar__left">
      <span class="remote-status-bar__item">{{ directoryCount }} 目录</span>
      <span class="remote-status-bar__sep">/</span>
      <span class="remote-status-bar__item">{{ fileCount }} 文件</span>
      <span v-if="selectedCount" class="remote-status-bar__item remote-status-bar__selected">
        · 已选 {{ selectedCount }} 项
      </span>
      <span v-if="filterSummary" class="remote-status-bar__item remote-status-bar__filter">
        · {{ filterSummary }}
      </span>
    </div>
    <div class="remote-status-bar__right">
      <template v-if="diskUsage && !compact">
        <span class="remote-status-bar__disk">
          磁盘: {{ diskUsage.used }} / {{ diskUsage.total }} (可用 {{ diskUsage.available }})
        </span>
      </template>
      <a-tooltip :title="showHidden ? '隐藏隐藏文件' : '显示隐藏文件'">
        <a-button
          type="text"
          size="small"
          class="remote-status-bar__toggle"
          :class="{ 'is-active': showHidden }"
          @click="$emit('toggleHidden')"
        >
          <EyeOutlined v-if="showHidden" />
          <EyeInvisibleOutlined v-else />
        </a-button>
      </a-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { EyeOutlined, EyeInvisibleOutlined } from '@antdv-next/icons'

defineProps<{
  fileCount: number
  directoryCount: number
  selectedCount: number
  showHidden: boolean
  filterSummary: string
  diskUsage?: { total: string; used: string; available: string } | null
  compact?: boolean
}>()

defineEmits<{
  toggleHidden: []
}>()
</script>

<style scoped>
.remote-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 12px;
  font-size: 11px;
  color: var(--muted-color, #999);
  border-top: 1px solid var(--border-color, #e8e8e8);
  background: var(--surface-1, #ffffff);
  min-height: 26px;
}

.remote-status-bar__left,
.remote-status-bar__right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.remote-status-bar__sep {
  opacity: 0.4;
}

.remote-status-bar__selected {
  color: var(--text-color, #111111);
  font-weight: 500;
}

.remote-status-bar__toggle.is-active {
  color: var(--text-color, #111111);
}

:deep(.remote-status-bar__toggle.ant-btn) {
  font-size: 12px;
  padding: 0 4px;
  min-width: 20px;
  width: 20px;
  height: 20px;
  line-height: 20px;
  border-radius: 6px;
}

.remote-status-bar__disk {
  opacity: 0.7;
}

.remote-status-bar--compact {
  gap: 8px;
  min-height: 22px;
  padding-block: 1px;
}

:deep(.remote-status-bar__toggle .anticon) {
  font-size: 11px;
  color: currentColor;
}
</style>
