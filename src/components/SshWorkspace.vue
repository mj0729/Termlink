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
      :class="[{ 'is-resizing': isResizing }, `ssh-workspace--${workspaceDensity}`]"
      :style="workspaceStyle"
    >
      <section class="ssh-workspace__terminal">
        <div class="ssh-workspace__toolbar">
          <div class="ssh-workspace__toolbar-copy">
            <strong>{{ workspaceTitle }}</strong>
            <span>{{ workspacePanes.length }} 个会话 pane</span>
            <span class="ssh-workspace__toolbar-chip">
              {{ broadcastEnabled ? '广播输入已开启' : '广播输入已关闭' }}
            </span>
            <span v-if="broadcastEnabled" class="ssh-workspace__toolbar-chip ssh-workspace__toolbar-chip--accent">
              {{ broadcastTargetCount }} 个目标会话
            </span>
            <span v-if="isPaneSplitActive" class="ssh-workspace__toolbar-chip ssh-workspace__toolbar-chip--warning">
              分屏时已自动收起监控
            </span>
            <span v-if="isPaneSplitActive && isStackedPaneLayout" class="ssh-workspace__toolbar-chip">
              当前为上下分屏
            </span>
          </div>

          <div class="ssh-workspace__toolbar-actions">
            <a-button
              v-if="hasAdvancedSshDetails"
              size="small"
              @click="showConnectionDetails = !showConnectionDetails"
            >
              {{ showConnectionDetails ? '收起连接详情' : '查看连接详情' }}
            </a-button>
            <a-button size="small" @click="toggleBroadcast" :type="broadcastEnabled ? 'primary' : 'default'">
              {{ broadcastEnabled ? '关闭广播' : '开启广播' }}
            </a-button>
            <a-button size="small" @click="addPane" :disabled="!profile">
              新增分屏
            </a-button>
          </div>
        </div>

        <div v-if="showConnectionDetails && hasAdvancedSshDetails" class="ssh-workspace__details">
          <div v-if="profile?.proxy_jump_host" class="ssh-workspace__detail-card">
            <div class="ssh-workspace__detail-head">
              <strong>堡垒机 / ProxyJump</strong>
              <span class="ssh-workspace__detail-pill">已启用</span>
            </div>
            <div class="ssh-workspace__detail-body">
              <span>{{ profile.proxy_jump_username || '未知用户' }}@{{ profile.proxy_jump_host }}:{{ profile.proxy_jump_port || 22 }}</span>
              <span v-if="profile.proxy_jump_name" class="ssh-workspace__detail-muted">引用连接：{{ profile.proxy_jump_name }}</span>
            </div>
          </div>

          <div v-if="portForwardEntries.length" class="ssh-workspace__detail-card">
            <div class="ssh-workspace__detail-head">
              <strong>本地端口转发</strong>
              <span class="ssh-workspace__detail-pill">{{ portForwardEntries.length }} 条</span>
            </div>
            <div class="ssh-workspace__forward-list">
              <div
                v-for="forward in portForwardEntries"
                :key="forward.id"
                class="ssh-workspace__forward-item"
              >
                <div class="ssh-workspace__forward-copy">
                  <span class="ssh-workspace__forward-main">
                    localhost:{{ forward.localPort }} → {{ forward.remoteHost }}:{{ forward.remotePort }}
                  </span>
                  <span class="ssh-workspace__detail-muted">
                    {{ primaryPane.sshState === 'connected' ? '监听中' : '连接建立后自动监听' }}
                  </span>
                </div>
                <a-button size="small" type="text" @click="copyForwardAddress(forward.localPort)">
                  复制地址
                </a-button>
              </div>
            </div>
          </div>
        </div>

        <div class="ssh-pane-grid" :style="paneGridStyle">
          <article
            v-for="pane in workspacePanes"
            :key="pane.id"
            class="ssh-pane-card"
            :class="{ 'is-active': activePaneId === pane.id }"
            @mousedown="activePaneId = pane.id"
          >
            <div class="ssh-pane-card__head">
              <div class="ssh-pane-card__title">
                <strong>{{ pane.title }}</strong>
                <span class="ssh-pane-card__status" :class="`is-${pane.sshState}`">
                  {{ paneStatusLabel[pane.sshState] }}
                </span>
              </div>

              <div class="ssh-pane-card__actions">
                <a-button
                  v-if="pane.sshState === 'disconnected'"
                  size="small"
                  type="text"
                  @click="reconnectPane(pane)"
                >
                  重连
                </a-button>
                <a-button
                  v-if="!pane.isPrimary"
                  size="small"
                  type="text"
                  danger
                  @click="removePane(pane.id)"
                >
                  关闭
                </a-button>
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
      </section>

      <div
        class="ssh-workspace__splitter"
        @pointerdown="startResize"
      >
        <span class="ssh-workspace__splitter-handle"></span>
      </div>

      <section class="ssh-workspace__files">
        <RemoteFileWorkbench
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Terminal from './Terminal.vue'
import RemoteFileWorkbench from './RemoteFileWorkbench.vue'
import RightPanel from './RightPanel.vue'
import SshService from '../services/SshService'
import { getBroadcastTargetPaneIds } from '../utils/sshWorkspace'
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
  title: string
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
  }),
  autoPassword: '',
  profile: null,
  embeddedMonitorVisible: false,
  embeddedMonitorCollapsed: false,
  sshState: 'connected',
})

