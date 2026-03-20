<template>
  <div class="remote-workbench" :class="`remote-workbench--${density}`" :style="workbenchStyle">
    <div v-if="connectionId" class="remote-workbench__body">
      <!-- 1. Path Bar & Toolbar -->
      <RemotePathBar
        :current-path="currentPath"
        :can-go-back="canGoBack"
        :can-go-forward="canGoForward"
        :is-loading="loading"
        v-model:searchText="searchText"
        :file-count="visibleFiles.length"
        @navigate="loadFiles"
        @go-back="goBack"
        @go-forward="goForward"
        @go-up="goUp"
        @refresh="refreshCurrentPath"
        @create-folder="() => createFolder()"
      />

      <div class="remote-workbench__content">
        <!-- 2. Directory Tree -->
        <RemoteDirectoryTree
          :key="treeVersion"
          :connection-id="connectionId"
          :current-path="currentPath"
          :show-hidden="showHiddenFiles"
          :internal-drag-active="internalDrag.active"
          :internal-drag-target-path="internalDrag.targetPath"
          :internal-drag-source-paths="internalDrag.sourcePaths"
          :rename-view="renameState.view"
          :rename-path="renameState.path"
          :rename-value="renameState.value"
          @select="loadFiles"
          @context-menu="openContextMenuAt"
          @drag-move="moveEntriesToDirectory"
          @internal-drag-change="handleInternalDragChange"
          @internal-drag-target-change="handleInternalDragTargetChange"
          @rename-value-change="handleRenameValueChange"
          @rename-submit="submitInlineRename"
          @rename-cancel="cancelInlineRename"
        />

        <!-- 3. File Table -->
        <RemoteFileTable
          :files="sortedFiles"
          :loading="loading"
          :selected-paths="selectedPaths"
          :primary-selected-path="primarySelectedPath"
          :current-path="currentPath"
          :density="density"
          :search-text="searchText"
          :internal-drag-active="internalDrag.active"
          :internal-drag-target-path="internalDrag.targetPath"
          :rename-view="renameState.view"
          :rename-path="renameState.path"
          :rename-value="renameState.value"
          @navigate="loadFiles"
          @select="setSelectedPaths"
          @open-file="openEntry"
          @context-menu="openContextMenuAt"
          @sort="handleSort"
          @drag-move="moveEntriesToDirectory"
          @internal-drag-change="handleInternalDragChange"
          @external-drop="handleExternalDrop"
          @rename-value-change="handleRenameValueChange"
          @rename-submit="submitInlineRename"
          @rename-cancel="cancelInlineRename"
        />
      </div>

      <!-- 4. Status Bar & Audit Log -->
      <div class="remote-workbench__footer">
        <RemoteAuditLog :logs="auditLogs" />
        <RemoteStatusBar
          :file-count="visibleFiles.length - directories.length"
          :directory-count="directories.length"
          :selected-count="selectedPaths.length"
          :show-hidden="showHiddenFiles"
          :filter-summary="filterSummary"
          :disk-usage="diskInfo"
          @toggle-hidden="toggleShowHidden"
        />
      </div>
    </div>

    <div v-else class="remote-workbench__empty">
      <a-empty description="等待 SSH 文件连接建立" />
    </div>

    <!-- 5. Modals & Context Menu -->
    <FileContextMenu
      :open="contextMenu.open"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenu.items"
      @click="handleContextMenuClick"
      @close="closeContextMenu"
    />

    <ChmodModal
      v-model:open="permissionModal.open"
      :loading="permissionModal.loading"
      :path="permissionModal.path"
      :name="permissionModal.name"
      :is-directory="permissionModal.isDirectory"
      :initial-mode="permissionModal.initialMode"
      @apply="applyEntryPermissions"
    />

    <ChownModal
      v-model:open="chownModal.open"
      :loading="chownModal.loading"
      :path="chownModal.path"
      :current-owner="chownModal.currentOwner"
      :current-group="chownModal.currentGroup"
      @apply="applyChown"
    />

    <input
      ref="uploadInputRef"
      type="file"
      multiple
      class="remote-upload-input"
      @change="handleContextUploadChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, reactive, ref, watch, provide } from 'vue'
