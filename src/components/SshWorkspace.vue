<template>
  <div class="ssh-workspace-shell" :class="{ 'has-monitor': showEmbeddedMonitor }">
    <RightPanel
      class="ssh-workspace__monitor"
      :class="{ 'is-hidden': !showEmbeddedMonitor }"
      :collapsed="embeddedMonitorCollapsed"
      :connection-id="monitorConnectionId"
      :ssh-profile="profile"
      active-tab="monitor"
      placement="left"
      embedded
      @toggle="$emit('toggleMonitor')"
    />

    <div
      ref="workspaceRef"
      class="ssh-workspace"
      :class="[`ssh-workspace--${workspaceDensity}`]"
      :style="workspaceShellStyle"
    >
      <section class="ssh-workspace__terminal" :class="{ 'has-inline-files': showInlineFiles }">
        <div class="ssh-pane-grid" :style="paneGridStyle">
          <article
            v-for="(pane, index) in workspacePanes"
            :key="pane.id"
            class="ssh-pane-card"
            :class="{ 'is-active': activePaneId === pane.id }"
            @mousedown="activePaneId = pane.id"
          >
            <div class="ssh-pane-card__head">
              <div class="ssh-pane-card__title">
                <strong class="ssh-pane-card__badge">{{ index + 1 }}</strong>
                <span class="ssh-pane-card__status-dot" :class="getConnectionStatusMeta(pane.sshState)?.className"></span>
              </div>

              <div class="ssh-pane-card__actions">
                <a-tooltip v-if="pane.sshState === 'disconnected'" title="重连">
                  <a-button
                    size="small"
                    type="text"
                    class="ssh-workspace__icon-btn ssh-workspace__icon-btn--pane"
                    @click="reconnectPane(pane)"
                  >
                    <ReloadOutlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip v-if="!pane.isPrimary" title="关闭">
                  <a-button
                    size="small"
                    type="text"
                    danger
                    class="ssh-workspace__icon-btn ssh-workspace__icon-btn--pane"
                    @click="removePane(pane.id)"
                  >
                    <CloseOutlined />
                  </a-button>
                </a-tooltip>

                <template v-if="activePaneId === pane.id">
                  <a-popover v-if="hasAdvancedSshDetails" placement="bottomRight" trigger="click">
                    <template #content>
                      <div class="ssh-workspace__popover">
                        <div v-if="profile?.proxy_jump_host" class="ssh-workspace__popover-block">
                          <span class="ssh-workspace__popover-label">ProxyJump</span>
                          <strong>{{ profile.proxy_jump_username || '未知用户' }}@{{ profile.proxy_jump_host }}:{{ profile.proxy_jump_port || 22 }}</strong>
                          <span v-if="profile.proxy_jump_name" class="ssh-workspace__popover-muted">{{ profile.proxy_jump_name }}</span>
                        </div>

                        <div v-if="portForwardEntries.length" class="ssh-workspace__popover-block">
                          <span class="ssh-workspace__popover-label">端口转发</span>
                          <div
                            v-for="forward in portForwardEntries"
                            :key="forward.id"
                            class="ssh-workspace__popover-forward"
                          >
                            <code>127.0.0.1:{{ forward.localPort }}</code>
                            <span>{{ forward.remoteHost }}:{{ forward.remotePort }}</span>
                            <a-button size="small" type="text" @click="copyForwardAddress(forward.localPort)">
                              复制
                            </a-button>
                          </div>
                        </div>
                      </div>
                    </template>
                    <a-tooltip title="连接详情">
                      <a-button size="small" type="text" class="ssh-workspace__icon-btn ssh-workspace__icon-btn--pane">
                        <SettingOutlined />
                      </a-button>
                    </a-tooltip>
                  </a-popover>

                  <a-tooltip :title="broadcastEnabled ? `广播中 (${broadcastTargetCount})` : '广播输入'">
                    <a-button
                      size="small"
                      :type="broadcastEnabled ? 'primary' : 'text'"
                      class="ssh-workspace__icon-btn ssh-workspace__icon-btn--pane"
                      @click="toggleBroadcast"
                    >
                      <ThunderboltOutlined />
                    </a-button>
                  </a-tooltip>

                  <a-tooltip title="新增分屏">
                    <a-button
                      size="small"
                      type="text"
                      class="ssh-workspace__icon-btn ssh-workspace__icon-btn--pane"
                      @click="addPane"
                      :disabled="!profile"
                    >
                      <PlusOutlined />
                    </a-button>
                  </a-tooltip>
                </template>
              </div>
            </div>

            <div class="ssh-pane-card__body">
              <Terminal
                :id="pane.id"
                :active="active"
                :theme="theme"
                :config="config"
                :auto-password="pane.autoPassword"
                :ssh-user="pane.profile?.username || profile?.username || ''"
                :ssh-state="pane.sshState"
                type="ssh"
                @close="pane.isPrimary ? $emit('close') : removePane(pane.id)"
                @current-directory-change="handlePaneDirectoryChange(pane.id, $event)"
                @reconnect="pane.isPrimary ? $emit('reconnect') : reconnectPane(pane)"
                @terminal-input="handlePaneInput(pane.id, $event)"
              />
            </div>
          </article>
        </div>

        <section v-if="showInlineFiles" class="ssh-workspace__files-inline">
          <RemoteFileWorkbench
            aggressive
            :connection-id="activeWorkbenchConnectionId"
            :active="active"
            :sync-path="terminalPath"
            :density="workspaceDensity"
            :font-family="config.fontFamily"
            :ssh-state="activeWorkbenchState"
            :title="workspaceTitle"
            @open-file-preview="$emit('openFilePreview', $event)"
            @start-download="$emit('startDownload', $event)"
            @start-upload="$emit('startUpload', $event)"
            @reconnect="$emit('reconnect')"
          />
        </section>

      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import {
  CloseOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@antdv-next/icons'
import Terminal from './Terminal.vue'
import RemoteFileWorkbench from './RemoteFileWorkbench.vue'
import RightPanel from './RightPanel.vue'
import SshService from '../services/SshService'
import { getConnectionStatusMeta } from '../constants/connectionStatus'
import { getBroadcastTargetPaneIds } from '../utils/sshWorkspace'
import { defaultSshConnectionInteractions } from '../utils/sshConnectionInteractions'
import type {
  ConnectionTab,
  DownloadRequest,
  SftpFileEntry,
  SshProfile,
  TerminalConfig,
  ThemeName,
  UploadRequest,
  WorkspaceDensity,
} from '../types/app'

type WorkspacePane = {
  id: string
  sshState: NonNullable<ConnectionTab['sshState']>
  autoPassword: string | null
  isPrimary: boolean
  profile: SshProfile | null
}

const props = withDefaults(defineProps<{
  id: string
  connectionId?: string | null
  active?: boolean
  theme?: ThemeName
  config?: TerminalConfig
  autoPassword?: string | null
  profile?: SshProfile | null
  embeddedMonitorVisible?: boolean
  embeddedMonitorCollapsed?: boolean
  sshState?: ConnectionTab['sshState']
  filesDrawerOpen?: boolean
}>(), {
  connectionId: '',
  active: false,
  theme: 'light',
  config: () => ({
    fontSize: 13,
    fontFamily: 'Consolas, monospace',
    cursorBlink: true,
    cursorStyle: 'block',
    density: 'compact',
    hostCenterViewMode: 'list',
  }),
  autoPassword: '',
  profile: null,
  embeddedMonitorVisible: false,
  embeddedMonitorCollapsed: false,
  sshState: 'connected',
  filesDrawerOpen: false,
})

const emit = defineEmits<{
  close: []
  reconnect: []
  openFilePreview: [file: SftpFileEntry]
  startDownload: [download: DownloadRequest]
  startUpload: [upload: UploadRequest]
  toggleMonitor: []
  'update:filesDrawerOpen': [open: boolean]
}>()

const workspaceRef = ref<HTMLElement | null>(null)
const workspaceWidth = ref(0)
const terminalPath = ref('')
const activePaneId = ref(props.id)
const broadcastEnabled = ref(false)
const extraPanes = ref<WorkspacePane[]>([])
const showEmbeddedMonitor = computed(() => (
  props.embeddedMonitorVisible
  && !props.embeddedMonitorCollapsed
  && !isPaneSplitActive.value
))
let resizeFrame = 0
let activateSyncFrame = 0
let resizeObserver: ResizeObserver | null = null
const workspaceDensity = computed<WorkspaceDensity>(() => props.config.density || 'balanced')

const primaryPane = computed<WorkspacePane>(() => ({
  id: props.id,
  sshState: props.sshState || 'connected',
  autoPassword: props.autoPassword || null,
  isPrimary: true,
  profile: props.profile || null,
}))

const workspacePanes = computed(() => [primaryPane.value, ...extraPanes.value])
const isPaneSplitActive = computed(() => workspacePanes.value.length > 1)
const isStackedPaneLayout = computed(() => isPaneSplitActive.value && workspaceWidth.value > 0 && workspaceWidth.value < 1180)
const portForwardEntries = computed(() => props.profile?.port_forwards || [])
const hasAdvancedSshDetails = computed(() => Boolean(props.profile?.proxy_jump_host || portForwardEntries.value.length))
const broadcastTargetCount = computed(() => (
  getBroadcastTargetPaneIds(workspacePanes.value, activePaneId.value, broadcastEnabled.value).length
))

const paneGridStyle = computed(() => ({
  gridTemplateColumns: isPaneSplitActive.value && !isStackedPaneLayout.value
    ? 'repeat(2, minmax(0, 1fr))'
    : 'minmax(0, 1fr)',
  gridTemplateRows: isPaneSplitActive.value && isStackedPaneLayout.value
    ? `repeat(${workspacePanes.value.length}, minmax(0, 1fr))`
    : 'minmax(0, 1fr)',
}))

const activePane = computed(() => (
  workspacePanes.value.find((pane) => pane.id === activePaneId.value)
  || primaryPane.value
))

const activeWorkbenchConnectionId = computed(() => {
  if (activePane.value.sshState === 'connected') {
    return activePane.value.id
  }

  if (primaryPane.value.sshState === 'connected') {
    return primaryPane.value.id
  }

  return props.connectionId || ''
})

const activeWorkbenchState = computed(() => {
  if (activePane.value.sshState === 'connected') {
    return 'connected'
  }

  return primaryPane.value.sshState
})

const monitorConnectionId = computed(() => (
  primaryPane.value.sshState === 'connected' ? primaryPane.value.id : ''
))

const workspaceTitle = computed(() => {
  if (props.profile?.name) return props.profile.name
  if (props.profile?.username && props.profile?.host) {
    return `${props.profile.username}@${props.profile.host}`
  }

  return '远程工作区'
})

const workspaceShellStyle = computed(() => ({
  '--ssh-files-drawer-height': isPaneSplitActive.value ? 'min(46vh, 420px)' : 'min(40vh, 380px)',
}))
const showInlineFiles = computed(() => props.filesDrawerOpen && !isPaneSplitActive.value)

function emitWindowResize() {
  if (resizeFrame) cancelAnimationFrame(resizeFrame)
  resizeFrame = requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'))
  })
}