defineEmits<{
  close: []
  reconnect: []
  openFilePreview: [file: SftpFileEntry]
  startDownload: [download: DownloadRequest]
  startUpload: [upload: UploadRequest]
  toggleMonitor: []
}>()

const workspaceRef = ref<HTMLElement | null>(null)
const workspaceWidth = ref(0)
const terminalHeight = ref(0)
const isResizing = ref(false)
const terminalPath = ref('')
const splitterHeight = 8
const terminalRatio = ref(0.4)
const activePaneId = ref(props.id)
const broadcastEnabled = ref(false)
const showConnectionDetails = ref(false)
const extraPanes = ref<WorkspacePane[]>([])
const paneStatusLabel: Record<NonNullable<ConnectionTab['sshState']>, string> = {
  connecting: '连接中',
  connected: '已连接',
  disconnected: '已断开',
}
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
  title: '主会话',
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

function getDefaultTerminalRatio(density: WorkspaceDensity) {
  if (density === 'comfortable') return 0.4
  if (density === 'balanced') return 0.4
  return 0.4
}

function getMinTerminalHeight(density: WorkspaceDensity) {
  if (density === 'comfortable') return 220
  if (density === 'balanced') return 192
  return 164
}

function getMinFilesHeight(density: WorkspaceDensity) {
  if (density === 'comfortable') return 240
  if (density === 'balanced') return 210
  return 184
}

const workspaceTitle = computed(() => {
  if (props.profile?.name) return props.profile.name
  if (props.profile?.username && props.profile?.host) {
    return `${props.profile.username}@${props.profile.host}`
  }

  return '远程工作区'
})

const workspaceStyle = computed(() => {
  if (!terminalHeight.value) return undefined

  const minFilesHeight = getMinFilesHeight(workspaceDensity.value)
  return {
    gridTemplateRows: `${terminalHeight.value}px ${splitterHeight}px minmax(${minFilesHeight}px, 1fr)`
  }
})

function getClampedTerminalHeight(nextHeight: number) {
  const workspaceHeight = workspaceRef.value?.clientHeight || 0
  const minTerminalHeight = getMinTerminalHeight(workspaceDensity.value)
  const minFilesHeight = getMinFilesHeight(workspaceDensity.value)
  const maxTerminalHeight = Math.max(
    minTerminalHeight,
    workspaceHeight - minFilesHeight - splitterHeight
  )

  return Math.min(Math.max(nextHeight, minTerminalHeight), maxTerminalHeight)
}

function updateTerminalRatio(nextHeight: number) {
  const workspaceHeight = workspaceRef.value?.clientHeight || 0
  const availableHeight = workspaceHeight - splitterHeight
  if (availableHeight <= 0) return
  terminalRatio.value = nextHeight / availableHeight
}

function emitWindowResize() {
  if (resizeFrame) cancelAnimationFrame(resizeFrame)
  resizeFrame = requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'))
  })
}

