<template>
  <div class="remote-path-bar" :class="{ 'remote-path-bar--compact': compact }">
    <a-space-compact class="remote-path-bar__nav">
      <a-tooltip title="返回">
        <a-button size="small" :disabled="!canGoBack" @click="$emit('goBack')">
          <ArrowLeftOutlined />
        </a-button>
      </a-tooltip>
      <a-tooltip title="前进">
        <a-button size="small" :disabled="!canGoForward" @click="$emit('goForward')">
          <ArrowRightOutlined />
        </a-button>
      </a-tooltip>
      <a-tooltip title="上级目录">
        <a-button size="small" :disabled="currentPath === '/'" @click="$emit('goUp')">
          <ArrowUpOutlined />
        </a-button>
      </a-tooltip>
      <a-tooltip title="刷新">
        <a-button size="small" :loading="isLoading" @click="$emit('refresh')">
          <ReloadOutlined />
        </a-button>
      </a-tooltip>
      <a-tooltip title="新建文件夹">
        <a-button size="small" @click="$emit('createFolder')">
          <FolderAddOutlined />
        </a-button>
      </a-tooltip>
    </a-space-compact>

    <a-breadcrumb class="remote-path-bar__breadcrumb">
      <a-breadcrumb-item v-for="node in breadcrumbNodes" :key="node.path">
        <a
          class="remote-path-bar__crumb"
          :class="{ 'is-current': node.path === currentPath }"
          @click.prevent="$emit('navigate', node.path)"
        >{{ node.label }}</a>
      </a-breadcrumb-item>
    </a-breadcrumb>

    <div class="remote-path-bar__right">
      <a-input
        :value="searchText"
        size="small"
        class="remote-path-bar__search"
        placeholder="筛选文件..."
        allow-clear
        @update:value="$emit('update:searchText', $event)"
      >
        <template #prefix><SearchOutlined /></template>
      </a-input>

      <a-tag v-if="fileCount !== undefined && !compact" :bordered="false">{{ fileCount }} 项</a-tag>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  FolderAddOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@antdv-next/icons'

const props = defineProps<{
  currentPath: string
  canGoBack: boolean
  canGoForward: boolean
  isLoading: boolean
  searchText: string
  fileCount?: number
  compact?: boolean
}>()

defineEmits<{
  navigate: [path: string]
  goBack: []
  goForward: []
  goUp: []
  refresh: []
  createFolder: []
  'update:searchText': [text: string]
}>()

const breadcrumbNodes = computed(() => {
  const parts = props.currentPath.split('/').filter(Boolean)
  const nodes = [{ label: '/', path: '/' }]
  let path = ''
  parts.forEach((part) => {
    path += `/${part}`
    nodes.push({ label: part, path })
  })
  return nodes
})
</script>

<style scoped>
.remote-path-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #e8e8e8);
  background: var(--surface-1, #ffffff);
  min-height: 40px;
}

.remote-path-bar__nav :deep(.ant-btn) {
  min-width: 26px;
  height: 26px;
  padding-inline: 4px !important;
  border-radius: 8px !important;
}

.remote-path-bar__breadcrumb {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  white-space: nowrap;
}

.remote-path-bar__breadcrumb::-webkit-scrollbar {
  display: none;
}

.remote-path-bar__crumb {
  font-size: 12px;
  color: var(--muted-color, #999);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 6px;
  font-weight: 500;
}

.remote-path-bar__crumb:hover {
  background: var(--surface-2, #f0f0f0);
}

.remote-path-bar__crumb.is-current {
  color: var(--text-color, #111111);
  font-weight: 600;
}

.remote-path-bar__right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.remote-path-bar__search {
  width: 168px;
}

.remote-path-bar--compact {
  padding: 6px 10px;
  min-height: 34px;
}

.remote-path-bar--compact .remote-path-bar__search {
  width: 132px;
}

.remote-path-bar__nav :deep(.anticon),
.remote-path-bar__search :deep(.anticon) {
  font-size: 12px;
  color: currentColor;
}
</style>