import { Modal, message, Input } from 'antdv-next'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import type { UnlistenFn } from '@tauri-apps/api/event'
import type { 
  DownloadRequest, 
  SftpFileEntry, 
  UploadRequest, 
  WorkspaceDensity 
} from '../types/app'

// Sub-components
import RemotePathBar from './remote-file/RemotePathBar.vue'
import RemoteDirectoryTree from './remote-file/RemoteDirectoryTree.vue'
import RemoteFileTable from './remote-file/RemoteFileTable.vue'
import FileContextMenu from './remote-file/FileContextMenu.vue'
import RemoteStatusBar from './remote-file/RemoteStatusBar.vue'
import RemoteAuditLog from './remote-file/RemoteAuditLog.vue'
import ChmodModal from './remote-file/ChmodModal.vue'
import ChownModal from './remote-file/ChownModal.vue'

const props = withDefaults(defineProps<{
  connectionId?: string | null
  title?: string
  active?: boolean
  syncPath?: string
  density?: WorkspaceDensity
  fontFamily?: string
}>(), {
  connectionId: '',
  title: '远程工作区',
  active: false,
  syncPath: '',
  density: 'compact',
  fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
})

const emit = defineEmits<{
  openFilePreview: [file: SftpFileEntry]
  startDownload: [download: DownloadRequest]
  startUpload: [upload: UploadRequest]
}>()

// --- State ---
const currentPath = ref('/')
const files = ref<SftpFileEntry[]>([])
const loading = ref(false)
const showHiddenFiles = ref(false)
const searchText = ref('')
const selectedPaths = ref<string[]>([])
const primarySelectedPath = ref('')
const history = ref<string[]>([])
const historyIndex = ref(-1)
const auditLogs = ref<any[]>([])
const diskInfo = ref<any>(null)
const treeVersion = ref(0)
let latestLoadRequestId = 0

const sortKey = ref('name')
const sortOrder = ref('ascend')

const internalDrag = reactive({
  active: false,
  sourcePaths: [] as string[],
  targetPath: ''
})

const renameState = reactive({
  view: '' as '' | 'table' | 'tree',
  path: '',
  value: ''
})

const contextMenu = reactive({
  open: false,
  x: 0,
  y: 0,
  items: [] as any[],
  scope: 'surface' as 'surface' | 'entry' | 'selection',
  sourceView: 'table' as 'table' | 'tree',
  entry: null as SftpFileEntry | null,
  entries: [] as SftpFileEntry[]
})

const permissionModal = reactive({
  open: false,
  loading: false,
  path: '',
  name: '',
  isDirectory: false,
  initialMode: ''
})

const chownModal = reactive({
  open: false,
  loading: false,
  path: '',
  currentOwner: '',
  currentGroup: ''
})

const uploadInputRef = ref<HTMLInputElement | null>(null)
const pendingUploadTargetPath = ref('/')

// --- Computed ---
const visibleFiles = computed(() => {
  return showHiddenFiles.value ? files.value : files.value.filter(f => !f.name.startsWith('.'))
})

const directories = computed(() => visibleFiles.value.filter(f => f.is_dir || f.is_directory))

const sortedFiles = computed(() => {
  const res = [...visibleFiles.value]
  if (searchText.value) {
    const kw = searchText.value.toLowerCase()
    return res.filter(f => f.name.toLowerCase().includes(kw))
  }
  return res.sort((a, b) => {
    const isDirA = a.is_dir || a.is_directory
    const isDirB = b.is_dir || b.is_directory
    if (isDirA !== isDirB) return isDirA ? -1 : 1
    
    const factor = sortOrder.value === 'ascend' ? 1 : -1
    if (sortKey.value === 'size') return ((a.size || 0) - (b.size || 0)) * factor
    if (sortKey.value === 'modified') return ((a.modified || 0) - (b.modified || 0)) * factor
    return a.name.localeCompare(b.name) * factor
  })
})