function syncSplitFromRatio(forceDefault = false) {
  if (!workspaceRef.value) return
  const workspaceHeight = workspaceRef.value.clientHeight
  if (workspaceHeight <= splitterHeight) return
  const ratio = forceDefault ? getDefaultTerminalRatio(workspaceDensity.value) : terminalRatio.value
  const nextHeight = Math.round((workspaceHeight - splitterHeight) * ratio)
  const clampedHeight = getClampedTerminalHeight(nextHeight)
  terminalHeight.value = clampedHeight
  updateTerminalRatio(clampedHeight)
}

function scheduleLayoutRecovery(forceDefault = false) {
  if (activateSyncFrame) cancelAnimationFrame(activateSyncFrame)

  nextTick(() => {
    activateSyncFrame = requestAnimationFrame(() => {
      if (!props.active) return
      syncSplitFromRatio(forceDefault)
      emitWindowResize()

      activateSyncFrame = requestAnimationFrame(() => {
        if (!props.active) return
        syncSplitFromRatio()
        emitWindowResize()
      })
    })
  })
}

function startResize(event: PointerEvent) {
  if (!workspaceRef.value) return

  isResizing.value = true

  const onPointerMove = (moveEvent: PointerEvent) => {
    const rect = workspaceRef.value?.getBoundingClientRect()
    if (!rect) return
    const nextHeight = moveEvent.clientY - rect.top
    const clampedHeight = getClampedTerminalHeight(nextHeight)
    terminalHeight.value = clampedHeight
    updateTerminalRatio(clampedHeight)
    emitWindowResize()
  }

  const stopResize = () => {
    isResizing.value = false
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', stopResize)
    window.removeEventListener('pointercancel', stopResize)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    emitWindowResize()
  }

  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', stopResize)
  window.addEventListener('pointercancel', stopResize)
  emitWindowResize()
  event.preventDefault()
}

function handlePaneDirectoryChange(paneId: string, path: string) {
  if (paneId === activePaneId.value) {
    terminalPath.value = path
  }
}

function toggleBroadcast() {
  broadcastEnabled.value = !broadcastEnabled.value
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
    title: `分屏 ${workspacePanes.value.length + 1}`,
    sshState: 'connecting',
    autoPassword: null,
    isPrimary: false,
    profile: props.profile,
  }

  extraPanes.value.push(nextPane)
  activePaneId.value = paneId
  scheduleLayoutRecovery()

  try {
    const autoPassword = await SshService.openSavedProfile(paneId, props.profile)
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
    await SshService.reconnect(pane.id, pane.profile)
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
  terminalRatio.value = getDefaultTerminalRatio(workspaceDensity.value)
  workspaceWidth.value = workspaceRef.value?.clientWidth || 0
  syncSplitFromRatio(true)
  if (props.active) {
    scheduleLayoutRecovery(true)
  }

  if (workspaceRef.value) {
    resizeObserver = new ResizeObserver(() => {
      workspaceWidth.value = workspaceRef.value?.clientWidth || 0
      if (!isResizing.value) {
        syncSplitFromRatio()
      }
    })
    resizeObserver.observe(workspaceRef.value)
  }
})

watch(workspaceDensity, (nextDensity) => {
  terminalRatio.value = getDefaultTerminalRatio(nextDensity)
  scheduleLayoutRecovery(true)
})

watch(() => props.active, (isActive) => {
  if (isActive) {
    scheduleLayoutRecovery()
  }
})

watch(isPaneSplitActive, (isSplitActive) => {
  if (isSplitActive) {
    showConnectionDetails.value = false
  }
})

watch(() => props.id, (nextId) => {
  activePaneId.value = nextId
})

onBeforeUnmount(async () => {
  if (resizeFrame) cancelAnimationFrame(resizeFrame)
  if (activateSyncFrame) cancelAnimationFrame(activateSyncFrame)
  resizeObserver?.disconnect()
  document.body.style.cursor = ''
  document.body.style.userSelect = ''

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
  display: grid;
  grid-template-rows: minmax(180px, 0.8fr) 8px minmax(180px, 1.2fr);
  gap: 0;
  flex: 1;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 0;
}

.ssh-workspace__terminal,
.ssh-workspace__files {
  min-height: 0;
  overflow: hidden;
}

.ssh-workspace__terminal {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  padding: 10px 0 0;
}

.ssh-workspace__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px;
}

.ssh-workspace__toolbar-copy {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--muted-color);
  font-size: 12px;
}

