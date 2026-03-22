<template>
  <div v-if="tabs.length" class="tabs-container">
    <div class="tabs-container__main">
      <a-tabs
        class="tabs-container__tabs"
        type="editable-card"
        :active-key="activeId"
        :items="tabItems"
        @change="$emit('change', $event)"
        @contextmenu="handleTabsContextMenu"
        @edit="onEditTab"
        :hide-add="true"
        :animated="{ inkBar: true, tabPane: false }"
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

    <FileContextMenu
      :open="contextMenu.open"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenuItems"
      @click="handleContextMenuClick"
      @close="closeContextMenu"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { PlusOutlined } from '@antdv-next/icons'
import FileContextMenu from './remote-file/FileContextMenu.vue'
import type { ConnectionTab, TabContextMenuAction } from '../types/app'

const props = defineProps({
  tabs: {
    type: Array,
    default: () => []
  },
  activeId: {
    type: String,
    default: ''
  },
  freshTabId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits<{
  change: [id: string]
  close: [id: string]
  openConnectionCenter: []
  menuAction: [payload: { action: TabContextMenuAction, tabId: string }]
}>()

const contextMenu = ref({
  open: false,
  x: 0,
  y: 0,
  tabId: ''
})

const contextTab = computed(() => (
  (props.tabs as ConnectionTab[]).find((tab) => tab.id === contextMenu.value.tabId) || null
))

const contextMenuItems = computed(() => {
  const tab = contextTab.value
  if (!tab) return []

  const isSsh = tab.type === 'ssh'
  const isConnected = isSsh && tab.sshState === 'connected'
  const hasDisconnectedSsh = (props.tabs as ConnectionTab[]).some((item) => (
    item.type === 'ssh' && item.sshState === 'disconnected' && item.profile
  ))

  return [
    { key: 'connect', label: '连接', disabled: !isSsh || isConnected || !tab.profile },
    { key: 'connectAll', label: '连接全部', disabled: !isSsh || !hasDisconnectedSsh },
    { key: 'disconnect', label: '断开', disabled: !isSsh || !isConnected },
    { key: 'close', label: '关闭' },
    { key: 'closeOthers', label: '关闭其他', disabled: (props.tabs as ConnectionTab[]).length <= 1 },
    { key: 'closeAll', label: '关闭全部' },
  ]
})

const tabItems = computed(() => (props.tabs as ConnectionTab[]).map((tab) => ({
  key: tab.id,
  closable: true,
  label: h('span', {
    class: [
      'tab-content flex items-center gap-2',
      { 'tab-content--fresh': props.freshTabId === tab.id },
    ],
    'data-tab-id': tab.id,
    onContextmenu: (event: MouseEvent) => openContextMenu(event, tab),
  }, [
    h('span', { class: ['tab-kind', `tab-kind--${tab.type}`] }, tab.type === 'ssh' ? 'SSH' : tab.type === 'file' ? 'FILE' : tab.type === 'connections' ? 'HUB' : 'LOCAL'),
    ((tab.type === 'ssh') || (tab.type === 'file' && tab.connectionId))
      ? h('span', {
          class: [
            'tab-status',
            tab.type === 'ssh'
              ? (tab.sshState === 'disconnected'
                ? 'is-offline'
                : tab.sshState === 'connecting'
                  ? 'is-pending'
                  : 'is-live')
              : 'is-linked'
          ],
          'aria-label': tab.type === 'ssh'
            ? (tab.sshState === 'disconnected'
              ? '已断开'
              : tab.sshState === 'connecting'
                ? '连接中'
                : '已连接')
            : '关联连接'
        })
      : null,
    h('span', { class: 'tab-title' }, tab.title),
  ]),
  content: null,
})))

function openContextMenu(event: MouseEvent, tab: ConnectionTab) {
  event.preventDefault()
  event.stopPropagation()
  contextMenu.value = {
    open: true,
    x: event.clientX,
    y: event.clientY,
    tabId: tab.id,
  }
}

function handleTabsContextMenu(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  const tabElement = target?.closest('.ant-tabs-tab')
  if (!tabElement) {
    return
  }

  const tabContent = tabElement.querySelector<HTMLElement>('.tab-content[data-tab-id]')
  const tabId = tabContent?.dataset.tabId
  if (!tabId) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  const tab = (props.tabs as ConnectionTab[]).find((item) => item.id === tabId)
  if (!tab) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  openContextMenu(event, tab)
}

function closeContextMenu() {
  contextMenu.value.open = false
}

function handleContextMenuClick(action: string) {
  if (!contextTab.value) return
  emit('menuAction', {
    action: action as TabContextMenuAction,
    tabId: contextTab.value.id,
  })
}

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

.tab-content--fresh {
  animation: tab-content-arrive 220ms cubic-bezier(0.18, 0.82, 0.24, 1);
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

.tab-status.is-pending {
  background: #f4b940;
  box-shadow: 0 0 0 3px rgba(244, 185, 64, 0.18);
}

.tab-status.is-offline {
  background: rgba(128, 148, 177, 0.58);
  box-shadow: 0 0 0 3px rgba(128, 148, 177, 0.12);
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
  transition:
    transform 180ms ease,
    background-color 180ms ease,
    box-shadow 180ms ease,
    color 180ms ease;
}

:deep(.ant-tabs-tab-active) {
  background: var(--surface-2) !important;
  box-shadow:
    var(--shadow-card),
    inset 0 0 0 1px var(--strong-border),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
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

@keyframes tab-content-arrive {
  0% {
    opacity: 0;
    transform: translate3d(0, 7px, 0) scale(0.985);
    filter: saturate(0.9);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: saturate(1);
  }
}
</style>