const canGoBack = computed(() => historyIndex.value > 0)
const canGoForward = computed(() => historyIndex.value < history.value.length - 1)
const filterSummary = computed(() => searchText.value ? `匹配 ${sortedFiles.value.length} / ${visibleFiles.value.length} 项` : '')
const workbenchStyle = computed(() => ({
  '--remote-file-font-family': props.fontFamily,
}))

// --- Actions & Methods ---

function addAuditLog(command: string, status: 'success' | 'error' = 'success') {
  auditLogs.value.push({
    timestamp: new Date().toLocaleTimeString(),
    command,
    status
  })
}

function refreshTree() {
  treeVersion.value += 1
}

function normalizeSyncPath(path: string) {
  const cleaned = path
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .replace(/\/{2,}/g, '/')

  if (!cleaned) return ''
  if (cleaned === '/') return '/'
  return cleaned.replace(/[#$]$/, '') || '/'
}

async function loadFiles(path: string, fromHistory = false, options?: { silentError?: boolean }) {
  if (!props.connectionId) return
  const normalizedPath = path || '/'
  const requestId = ++latestLoadRequestId
  loading.value = true
  try {
    const entries = await invoke<SftpFileEntry[]>('list_sftp_files', {
      connectionId: props.connectionId,
      path: normalizedPath
    })
    if (requestId !== latestLoadRequestId) return
    // 后端返回的 SftpFileInfo 只有 name 没有 path，需要补全完整路径
    files.value = entries.map(e => ({
      ...e,
      path: e.path || (normalizedPath === '/' ? `/${e.name}` : `${normalizedPath}/${e.name}`)
    }))
    currentPath.value = normalizedPath
    if (!fromHistory) {
      history.value = history.value.slice(0, historyIndex.value + 1)
      history.value.push(normalizedPath)
      historyIndex.value = history.value.length - 1
    }
    selectedPaths.value = []
    primarySelectedPath.value = ''
    addAuditLog(`ls ${normalizedPath}`)
  } catch (e) {
    if (requestId !== latestLoadRequestId) return
    console.error('加载远程文件失败:', normalizedPath, e)
    if (!options?.silentError) {
      message.error('加载文件失败')
    }
    addAuditLog(`ls ${normalizedPath}`, 'error')
  } finally {
    if (requestId === latestLoadRequestId) {
      loading.value = false
    }
  }
}

function refreshCurrentPath() {
  loadFiles(currentPath.value, true)
}

async function syncWorkbenchToTerminalPath(nextPath: string) {
  if (!props.connectionId) return
  const normalizedPath = normalizeSyncPath(nextPath)
  if (!normalizedPath || normalizedPath === currentPath.value) return

  cancelInlineRename()
  loadFiles(normalizedPath, false, { silentError: true })
}

function goBack() {
  if (canGoBack.value) {
    historyIndex.value--
    loadFiles(history.value[historyIndex.value], true)
  }
}

function goForward() {
  if (canGoForward.value) {
    historyIndex.value++
    loadFiles(history.value[historyIndex.value], true)
  }
}

function goUp() {
  if (currentPath.value === '/') return
  const parts = currentPath.value.split('/').filter(Boolean)
  parts.pop()
  loadFiles('/' + parts.join('/'))
}

function toggleShowHidden() {
  showHiddenFiles.value = !showHiddenFiles.value
}

function setSelectedPaths(paths: string[], primaryPath: string) {
  selectedPaths.value = paths
  primarySelectedPath.value = primaryPath
}

function handleSort(key: string, order: string) {
  sortKey.value = key
  sortOrder.value = order
}

function handleInternalDragChange(state: {
  active: boolean
  sourcePaths: string[]
  targetPath: string
}) {
  internalDrag.active = state.active
  internalDrag.sourcePaths = state.sourcePaths
  internalDrag.targetPath = state.targetPath
}

function handleInternalDragTargetChange(path: string) {
  if (!internalDrag.active) return
  internalDrag.targetPath = path
}

function handleRenameValueChange(value: string) {
  renameState.value = value
}

function startInlineRename(entry: SftpFileEntry, sourceView: 'table' | 'tree') {
  renameState.view = sourceView
  renameState.path = entry.path
  renameState.value = entry.name
}

function cancelInlineRename() {
  renameState.view = ''
  renameState.path = ''
  renameState.value = ''
}

async function submitInlineRename(path: string, value: string) {
  const nextName = value.trim()
  if (!path || path !== renameState.path) return
  if (!nextName) {
    message.warning('名称不能为空')
    return
  }

  const currentEntry = files.value.find(file => file.path === path)
    || (contextMenu.entry?.path === path ? contextMenu.entry : null)
  const currentName = currentEntry?.name || path.split('/').filter(Boolean).pop() || ''
  if (nextName === currentName) {
    cancelInlineRename()
    return
  }

  const parent = path.substring(0, path.lastIndexOf('/')) || '/'
  const newPath = parent === '/' ? `/${nextName}` : `${parent}/${nextName}`

  try {
    await invoke('rename_sftp_file', { connectionId: props.connectionId, oldPath: path, newPath })
    message.success('重命名成功')
    cancelInlineRename()
    refreshCurrentPath()
    refreshTree()
    addAuditLog(`mv ${path} ${newPath}`)
  } catch (e) {
    message.error('重命名失败')
  }
}

function normalizeDirPrefix(path: string) {
  return path.endsWith('/') ? path : `${path}/`
}

function isNestedMoveTarget(sourcePath: string, targetPath: string) {
  return targetPath.startsWith(normalizeDirPrefix(sourcePath))
}

// File Operations
async function createFolder() {
  cancelInlineRename()
  const folderName = ref('')
  Modal.confirm({
    title: '新建文件夹',
    content: () => h(Input, {
      value: folderName.value,
      placeholder: '请输入名称',
      'onUpdate:value': (v: string) => folderName.value = v
    }),
    onOk: async () => {
      if (!folderName.value) return
      const path = currentPath.value === '/' ? `/${folderName.value}` : `${currentPath.value}/${folderName.value}`
      try {
        await invoke('create_sftp_directory', { connectionId: props.connectionId, path })
        message.success('创建成功')
        refreshCurrentPath()
        refreshTree()
        addAuditLog(`mkdir ${path}`)
      } catch (e) {
        message.error('创建失败')
      }
    }
  })
}

async function deleteSelected(entriesToDelete?: SftpFileEntry[]) {
  cancelInlineRename()
  const targets = entriesToDelete || files.value.filter(f => selectedPaths.value.includes(f.path))
  if (!targets.length) return
  Modal.confirm({
    title: `确认删除这 ${targets.length} 项吗？`,
    okType: 'danger',
    onOk: async () => {
      for (const entry of targets) {
        try {
          if (entry.is_dir || entry.is_directory) {
            await invoke('delete_sftp_directory', { connectionId: props.connectionId, path: entry.path })
          } else {
            await invoke('delete_sftp_file', { connectionId: props.connectionId, path: entry.path })
          }
        } catch (e) {
          console.error(`Delete failed: ${entry.path}`, e)
        }
      }
      message.success('删除完成')
      refreshCurrentPath()
      refreshTree()
      addAuditLog(`rm -rf ${targets.map(e => e.path).join(' ')}`)
    }
  })
}

// Drag & Drop
async function moveEntriesToDirectory(entries: SftpFileEntry[], targetPath: string) {
  const movedEntries: string[] = []
  const blockedEntries: string[] = []
  const failedEntries: string[] = []

  for (const entry of entries) {
    const newPath = targetPath === '/' ? `/${entry.name}` : `${targetPath}/${entry.name}`
    if (entry.path === newPath) continue

    if ((entry.is_dir || entry.is_directory) && isNestedMoveTarget(entry.path, targetPath)) {
      blockedEntries.push(entry.name)
      continue
    }

    try {
      await invoke('rename_sftp_file', { 
        connectionId: props.connectionId, 
        oldPath: entry.path, 
        newPath 
      })
      movedEntries.push(entry.name)
    } catch (e) {
      failedEntries.push(entry.name)
    }
  }

  refreshCurrentPath()
  refreshTree()

  if (movedEntries.length) {
    addAuditLog(`mv ${movedEntries.join(' ')} -> ${targetPath}`)
  }

  if (movedEntries.length && !failedEntries.length && !blockedEntries.length) {
    message.success(`已移动 ${movedEntries.length} 项到 ${targetPath}`)
    return
  }

  if (movedEntries.length) {
    const details = [
      `已移动 ${movedEntries.length} 项`,
      blockedEntries.length ? `${blockedEntries.length} 项因目标位于自身子目录而跳过` : '',
      failedEntries.length ? `${failedEntries.length} 项移动失败` : '',
    ].filter(Boolean)
    message.warning(details.join('，'))
    return
  }

  if (blockedEntries.length && !failedEntries.length) {
    message.warning('不能把文件夹拖入它自己的子目录')
    return
  }

  message.error(failedEntries.length > 1 ? '部分文件移动失败' : `移动 ${failedEntries[0] || '文件'} 失败`)
}

function handleExternalDrop(fileList: FileList, targetPath: string) {
  const uploadPath = targetPath || currentPath.value
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i]
    emit('startUpload', {
      fileName: file.name,
      targetPath: uploadPath === '/' ? `/${file.name}` : `${uploadPath}/${file.name}`,
      connectionId: props.connectionId!,
      source: { kind: 'file', file }
    })
  }
}

