<template>
  <div v-if="tabs.length" class="tabs-container">
    <div class="tabs-container__main">
      <a-tabs
        class="tabs-container__tabs"
        type="editable-card"
        :active-key="activeId"
        :items="tabItems"
        @change="$emit('change', $event)"
        @edit="onEditTab"
        :hide-add="true"
        :animated="false"
      />
      <a-button
        type="text"
        size="small"
        class="tabs-container__add"
        @click="$emit('openConnectionCenter')"
      >
        <PlusOutlined />
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { PlusOutlined } from '@antdv-next/icons'
import type { ConnectionTab } from '../types/app'

const props = defineProps({
  tabs: {
    type: Array,
    default: () => []
  },
  activeId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['change', 'close', 'openConnectionCenter'])
const tabItems = computed(() => (props.tabs as ConnectionTab[]).map((tab) => ({
  key: tab.id,
  closable: true,
  label: h('span', { class: 'tab-content flex items-center gap-2' }, [
    h('span', { class: ['tab-kind', `tab-kind--${tab.type}`] }, tab.type === 'ssh' ? 'SSH' : tab.type === 'file' ? 'FILE' : tab.type === 'connections' ? 'HUB' : 'LOCAL'),
    ((tab.type === 'ssh') || (tab.type === 'file' && tab.connectionId))
      ? h('span', {
          class: ['tab-status', tab.type === 'ssh' ? 'is-live' : 'is-linked'],
          'aria-label': tab.type === 'ssh' ? '连接中' : '关联连接'
        })
      : null,
    h('span', { class: 'tab-title' }, tab.title),
  ]),
  content: null,
})))

function onEditTab(targetKeyOrEvent: string | MouseEvent, action: 'add' | 'remove') {
  if (action === 'remove' && typeof targetKeyOrEvent === 'string') {
    emit('close', targetKeyOrEvent)
  }
}
</script>

<style scoped>
.tabs-container {
  background: var(--tabs-strip-bg);
  padding: 3px 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.tabs-container__main {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.tabs-container__tabs {
  min-width: 0;
  flex: 1;
}

.tabs-container__add {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 9px !important;
  color: var(--primary-color) !important;
  background: var(--surface-1) !important;
  box-shadow: inset 0 0 0 1px var(--border-color);
}

.tabs-container__add:hover {
  background: var(--surface-2) !important;
}

.tabs-container__add :deep(.anticon) {
  font-size: 14px;
}

.tab-content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-kind {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  height: 18px;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: rgba(128, 148, 177, 0.12);
  color: var(--muted-color);
}

.tab-kind--ssh {
  background: rgba(45, 125, 255, 0.12);
  color: var(--primary-color);
}

.tab-kind--local {
  background: rgba(74, 169, 107, 0.12);
  color: var(--success-color);
}

.tab-kind--file {
  background: rgba(240, 177, 79, 0.14);
  color: var(--warning-color);
}

.tab-kind--connections {
  background: rgba(148, 102, 255, 0.12);
  color: #7758d8;
}

.tab-title {
  max-width: 176px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 700;
}

.tab-status {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 50%;
  background: rgba(128, 148, 177, 0.5);
}

.tab-status.is-live {
  background: var(--success-color);
  box-shadow: 0 0 0 3px rgba(74, 169, 107, 0.14);
}

.tab-status.is-linked {
  background: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(45, 125, 255, 0.12);
}

:deep(.ant-tabs-nav) {
  margin: 0 !important;
}

:deep(.ant-tabs-nav::before) {
  border-bottom-color: transparent !important;
}

:deep(.ant-tabs-tab) {
  height: 30px;
  margin-right: 4px !important;
  padding: 0 9px !important;
  background: var(--surface-1) !important;
  border: none !important;
  border-radius: 9px !important;
  color: var(--muted-color) !important;
  box-shadow: inset 0 0 0 1px var(--border-color);
}

:deep(.ant-tabs-tab-active) {
  background: var(--surface-2) !important;
  box-shadow:
    var(--shadow-card),
    inset 0 0 0 1px var(--strong-border);
}

:deep(.ant-tabs-tab-btn) {
  color: inherit !important;
}

:deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: var(--text-color) !important;
}

:deep(.ant-tabs-tab-remove) {
  color: var(--muted-color) !important;
}

:deep(.ant-tabs-ink-bar) {
  background: linear-gradient(90deg, #2d7dff, #79b0ff) !important;
  height: 2px !important;
  border-radius: 999px !important;
}

:deep(.ant-tabs-tab-remove .anticon) {
  font-size: 11px;
}

:deep(.ant-tabs-content-holder) {
  display: none;
}
</style>