function scheduleLayoutRecovery() {
  if (activateSyncFrame) cancelAnimationFrame(activateSyncFrame)

  nextTick(() => {
    activateSyncFrame = requestAnimationFrame(() => {
      if (!props.active) return
      emitWindowResize()

      activateSyncFrame = requestAnimationFrame(() => {
        if (!props.active) return
        emitWindowResize()
      })
    })
  })
}

function handlePaneDirectoryChange(paneId: string, path: string) {
  if (paneId === activePaneId.value) {
    terminalPath.value = path
  }
}

function toggleBroadcast() {
  broadcastEnabled.value = !broadcastEnabled.value
}

function buildRemoteFilesWindowUrl() {
  const params = new URLSearchParams()
  params.set('mode', 'remote-files')
  params.set('connectionId', activeWorkbenchConnectionId.value)
  params.set('title', workspaceTitle.value)
  if (terminalPath.value) {
    params.set('path', terminalPath.value)
  }
  return `index.html?${params.toString()}`
}

async function openSplitFileManagerWindow() {
  if (!activeWorkbenchConnectionId.value) {
    message.warning('当前没有可用连接用于打开文件管理')
    return
  }

  const label = `remote-files-${props.id}`
  const existing = await WebviewWindow.getByLabel(label)
  if (existing) {
    return
  }

  const nextWindow = new WebviewWindow(label, {
    url: buildRemoteFilesWindowUrl(),
    title: `${workspaceTitle.value} - 文件管理`,
    width: 1180,
    height: 760,
    minWidth: 860,
    minHeight: 560,
    resizable: true,
    center: true,
  })

  nextWindow.once('tauri://error', (error) => {
    console.error('打开独立文件窗口失败:', error)
    message.error(`打开文件窗口失败：${String(error)}`)
  })
}