// Context Menu
function openContextMenuAt(
  event: MouseEvent,
  entry: SftpFileEntry | null,
  entries: SftpFileEntry[],
  sourceView: 'table' | 'tree' = 'table'
) {
  contextMenu.x = event.clientX
  contextMenu.y = event.clientY
  contextMenu.sourceView = sourceView
  contextMenu.entry = entry
  contextMenu.entries = entries
  contextMenu.open = true
  
  if (entries.length > 1) {
    contextMenu.scope = 'selection'
    contextMenu.items = [
      { key: 'download', label: '下载所选' },
      { key: 'delete', label: '删除所选', danger: true },
      { key: 'copyPath', label: '复制路径' }
    ]
  } else if (entry) {
    contextMenu.scope = 'entry'
    contextMenu.items = [
      { key: 'open', label: entry.is_dir ? '打开' : '打开预览' },
      { key: 'download', label: '下载' },
      { key: 'rename', label: '重命名' },
      { key: 'chmod', label: '权限 (chmod)' },
      { key: 'chown', label: '所有者 (chown)' },
      { key: 'delete', label: '删除', danger: true },
      { key: 'copyPath', label: '复制路径' }
    ]
  } else {
    contextMenu.scope = 'surface'
    contextMenu.items = [
      { key: 'mkdir', label: '新建文件夹' },
      { key: 'refresh', label: '刷新' },
      { key: 'upload', label: '上传文件...' }
    ]
  }
}

