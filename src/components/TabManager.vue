<template>
  <div class="tabs-container border-b border-[var(--border-subtle)] bg-[var(--tabs-strip-bg)] px-[18px] pt-2">
    <a-tabs
      type="editable-card"
      :active-key="activeId"
      :items="tabItems"
      @change="$emit('change', $event)"
      @edit="onEditTab"
      :hide-add="true"
      :animated="false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
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

const emit = defineEmits(['change', 'close'])
const tabItems = computed(() => (props.tabs as ConnectionTab[]).map((tab) => ({
  key: tab.id,
  closable: true,
  label: h('span', { class: 'tab-content flex items-center gap-2' }, [
    h('span', { class: 'tab-icon' }, tab.type === 'ssh' ? '🔑' : tab.type === 'file' ? '📄' : '💻'),
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
  border-bottom: 1px solid var(--border-subtle);
  padding: 8px 18px 0;
}

.tab-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-icon {
  font-size: 15px;
}

.tab-title {
  font-size: 13px;
  font-weight: 700;
}

:deep(.ant-tabs-nav) {
  margin: 0 !important;
}

:deep(.ant-tabs-nav::before) {
  border-bottom-color: transparent !important;
}

:deep(.ant-tabs-tab) {
  height: 48px;
  margin-right: 10px !important;
  padding: 0 18px !important;
  background: var(--surface-1) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: 16px 16px 0 0 !important;
  color: var(--muted-color) !important;
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.16);
}

:deep(.ant-tabs-tab-active) {
  background: linear-gradient(180deg, var(--surface-1), var(--surface-2)) !important;
  border-color: var(--strong-border) !important;
  box-shadow:
    0 20px 40px rgba(41, 70, 116, 0.1),
    0 0 0 1px rgba(255, 255, 255, 0.08) inset;
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
  height: 3px !important;
  border-radius: 999px !important;
}

:deep(.ant-tabs-content-holder) {
  display: none;
}
</style>