async function copyForwardAddress(localPort: number) {
  const value = `127.0.0.1:${localPort}`
  try {
    await navigator.clipboard.writeText(value)
    message.success(`已复制 ${value}`)
  } catch {
    message.error('复制端口地址失败')
  }
}

function handlePaneInput(sourcePaneId: string, data: string) {
  getBroadcastTargetPaneIds(workspacePanes.value, sourcePaneId, broadcastEnabled.value)
    .forEach((paneId) => {
      SshService.writeTerminal(paneId, data)
    })
}

async function addPane() {
  if (!props.profile) {
    return
  }

  const paneId = `ssh-pane-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  const nextPane: WorkspacePane = {
    id: paneId,
    sshState: 'connecting',
    autoPassword: null,
    isPrimary: false,
    profile: props.profile,
  }

  extraPanes.value.push(nextPane)
  activePaneId.value = paneId
  scheduleLayoutRecovery()

  try {
    const autoPassword = await SshService.openSavedProfile(paneId, props.profile, defaultSshConnectionInteractions)
    const pane = extraPanes.value.find((item) => item.id === paneId)
    if (!pane) return
    pane.autoPassword = autoPassword
    pane.sshState = 'connected'
  } catch (error) {
    const pane = extraPanes.value.find((item) => item.id === paneId)
    if (!pane) return
    pane.sshState = 'disconnected'
    message.error(String(error))
  }
}

async function reconnectPane(pane: WorkspacePane) {
  if (!pane.profile) return

  pane.sshState = 'connecting'
  try {
    await SshService.reconnect(pane.id, pane.profile, defaultSshConnectionInteractions)
    pane.sshState = 'connected'
  } catch (error) {
    pane.sshState = 'disconnected'
    message.error(String(error))
  }
}

async function removePane(paneId: string) {
  const index = extraPanes.value.findIndex((pane) => pane.id === paneId)
  if (index === -1) return

  const [pane] = extraPanes.value.splice(index, 1)
  await SshService.closeConnection(pane.id)
  if (activePaneId.value === paneId) {
    activePaneId.value = props.id
  }
  scheduleLayoutRecovery()
}

onMounted(async () => {
  await nextTick()
  workspaceWidth.value = workspaceRef.value?.clientWidth || 0
  if (props.active) {
    scheduleLayoutRecovery()
  }

  if (workspaceRef.value) {
    resizeObserver = new ResizeObserver(() => {
      workspaceWidth.value = workspaceRef.value?.clientWidth || 0
      emitWindowResize()
    })
    resizeObserver.observe(workspaceRef.value)
  }
})

watch(workspaceDensity, () => {
  scheduleLayoutRecovery()
})

watch(() => props.active, (isActive) => {
  if (isActive) {
    scheduleLayoutRecovery()
  }
})

watch(isPaneSplitActive, (isSplitActive, wasSplitActive) => {
  if (!wasSplitActive && isSplitActive) {
    emit('update:filesDrawerOpen', false)
  }
  scheduleLayoutRecovery()
})

watch(() => props.id, (nextId) => {
  activePaneId.value = nextId
})

watch(() => props.filesDrawerOpen, async (nextOpen, previousOpen) => {
  scheduleLayoutRecovery()

  if (!nextOpen || nextOpen === previousOpen) return
  if (!isPaneSplitActive.value) return

  await openSplitFileManagerWindow()
  emit('update:filesDrawerOpen', false)
})

onBeforeUnmount(async () => {
  if (resizeFrame) cancelAnimationFrame(resizeFrame)
  if (activateSyncFrame) cancelAnimationFrame(activateSyncFrame)
  resizeObserver?.disconnect()

  await Promise.all(extraPanes.value.map((pane) => SshService.closeConnection(pane.id)))
})
</script>

<style scoped>
.ssh-workspace-shell {
  --ssh-monitor-width: 20%;
  display: flex;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.ssh-workspace__monitor {
  flex: 0 0 var(--ssh-monitor-width);
  width: var(--ssh-monitor-width);
  max-width: var(--ssh-monitor-width);
  min-width: 256px;
  min-height: 0;
  opacity: 1;
  transform: translateX(0);
  overflow: hidden;
  will-change: width, max-width, opacity, transform;
  transition:
    flex-basis 0.3s cubic-bezier(0.22, 1, 0.36, 1),
    width 0.3s cubic-bezier(0.22, 1, 0.36, 1),
    max-width 0.3s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.2s ease,
    transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.ssh-workspace__monitor.is-hidden {
  flex: 0 0 0;
  width: 0;
  max-width: 0;
  min-width: 0;
  opacity: 0;
  transform: translateX(-14px);
  overflow: hidden;
  pointer-events: none;
}

.ssh-workspace {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

.ssh-workspace__terminal {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
}

.ssh-workspace__icon-btn {
  width: 28px !important;
  min-width: 28px !important;
  height: 28px !important;
  padding: 0 !important;
  border-radius: 8px !important;
}

.ssh-workspace__icon-btn--pane,
.ssh-workspace__icon-btn--dock {
  width: 26px !important;
  min-width: 26px !important;
  height: 26px !important;
}

.ssh-workspace__popover {
  display: grid;
  gap: 12px;
  min-width: 240px;
}

.ssh-workspace__popover-block {
  display: grid;
  gap: 6px;
}

.ssh-workspace__popover-label {
  color: var(--muted-color);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.ssh-workspace__popover-block strong,
.ssh-workspace__popover-forward code {
  color: var(--text-color);
  font-size: 12px;
}

.ssh-workspace__popover-muted {
  color: var(--muted-color);
  font-size: 12px;
}

.ssh-workspace__popover-forward {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--workspace-terminal-bg) 86%, var(--surface-1));
}

.ssh-pane-grid {
  display: grid;
  flex: 1 1 auto;
  min-height: 0;
  grid-auto-rows: minmax(0, 1fr);
  align-content: stretch;
  gap: 0;
  padding: 0;
}

.ssh-workspace__terminal.has-inline-files .ssh-pane-grid {
  min-height: 120px;
}

.ssh-pane-card {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  border-radius: 0;
  border: none;
  border-top: 1px solid color-mix(in srgb, var(--border-color) 92%, transparent);
  background: var(--workspace-terminal-bg);
  overflow: hidden;
}

.ssh-pane-card.is-active {
  border-top-color: var(--strong-border);
  box-shadow: none;
}

.ssh-pane-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 30px;
  min-height: 30px;
  gap: 6px;
  padding: 0 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--border-color) 85%, transparent);
  background: var(--surface-1);
  box-sizing: border-box;
}

.ssh-pane-card__title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.ssh-pane-card__badge {
  color: var(--text-color);
  font-size: 11px;
  font-weight: 600;
  min-width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: transparent;
}

.ssh-pane-card__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.ssh-pane-card__status-dot.is-connected {
  background: var(--connection-connected);
  box-shadow: 0 0 0 4px var(--connection-connected-soft);
}

.ssh-pane-card__status-dot.is-connecting {
  background: var(--connection-connecting);
  box-shadow: 0 0 0 4px var(--connection-connecting-soft);
}

.ssh-pane-card__status-dot.is-disconnected {
  background: var(--connection-disconnected);
  box-shadow: 0 0 0 4px var(--connection-disconnected-soft);
}

.ssh-pane-card__actions {
  display: flex;
  gap: 4px;
  align-items: center;
  justify-content: flex-end;
  min-width: 92px;
  flex-shrink: 0;
}

.ssh-pane-card__body {
  display: flex;
  min-height: 0;
  height: 100%;
}

.ssh-workspace__files-inline {
  flex: 0 0 var(--ssh-files-drawer-height);
  min-height: 220px;
  height: var(--ssh-files-drawer-height);
  max-height: 42%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-top: 1px solid color-mix(in srgb, var(--border-color) 90%, transparent);
  background: var(--surface-1);
}

.ssh-workspace__files-inline > * {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

@media (max-width: 1080px) {
  .ssh-workspace-shell {
    flex-direction: column;
  }

  .ssh-workspace__monitor {
    flex: 0 0 auto;
    width: 100%;
    max-width: none;
    max-height: 520px;
  }

  .ssh-workspace {
    padding: 4px;
  }

  .ssh-pane-grid {
    grid-template-columns: minmax(0, 1fr) !important;
  }
}

.ssh-workspace__terminal {
  background: #0d0f14;
}

.ssh-pane-grid {
  background: #0d0f14;
}

.ssh-pane-card {
  position: relative;
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 0;
  background: #0d0f14;
}

.ssh-pane-card.is-active {
  border-top-color: rgba(255, 255, 255, 0.14);
  box-shadow: none;
}

.ssh-pane-card__head {
  height: 30px;
  min-height: 30px;
  padding: 0 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: #11141b;
}

.ssh-pane-card__title {
  gap: 8px;
}

.ssh-pane-card__badge {
  min-width: auto;
  height: auto;
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.88);
  font-size: 11px;
  font-weight: 600;
}

.ssh-pane-card__status-dot {
  width: 7px;
  height: 7px;
}

.ssh-pane-card__status-dot.is-connected {
  background: rgba(110, 231, 183, 0.92);
}

.ssh-pane-card__status-dot.is-connecting {
  background: rgba(251, 191, 36, 0.92);
}

.ssh-pane-card__status-dot.is-disconnected {
  background: rgba(248, 113, 113, 0.92);
}

.ssh-pane-card__actions {
  gap: 2px;
  min-width: auto;
  margin-left: auto;
  opacity: 0.72;
  transition: opacity 0.16s ease;
}

.ssh-pane-card:hover .ssh-pane-card__actions,
.ssh-pane-card.is-active .ssh-pane-card__actions {
  opacity: 1;
}

.ssh-workspace__icon-btn {
  width: 24px !important;
  min-width: 24px !important;
  height: 24px !important;
  border-radius: 6px !important;
  color: rgba(255, 255, 255, 0.72) !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.ssh-workspace__icon-btn:hover,
.ssh-workspace__icon-btn.ant-btn-primary {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.08) !important;
}

.ssh-workspace__icon-btn.ant-btn-primary {
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}

.ssh-workspace__icon-btn :deep(.anticon) {
  font-size: 12px;
  color: currentColor;
}

.ssh-pane-card__body {
  background: #0d0f14;
}

.ssh-pane-card__body > * {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.ssh-workspace__files-inline {
  background: var(--surface-1);
  border-top: 1px solid var(--border-color);
}
</style>