function handleContextMenuClick(key: string) {
  const entry = contextMenu.entry
  const entries = contextMenu.entries
  
  switch (key) {
    case 'open': if (entry) openEntry(entry); break
    case 'download': 
      if (entries.length) entries.forEach(e => downloadFile(e))
      break
    case 'delete': deleteSelected(entries.length ? entries : undefined); break
    case 'rename': if (entry) startInlineRename(entry, contextMenu.sourceView); break
    case 'chmod': if (entry) openChmod(entry); break
    case 'chown': if (entry) openChown(entry); break
    case 'mkdir': createFolder(); break
    case 'refresh': refreshCurrentPath(); break
    case 'upload': openUploadPicker(); break
    case 'copyPath': 
      const paths = entries.map(e => e.path).join('\n')
      navigator.clipboard.writeText(paths)
      message.success('已复制到剪贴板')
      break
  }
}

function closeContextMenu() {
  contextMenu.open = false
}

// Modals
function openChmod(file: SftpFileEntry) {
  permissionModal.path = file.path
  permissionModal.name = file.name
  permissionModal.isDirectory = !!(file.is_dir || file.is_directory)
  permissionModal.initialMode = file.permissions || '755'
  permissionModal.open = true
}

async function applyEntryPermissions(mode: number, recursive: boolean, scope: string) {
  permissionModal.loading = true
  try {
    const cmd = recursive ? `chmod -R ${mode.toString(8)} ${permissionModal.path}` : `chmod ${mode.toString(8)} ${permissionModal.path}`
    await invoke('execute_ssh_command', { connectionId: props.connectionId, command: cmd })
    message.success('修改成功')
    permissionModal.open = false
    refreshCurrentPath()
    addAuditLog(cmd)
  } catch (e) {
    message.error('修改失败')
  } finally {
    permissionModal.loading = false
  }
}

