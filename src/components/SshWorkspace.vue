<template>
  <div class="ssh-workspace-shell" :class="{ 'has-monitor': embeddedMonitorVisible }">
    <RightPanel
      class="ssh-workspace__monitor"
      :class="{ 'is-hidden': !embeddedMonitorVisible }"
      :collapsed="embeddedMonitorCollapsed"
      :connection-id="connectionId || ''"
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
        <Terminal
          :id="id"
          :active="active"
          :theme="theme"
          :config="config"
          :auto-password="autoPassword"
          :ssh-user="profile?.username || ''"
          type="ssh"
          @close="$emit('close')"
          @current-directory-change="handleTerminalDirectoryChange"
          @reconnect="$emit('reconnect')"
        />
      </section>

      <div
        class="ssh-workspace__splitter"
        @pointerdown="startResize"
      >
        <span class="ssh-workspace__splitter-handle"></span>
      </div>

      <section class="ssh-workspace__files">
        <RemoteFileWorkbench
          :connection-id="connectionId"
          :active="active"
          :sync-path="terminalPath"
          :density="workspaceDensity"
          :title="workspaceTitle"
          @open-file-preview="$emit('openFilePreview', $event)"
          @start-download="$emit('startDownload', $event)"
          @start-upload="$emit('startUpload', $event)"
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
import type {
  DownloadRequest,
  SftpFileEntry,
  SshProfile,
  TerminalConfig,
  ThemeName,
  UploadRequest,
  WorkspaceDensity,
} from '../types/app'

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
const terminalHeight = ref(0)
const isResizing = ref(false)
const terminalPath = ref('')
const splitterHeight = 8
const terminalRatio = ref(0.4)
let resizeFrame = 0
let resizeObserver: ResizeObserver | null = null
const workspaceDensity = computed<WorkspaceDensity>(() => props.config.density || 'balanced')

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
  const ratio = forceDefault ? getDefaultTerminalRatio(workspaceDensity.value) : terminalRatio.value
  const nextHeight = Math.round((workspaceRef.value.clientHeight - splitterHeight) * ratio)
  const clampedHeight = getClampedTerminalHeight(nextHeight)
  terminalHeight.value = clampedHeight
  updateTerminalRatio(clampedHeight)
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

function handleTerminalDirectoryChange(path: string) {
  terminalPath.value = path
}

onMounted(async () => {
  await nextTick()
  terminalRatio.value = getDefaultTerminalRatio(workspaceDensity.value)
  syncSplitFromRatio(true)

  if (workspaceRef.value) {
    resizeObserver = new ResizeObserver(() => {
      if (!isResizing.value) {
        syncSplitFromRatio()
      }
    })
    resizeObserver.observe(workspaceRef.value)
  }
})

watch(workspaceDensity, (nextDensity) => {
  terminalRatio.value = getDefaultTerminalRatio(nextDensity)
  syncSplitFromRatio(true)
})

onBeforeUnmount(() => {
  if (resizeFrame) cancelAnimationFrame(resizeFrame)
  resizeObserver?.disconnect()
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
})
</script>

<style scoped>
.ssh-workspace-shell {
  display: flex;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.ssh-workspace__monitor {
  flex: 0 0 auto;
  min-width: 0;
  min-height: 0;
}

.ssh-workspace__monitor.is-hidden {
  width: 0;
  min-width: 0;
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
  border-radius: 0;
  background: transparent;
  box-shadow: none;
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

.ssh-workspace--comfortable {
  padding: 0;
}

.ssh-workspace--balanced {
  padding: 0;
}

.ssh-workspace--compact {
  padding: 0;
}

@media (max-width: 1080px) {
  .ssh-workspace-shell {
    flex-direction: column;
  }

  .ssh-workspace__monitor {
    max-height: 320px;
  }

  .ssh-workspace {
    grid-template-rows: minmax(170px, 0.8fr) 8px minmax(200px, 1.2fr);
    padding: 4px;
  }
}
</style>