.ssh-workspace__toolbar-copy strong {
  color: var(--text-color);
  font-size: 13px;
}

.ssh-workspace__toolbar-chip {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--surface-1);
}

.ssh-workspace__toolbar-chip--accent {
  color: var(--primary-color);
  border-color: color-mix(in srgb, var(--primary-color) 35%, var(--border-color));
}

.ssh-workspace__toolbar-chip--warning {
  color: #9a6700;
  border-color: rgba(245, 158, 11, 0.32);
  background: rgba(245, 158, 11, 0.12);
}

.ssh-workspace__toolbar-actions {
  display: flex;
  gap: 8px;
}

.ssh-workspace__details {
  display: grid;
  gap: 10px;
  padding: 0 10px 2px;
}

.ssh-workspace__detail-card {
  border: 1px solid color-mix(in srgb, var(--border-color) 88%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface-1) 90%, transparent);
  padding: 12px;
}

.ssh-workspace__detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.ssh-workspace__detail-head strong {
  color: var(--text-color);
  font-size: 12px;
}

.ssh-workspace__detail-pill {
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(45, 125, 255, 0.12);
  color: var(--primary-color);
  font-size: 11px;
  font-weight: 700;
}

.ssh-workspace__detail-body,
.ssh-workspace__forward-copy {
  display: grid;
  gap: 4px;
}

.ssh-workspace__detail-muted {
  color: var(--muted-color);
  font-size: 12px;
}

.ssh-workspace__forward-list {
  display: grid;
  gap: 8px;
}

.ssh-workspace__forward-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--workspace-terminal-bg) 86%, var(--surface-1));
}

.ssh-workspace__forward-main {
  color: var(--text-color);
  font-size: 12px;
  font-weight: 600;
}

.ssh-pane-grid {
  display: grid;
  gap: 12px;
  min-height: 0;
  padding: 0 10px 10px;
}

.ssh-pane-card {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--border-color) 92%, transparent);
  background: color-mix(in srgb, var(--workspace-terminal-bg) 88%, var(--surface-1));
  overflow: hidden;
}

.ssh-pane-card.is-active {
  border-color: color-mix(in srgb, var(--primary-color) 64%, var(--border-color));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary-color) 30%, transparent);
}

.ssh-pane-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--border-color) 85%, transparent);
  background: color-mix(in srgb, var(--surface-1) 86%, transparent);
}

.ssh-pane-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.ssh-pane-card__title strong {
  color: var(--text-color);
  font-size: 12px;
}

.ssh-pane-card__status {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.ssh-pane-card__status.is-connected {
  color: #0f766e;
  background: rgba(16, 185, 129, 0.16);
}

.ssh-pane-card__status.is-connecting {
  color: #9a6700;
  background: rgba(245, 158, 11, 0.18);
}

.ssh-pane-card__status.is-disconnected {
  color: #b42318;
  background: rgba(239, 68, 68, 0.16);
}

.ssh-pane-card__actions {
  display: flex;
  gap: 4px;
}

.ssh-pane-card__body {
  min-height: 0;
}

.ssh-workspace__files {
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.ssh-workspace__splitter {
  position: relative;
  cursor: row-resize;
  touch-action: none;
  margin: 0;
}

.ssh-workspace__splitter::before {
  content: "";
  position: absolute;
  inset: 1px 0;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(105, 149, 214, 0.02), rgba(105, 149, 214, 0.16), rgba(105, 149, 214, 0.02));
}

.ssh-workspace__splitter-handle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 44px;
  height: 3px;
  border-radius: 999px;
  background: rgba(99, 145, 211, 0.72);
  transform: translate(-50%, -50%);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.42);
}

.ssh-workspace.is-resizing .ssh-workspace__splitter-handle,
.ssh-workspace__splitter:hover .ssh-workspace__splitter-handle {
  background: var(--primary-color);
}

.ssh-workspace--comfortable,
.ssh-workspace--balanced,
.ssh-workspace--compact {
  padding: 0;
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
    grid-template-rows: minmax(170px, 0.8fr) 8px minmax(200px, 1.2fr);
    padding: 4px;
  }

  .ssh-pane-grid {
    grid-template-columns: minmax(0, 1fr) !important;
  }

  .ssh-workspace__toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .ssh-workspace__forward-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