function openChown(file: SftpFileEntry) {
  chownModal.path = file.path
  chownModal.currentOwner = '' // Would need stat for accurate current owner
  chownModal.currentGroup = ''
  chownModal.open = true
}

async function applyChown(user: string, group: string, recursive: boolean) {
  chownModal.loading = true
  try {
    const target = group ? `${user}:${group}` : user
    const cmd = recursive ? `chown -R ${target} ${chownModal.path}` : `chown ${target} ${chownModal.path}`
    await invoke('execute_ssh_command', { connectionId: props.connectionId, command: cmd })
    message.success('修改成功')
    chownModal.open = false
    refreshCurrentPath()
    addAuditLog(cmd)
  } catch (e) {
    message.error('修改失败')
  } finally {
    chownModal.loading = false
  }
}

function openEntry(file: SftpFileEntry) {
  if (file.is_dir || file.is_directory) {
    loadFiles(file.path)
  } else {
    emit('openFilePreview', file)
  }
}

async function downloadFile(file: SftpFileEntry) {
  const savePath = await invoke<string | null>('select_download_location', { fileName: file.name })
  if (!savePath) return
  emit('startDownload', {
    fileName: file.name,
    remotePath: file.path,
    savePath,
    connectionId: props.connectionId!
  })
}

function openUploadPicker() {
  uploadInputRef.value?.click()
}

function handleContextUploadChange(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files) handleExternalDrop(files, currentPath.value)
}

// --- Lifecycle ---
let unlistenDragDrop: UnlistenFn | null = null
let transferCompleteListener: ((event: Event) => void) | null = null

onMounted(async () => {
  if (props.syncPath) loadFiles(props.syncPath)
  else loadFiles('/')

  unlistenDragDrop = await getCurrentWebview().onDragDropEvent((e) => {
    if (!props.connectionId || !props.active) return

    if (e.payload.type === 'drop' && e.payload.paths?.length) {
      const batchId = `upload-${Date.now()}`
      const batchLabel = e.payload.paths.length > 1 ? `批量上传 (${e.payload.paths.length}项)` : undefined
      for (const localPath of e.payload.paths) {
        const fileName = localPath.split(/[\\/]/).pop() || localPath
        emit('startUpload', {
          fileName,
          targetPath: currentPath.value === '/' ? `/${fileName}` : `${currentPath.value}/${fileName}`,
          connectionId: props.connectionId,
          source: { kind: 'local-path', localPath },
          batchId: e.payload.paths.length > 1 ? batchId : undefined,
          batchLabel,
        })
      }
    }
  })

  // Auto-refresh after upload/download completes
  transferCompleteListener = (event: Event) => {
    const detail = (event as CustomEvent<{
      direction: string
      connectionId: string
      status: string
    }>).detail
    if (!detail || detail.connectionId !== props.connectionId) return
    if (detail.status === 'completed') {
      refreshCurrentPath()
    }
  }
  window.addEventListener('transfer-complete', transferCompleteListener)
})

onBeforeUnmount(() => {
  if (unlistenDragDrop) unlistenDragDrop()
  if (transferCompleteListener) {
    window.removeEventListener('transfer-complete', transferCompleteListener)
    transferCompleteListener = null
  }
})

watch(() => props.connectionId, (newId) => {
  if (newId) loadFiles(props.syncPath || '/')
})

watch(() => props.syncPath, (nextPath) => {
  if (!nextPath) return
  syncWorkbenchToTerminalPath(nextPath)
})

provide('connectionId', props.connectionId)
</script>

<style scoped>
.remote-workbench {
  --remote-content-bg: linear-gradient(180deg, #d7dde5 0%, #d3dae3 100%);
  --remote-content-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    inset 0 0 0 1px rgba(146, 157, 171, 0.18);
  --remote-tree-border: #b8c3cf;
  --remote-tree-bg: linear-gradient(180deg, #e2e8ef 0%, #dbe2ea 100%);
  --remote-tree-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.42);
  --remote-tree-switcher-color: #4a5767;
  --remote-tree-text: #243140;
  --remote-tree-hover-bg: rgba(102, 123, 145, 0.12);
  --remote-tree-current-bg: linear-gradient(180deg, #d3e5fa 0%, #c3d9f0 100%);
  --remote-tree-current-text: #17334d;
  --remote-tree-current-shadow: inset 0 0 0 1px rgba(98, 140, 186, 0.28);
  --remote-tree-drop-bg: linear-gradient(180deg, #c6dcf4 0%, #b8d1ec 100%);
  --remote-tree-drop-shadow:
    inset 0 0 0 1px rgba(75, 123, 173, 0.34),
    0 0 0 1px rgba(255, 255, 255, 0.4);
  --remote-tree-empty-text: #6a7583;
  --remote-table-bg: linear-gradient(180deg, #eef2f5 0%, #e9edf2 100%);
  --remote-table-text: #273341;
  --remote-table-header-text: #4a5664;
  --remote-table-header-bg: linear-gradient(180deg, #dde4eb 0%, #d7dee6 100%);
  --remote-table-row-bg: rgba(245, 247, 249, 0.78);
  --remote-table-row-border: rgba(160, 171, 183, 0.32);
  --remote-table-row-hover: rgba(224, 230, 236, 0.92);
  --remote-table-row-selected: rgba(201, 216, 232, 0.96);
  --remote-table-row-selected-hover: rgba(191, 208, 226, 0.98);
  --remote-table-row-selected-current: rgba(182, 201, 221, 0.98);
  --remote-drop-outline: rgba(78, 118, 163, 0.82);
  --remote-drop-bg: rgba(195, 210, 226, 0.78);
  --remote-name-input-bg: #f6f9fc;
  --remote-name-input-text: #223142;
  --remote-meta-text: #5e6b7a;
  --remote-mono-text: #495664;
  --remote-drop-mask-bg: rgba(205, 218, 231, 0.86);
  --remote-drop-mask-border: rgba(76, 119, 167, 0.92);
  --remote-drop-mask-icon: #355c85;
  --remote-footer-bg: rgba(227, 233, 239, 0.94);
  --remote-footer-border: rgba(160, 171, 183, 0.42);
  --remote-audit-bg: rgba(242, 245, 248, 0.96);
  --remote-audit-text: #627082;
  --remote-folder-top: #7ab2ff;
  --remote-folder-body: #4c8dff;
  --remote-folder-stroke: #2c6be4;
  --remote-file-paper: #f8fafc;
  --remote-file-fold: #e9eef5;
  --remote-file-stroke: #8c98a8;
  --remote-file-accent-generic: #7b8ea6;
  --remote-file-accent-text: #5d8cff;
  --remote-file-accent-image: #53a57f;
  --remote-file-accent-archive: #c77d34;
  --remote-file-accent-video: #7b67d7;
  --remote-file-accent-audio: #3e9bb0;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--rw-bg-primary, #ffffff);
  font-family: var(--remote-file-font-family, inherit);
  overflow: hidden;
}

:global(body[data-theme="dark"] .remote-workbench) {
  --remote-content-bg: linear-gradient(180deg, #101825 0%, #0d1420 100%);
  --remote-content-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    inset 0 0 0 1px rgba(36, 52, 77, 0.9);
  --remote-tree-border: #24344d;
  --remote-tree-bg: linear-gradient(180deg, #142033 0%, #111b2b 100%);
  --remote-tree-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.03);
  --remote-tree-switcher-color: #8da0bb;
  --remote-tree-text: #dce7f7;
  --remote-tree-hover-bg: rgba(121, 149, 188, 0.14);
  --remote-tree-current-bg: linear-gradient(180deg, rgba(83, 122, 177, 0.44) 0%, rgba(65, 100, 149, 0.42) 100%);
  --remote-tree-current-text: #eff6ff;
  --remote-tree-current-shadow: inset 0 0 0 1px rgba(113, 167, 255, 0.22);
  --remote-tree-drop-bg: linear-gradient(180deg, rgba(85, 126, 181, 0.54) 0%, rgba(68, 105, 153, 0.5) 100%);
  --remote-tree-drop-shadow:
    inset 0 0 0 1px rgba(113, 167, 255, 0.28),
    0 0 0 1px rgba(255, 255, 255, 0.04);
  --remote-tree-empty-text: #8ea0b8;
  --remote-table-bg: linear-gradient(180deg, #111a29 0%, #0e1623 100%);
  --remote-table-text: #dce7f7;
  --remote-table-header-text: #98aac2;
  --remote-table-header-bg: linear-gradient(180deg, #182434 0%, #15202f 100%);
  --remote-table-row-bg: rgba(17, 26, 39, 0.9);
  --remote-table-row-border: rgba(38, 55, 80, 0.7);
  --remote-table-row-hover: rgba(33, 48, 71, 0.92);
  --remote-table-row-selected: rgba(50, 72, 104, 0.92);
  --remote-table-row-selected-hover: rgba(59, 83, 119, 0.94);
  --remote-table-row-selected-current: rgba(66, 92, 130, 0.96);
  --remote-drop-outline: rgba(113, 167, 255, 0.58);
  --remote-drop-bg: rgba(67, 94, 131, 0.76);
  --remote-name-input-bg: #162131;
  --remote-name-input-text: #edf4ff;
  --remote-meta-text: #8fa2bb;
  --remote-mono-text: #a6b5c9;
  --remote-drop-mask-bg: rgba(22, 34, 50, 0.9);
  --remote-drop-mask-border: rgba(113, 167, 255, 0.52);
  --remote-drop-mask-icon: #8fbeff;
  --remote-footer-bg: rgba(14, 22, 35, 0.96);
  --remote-footer-border: rgba(36, 52, 77, 0.92);
  --remote-audit-bg: rgba(16, 25, 39, 0.98);
  --remote-audit-text: #9cb0ca;
  --remote-folder-top: #78a9ff;
  --remote-folder-body: #4d86ea;
  --remote-folder-stroke: #8fbeff;
  --remote-file-paper: #d8e4f6;
  --remote-file-fold: #b7c9df;
  --remote-file-stroke: #90a7c3;
  --remote-file-accent-generic: #93aaca;
  --remote-file-accent-text: #83b3ff;
  --remote-file-accent-image: #69c29b;
  --remote-file-accent-archive: #f2ae66;
  --remote-file-accent-video: #a58bff;
  --remote-file-accent-audio: #64c7d6;
}

.remote-workbench__body {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.remote-workbench__content {
  flex: 1;
  display: flex;
  overflow: hidden;
  background: var(--remote-content-bg);
  box-shadow: var(--remote-content-shadow);
}

.remote-workbench__footer {
  position: relative;
  background: var(--remote-footer-bg);
  border-top: 1px solid var(--remote-footer-border);
}

.remote-workbench__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remote-upload-input {
  display: none;
}

/* Density overrides */
.remote-workbench--compact {
  --rw-toolbar-height: 32px;
}
</style>
