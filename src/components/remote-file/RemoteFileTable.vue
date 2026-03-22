<template>
  <section
    ref="tableWrapRef"
    class="remote-file-table"
    :class="{ 'is-box-selecting': selBox.dragging }"
    tabindex="0"
    @contextmenu.prevent="handleSurfaceContext"
    @focus="isFocused = true"
    @blur="isFocused = false"
    @keydown="handleKeyDown"
  >
    <vxe-table
      ref="tableRef"
      :data="files"
      :loading="loading"
      height="auto"
      :scroll-y="{ enabled: true, gt: 200 }"
      :row-config="{ height: 32, isCurrent: true, isHover: true }"
      :sort-config="{ trigger: 'cell', multiple: false }"
      :menu-config="{ enabled: true, body: { options: [[]] } }"
      :row-class-name="rowClassName"
      :empty-text="searchText ? '没有匹配的文件' : '当前目录为空'"
      @cell-click="handleCellClick"
      @cell-dblclick="handleCellDblClick"
      @cell-menu="handleCellContext"
      @sort-change="handleSortChange"
    >
      <vxe-column field="name" title="文件名" min-width="220" sortable>
        <template #default="{ row }">
          <div
            class="remote-name-cell"
            :class="{ 'is-drop-target': dropTargetPath === getFilePath(row) }"
            data-internal-drag-handle="true"
            @pointerdown="handleRowPointerDown(row, $event)"
          >
            <component :is="getFileIcon(row)" class="remote-name-cell__icon" />
            <input
              v-if="isRenameActive(row)"
              :ref="bindRenameInputRef"
              class="remote-name-cell__input"
              :value="renameValue"
              spellcheck="false"
              @pointerdown.stop
              @click.stop
              @input="handleRenameInput"
              @keydown="handleRenameKeyDown"
              @blur="handleRenameBlur"
            />
            <span v-else class="remote-name-cell__label">{{ row.name }}</span>
            <span v-if="row.isSymlink || row.is_symlink" class="remote-name-cell__symlink">→</span>
          </div>
        </template>
      </vxe-column>

      <vxe-column field="kind" title="类型" width="90" sortable>
        <template #default="{ row }">
          <span class="remote-cell__tag">{{ isDirectory(row) ? '文件夹' : fileKind(row.name) }}</span>
        </template>
      </vxe-column>

      <vxe-column field="size" title="大小" width="100" sortable>
        <template #default="{ row }">
          <span class="remote-cell__mono">{{ isDirectory(row) ? '-' : formatSize(row.size) }}</span>
        </template>
      </vxe-column>

      <vxe-column field="modified" title="修改时间" width="160" sortable>
        <template #default="{ row }">
          <span class="remote-cell__mono">{{ formatTime(row.modified) }}</span>
        </template>
      </vxe-column>

      <vxe-column field="permissions" title="权限" width="100" sortable>
        <template #default="{ row }">
          <span class="remote-cell__mono">{{ row.permissions || '-' }}</span>
        </template>
      </vxe-column>

      <vxe-column field="ownerUser" title="所有者" width="80">
        <template #default="{ row }">
          <span class="remote-cell__mono">{{ row.ownerUser || row.owner_user || '-' }}</span>
        </template>
      </vxe-column>
    </vxe-table>

    <div v-if="selBox.dragging" class="remote-selection-box" :style="selBoxStyle" />

    <div v-if="isDragOver && !isDragging" class="remote-file-table__drop-mask">
      <CloudUploadOutlined class="remote-file-table__drop-icon" />
      <span>释放后上传到当前目录</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { VxeColumn, VxeTable } from 'vxe-table'
import 'vxe-table/lib/style.css'
import {
  CloudUploadOutlined,
} from '@antdv-next/icons'
import {
  FileArchiveIcon,
  FileAudioIcon,
  FileImageIcon,
  FilePageIcon,
  FileTextIcon,
  FileVideoIcon,
  FolderTreeIcon,
} from './RemoteFileIcons'
import type { SftpFileEntry, WorkspaceDensity } from '../../types/app'

const props = defineProps<{
  files: SftpFileEntry[]
  loading: boolean
  selectedPaths: string[]
  primarySelectedPath: string
  currentPath: string
  density: WorkspaceDensity
  searchText: string
  internalDragActive: boolean
  internalDragTargetPath: string
  renameView: '' | 'table' | 'tree'
  renamePath: string
  renameValue: string
}>()

const emit = defineEmits<{
  navigate: [path: string]
  select: [paths: string[], primaryPath: string]
  openFile: [entry: SftpFileEntry]
  contextMenu: [event: MouseEvent, entry: SftpFileEntry | null, entries: SftpFileEntry[], sourceView: 'table']
  sort: [key: string, order: string]
  dragMove: [entries: SftpFileEntry[], targetPath: string]
  externalDrop: [files: FileList, targetPath: string]
  internalDragChange: [state: { active: boolean; sourcePaths: string[]; targetPath: string }]
  renameValueChange: [value: string]
  renameSubmit: [path: string, value: string]
  renameCancel: []
}>()

const tableRef = ref<any>(null)
const tableWrapRef = ref<HTMLElement | null>(null)
const renameInputRef = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)
const isFocused = ref(false)

const selectedPathSet = computed(() => new Set(props.selectedPaths))
const orderedVisiblePaths = computed(() => props.files.map(getFilePath))

// ===================== Helpers =====================

function isDirectory(row: SftpFileEntry) {
  return Boolean(row.is_dir ?? row.is_directory)
}

function fileKind(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  return ext ? ext.toUpperCase() : '文件'
}

function formatSize(bytes?: number) {
  if (!bytes || bytes === 0) return '-'
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1)
  return `${Math.round((bytes / 1024 ** i) * 100) / 100} ${sizes[i]}`
}

function formatTime(ts?: number) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString()
}

function getFileIcon(file: SftpFileEntry) {
  if (isDirectory(file)) return FolderTreeIcon
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext) return FilePageIcon
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) return FileImageIcon
  if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv'].includes(ext)) return FileVideoIcon
  if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) return FileAudioIcon
  if (['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'vue'].includes(ext)) return FileTextIcon
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return FileArchiveIcon
  return FilePageIcon
}

function getFilePath(row: SftpFileEntry): string {
  return row.path || row.name
}

function normalizeDirPrefix(path: string) {
  return path.endsWith('/') ? path : `${path}/`
}

function findRowEntry(el: HTMLElement): SftpFileEntry | null {
  const rowEl = el.closest('.vxe-body--row') as HTMLElement
  if (!rowEl || !tableRef.value) return null
  const node = tableRef.value.getRowNode?.(rowEl)
  return (node?.item as SftpFileEntry) || null
}

function getHitElementFromPoint(clientX: number, clientY: number) {
  const pointEl = document.elementFromPoint(clientX, clientY) as HTMLElement | null
  if (pointEl && tableWrapRef.value?.contains(pointEl)) return pointEl
  return null
}

function findRowEntryFromPoint(clientX: number, clientY: number) {
  const hitEl = getHitElementFromPoint(clientX, clientY)
  if (!hitEl) return null
  return findRowEntry(hitEl)
}

function rowClassName(params: any) {
  const row = params.row as SftpFileEntry
  const path = getFilePath(row)
  const classes: string[] = []
  if (selectedPathSet.value.has(path)) classes.push('is-selected')
  if (dropTargetPath.value === path) classes.push('is-drop-target')
  return classes.join(' ')
}

function focusTable() {
  tableWrapRef.value?.focus({ preventScroll: true })
}

function bindRenameInputRef(el: Element | null) {
  renameInputRef.value = el as HTMLInputElement | null
}

function getRangeAnchorPath(currentPath: string) {
  if (props.primarySelectedPath && orderedVisiblePaths.value.includes(props.primarySelectedPath)) {
    return props.primarySelectedPath
  }
  return props.selectedPaths.find(path => orderedVisiblePaths.value.includes(path)) || currentPath
}

function isRenameActive(row: SftpFileEntry) {
  return props.renameView === 'table' && props.renamePath === getFilePath(row)
}

function focusRenameInput() {
  nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

function handleRenameInput(event: Event) {
  emit('renameValueChange', (event.target as HTMLInputElement).value)
}

function handleRenameKeyDown(event: KeyboardEvent) {
  const input = event.target as HTMLInputElement
  if (event.key === 'Enter') {
    event.preventDefault()
    input.dataset.renameAction = 'submit'
    input.blur()
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    input.dataset.renameAction = 'cancel'
    input.blur()
  }
}

function handleRenameBlur(event: FocusEvent) {
  const input = event.target as HTMLInputElement
  const action = input.dataset.renameAction || 'submit'
  delete input.dataset.renameAction
  if (action === 'cancel') {
    emit('renameCancel')
    return
  }
  emit('renameSubmit', props.renamePath, input.value)
}

// ===================== Cell Events =====================

function handleCellClick(params: any) {
  focusTable()
  const row = params.row as SftpFileEntry
  const event = (params.$event || params.event) as MouseEvent
  const path = getFilePath(row)

  if (event.shiftKey) {
    const anchorPath = getRangeAnchorPath(path)
    const anchorIdx = orderedVisiblePaths.value.indexOf(anchorPath)
    const targetIdx = orderedVisiblePaths.value.indexOf(path)
    if (anchorIdx >= 0 && targetIdx >= 0) {
      const [s, e] = anchorIdx < targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx]
      emit('select', orderedVisiblePaths.value.slice(s, e + 1), path)
      return
    }
  }

  if (event.metaKey || event.ctrlKey) {
    const newPaths = selectedPathSet.value.has(path)
      ? props.selectedPaths.filter(p => p !== path)
      : [...props.selectedPaths, path]
    emit('select', newPaths, path)
    return
  }

  emit('select', [path], path)
}

function handleCellDblClick(params: any) {
  const row = params.row as SftpFileEntry
  if (isDirectory(row)) {
    emit('navigate', getFilePath(row))
  } else {
    emit('openFile', row)
  }
}

function handleCellContext(params: any) {
  const row = params.row as SftpFileEntry
  const $event = (params.$event || params.event) as MouseEvent
  $event.preventDefault()
  $event.stopPropagation()
  emitRowContextMenu($event, row)
}

function handleSurfaceContext(event: MouseEvent) {
  const target = event.target as HTMLElement
  const row = findRowEntry(target)
  if (row) {
    emitRowContextMenu(event, row)
    return
  }
  emit('contextMenu', event, null, [], 'table')
}

function emitRowContextMenu(event: MouseEvent, row: SftpFileEntry) {
  const path = getFilePath(row)
  if (!selectedPathSet.value.has(path)) {
    emit('select', [path], path)
  }
  const entries = props.selectedPaths.length > 1
    ? props.files.filter(f => selectedPathSet.value.has(getFilePath(f)))
    : [row]
  emit('contextMenu', event, row, entries, 'table')
}

function handleSortChange(params: any) {
  const field = params.field || 'name'
  const order = params.order
  emit('sort', field, order === 'asc' ? 'ascend' : order === 'desc' ? 'descend' : 'ascend')
}

// ===================== Rubber-band / Box Selection =====================

const selBox = reactive({
  active: false,
  dragging: false,
  clearOnPointerUp: false,
  pointerId: null as number | null,
  startX: 0,
  startY: 0,
  curX: 0,
  curY: 0,
  basePaths: [] as string[],
})

const selBoxStyle = computed(() => {
  if (!selBox.dragging) return {}
  const left = Math.min(selBox.startX, selBox.curX)
  const top = Math.min(selBox.startY, selBox.curY)
  const w = Math.abs(selBox.curX - selBox.startX)
  const h = Math.abs(selBox.curY - selBox.startY)
  return { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` }
})

function handlePointerDown(event: PointerEvent) {
  if (event.button !== 0 || props.loading) return
  focusTable()
  const target = event.target as HTMLElement
  if (target.closest('input, button, .ant-btn, .vxe-checkbox--icon')) return
  // Don't start box-select from name cell (that's for draggable)
  if (target.closest('[data-internal-drag-handle="true"]')) return

  const hitRow = target.closest('.vxe-body--row')
  selBox.clearOnPointerUp = !hitRow && !event.metaKey && !event.ctrlKey && !event.shiftKey

  // Prevent text selection immediately
  event.preventDefault()
  window.getSelection()?.removeAllRanges()

  selBox.active = true
  selBox.dragging = false
  selBox.pointerId = event.pointerId
  selBox.startX = event.clientX
  selBox.startY = event.clientY
  selBox.curX = event.clientX
  selBox.curY = event.clientY
  selBox.basePaths = (event.metaKey || event.ctrlKey) ? [...props.selectedPaths] : []

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

function onPointerMove(event: PointerEvent) {
  if (!selBox.active || event.pointerId !== selBox.pointerId) return
  selBox.curX = event.clientX
  selBox.curY = event.clientY

  if (!selBox.dragging) {
    if (Math.hypot(selBox.curX - selBox.startX, selBox.curY - selBox.startY) < 5) return
    selBox.dragging = true
  }

  event.preventDefault()
  window.getSelection()?.removeAllRanges()

  const boxRect = {
    left: Math.min(selBox.startX, selBox.curX),
    top: Math.min(selBox.startY, selBox.curY),
    right: Math.max(selBox.startX, selBox.curX),
    bottom: Math.max(selBox.startY, selBox.curY),
  }

  const rowEls = Array.from(
    tableWrapRef.value?.querySelectorAll<HTMLElement>('.vxe-body--row') || []
  )
  const intersected: string[] = []
  for (const rowEl of rowEls) {
    const rect = rowEl.getBoundingClientRect()
    if (rect.bottom >= boxRect.top && rect.top <= boxRect.bottom &&
        rect.right >= boxRect.left && rect.left <= boxRect.right) {
      const entry = findRowEntry(rowEl)
      if (entry) intersected.push(getFilePath(entry))
    }
  }

  const merged = Array.from(new Set([...selBox.basePaths, ...intersected]))
  emit('select', merged, intersected[intersected.length - 1] || merged[merged.length - 1] || '')
}

function onPointerUp(event: PointerEvent) {
  if (event && selBox.pointerId !== null && event.pointerId !== selBox.pointerId) return
  const shouldClearSelection = selBox.clearOnPointerUp && !selBox.dragging
  selBox.active = false
  selBox.dragging = false
  selBox.clearOnPointerUp = false
  selBox.pointerId = null
  selBox.basePaths = []
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  if (shouldClearSelection) {
    emit('select', [], '')
  }
}

// ===================== Internal Drag (move files into folders) =====================

const dragSourcePaths = ref<string[]>([])
const dropTargetPath = ref('')
const isDragging = ref(false)
const internalDragPointer = reactive({
  active: false,
  pointerId: null as number | null,
  startX: 0,
  startY: 0,
})

function isValidDropTarget(targetPath: string) {
  if (!targetPath || dragSourcePaths.value.includes(targetPath)) return false
  return !dragSourcePaths.value.some(sourcePath => targetPath.startsWith(normalizeDirPrefix(sourcePath)))
}

function syncInternalDragChange(active: boolean, targetPath = '') {
  emit('internalDragChange', {
    active,
    sourcePaths: active ? [...dragSourcePaths.value] : [],
    targetPath,
  })
}

function setInternalDropTarget(row: SftpFileEntry) {
  if (!isDragging.value || !isDirectory(row)) return false
  const targetPath = getFilePath(row)
  if (!isValidDropTarget(targetPath)) {
    if (dropTargetPath.value) syncInternalDragChange(true, '')
    dropTargetPath.value = ''
    return false
  }
  if (dropTargetPath.value !== targetPath) {
    syncInternalDragChange(true, targetPath)
  }
  dropTargetPath.value = targetPath
  return true
}

function handleRowPointerDown(row: SftpFileEntry, event: PointerEvent) {
  if (event.button !== 0 || props.loading) return
  focusTable()
  if (isRenameActive(row)) return
  if (event.shiftKey || event.metaKey || event.ctrlKey) {
    event.preventDefault()
    window.getSelection()?.removeAllRanges()
    return
  }
  const path = getFilePath(row)
  if (!selectedPathSet.value.has(path)) {
    emit('select', [path], path)
  }
  dragSourcePaths.value = selectedPathSet.value.has(path) ? [...props.selectedPaths] : [path]
  internalDragPointer.active = true
  internalDragPointer.pointerId = event.pointerId
  internalDragPointer.startX = event.clientX
  internalDragPointer.startY = event.clientY
  syncInternalDragChange(false, '')
  window.addEventListener('pointermove', handleRowPointerMove)
  window.addEventListener('pointerup', handleRowPointerUp)
  window.addEventListener('pointercancel', handleRowPointerUp)
}

function handleInternalDragEnd() {
  syncInternalDragChange(false, '')
  internalDragPointer.active = false
  internalDragPointer.pointerId = null
  isDragging.value = false
  dragSourcePaths.value = []
  dropTargetPath.value = ''
  window.removeEventListener('pointermove', handleRowPointerMove)
  window.removeEventListener('pointerup', handleRowPointerUp)
  window.removeEventListener('pointercancel', handleRowPointerUp)
}

function handleRowPointerMove(event: PointerEvent) {
  if (!internalDragPointer.active || event.pointerId !== internalDragPointer.pointerId) return

  if (!isDragging.value) {
    if (Math.hypot(event.clientX - internalDragPointer.startX, event.clientY - internalDragPointer.startY) < 6) return
    isDragging.value = true
    syncInternalDragChange(true, '')
  }

  event.preventDefault()
  const row = findRowEntryFromPoint(event.clientX, event.clientY)
  if (row && isDirectory(row) && setInternalDropTarget(row)) {
    return
  }
  if (dropTargetPath.value) syncInternalDragChange(true, '')
  dropTargetPath.value = ''
}

function handleRowPointerUp(event: PointerEvent) {
  if (!internalDragPointer.active || event.pointerId !== internalDragPointer.pointerId) return
  const entries = props.files.filter(f => dragSourcePaths.value.includes(getFilePath(f)))
  const target = dropTargetPath.value || props.internalDragTargetPath
  const shouldMove = isDragging.value && Boolean(target) && entries.length > 0
  handleInternalDragEnd()
  if (shouldMove && target) emit('dragMove', entries, target)
}

function onNativeDragOver(event: DragEvent) {
  // External file upload
  if (hasFiles(event)) {
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    isDragOver.value = true
  }
}

function onNativeDragEnter(event: DragEvent) {
  if (!isDragging.value && hasFiles(event)) {
    isDragOver.value = true
  }
}

function onNativeDragLeave(event: DragEvent) {
  if (isDragging.value) return
  const related = event.relatedTarget as Node | null
  if (related && tableWrapRef.value?.contains(related)) return
  isDragOver.value = false
}

function onNativeDrop(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = false

  // External file upload
  if (event.dataTransfer?.files.length) {
    emit('externalDrop', event.dataTransfer.files, props.currentPath)
  }
}

function hasFiles(event: DragEvent) {
  return Array.from(event.dataTransfer?.types || []).includes('Files')
}

function handleKeyDown(event: KeyboardEvent) {
  if (!isFocused.value) return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, [contenteditable="true"], .ant-input, .ant-input-affix-wrapper')) {
    return
  }

  const isSelectAll = (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey
    && event.key.toLowerCase() === 'a'
  if (!isSelectAll) return

  event.preventDefault()
  const paths = orderedVisiblePaths.value
  emit('select', paths, props.primarySelectedPath && paths.includes(props.primarySelectedPath)
    ? props.primarySelectedPath
    : paths[0] || '')
}

watch(() => props.renamePath, (path) => {
  if (props.renameView === 'table' && path) {
    focusRenameInput()
  }
})

watch(() => props.renameView, (view) => {
  if (view === 'table' && props.renamePath) {
    focusRenameInput()
  }
})

// ===================== Lifecycle =====================

onMounted(() => {
  const el = tableWrapRef.value
  if (!el) return
  // Use native listeners to avoid Vue's .prevent swallowing events
  el.addEventListener('dragover', onNativeDragOver, true)
  el.addEventListener('dragenter', onNativeDragEnter, true)
  el.addEventListener('dragleave', onNativeDragLeave, true)
  el.addEventListener('drop', onNativeDrop, true)
  el.addEventListener('pointerdown', handlePointerDown as EventListener)
})

onBeforeUnmount(() => {
  const el = tableWrapRef.value
  if (el) {
    el.removeEventListener('dragover', onNativeDragOver, true)
    el.removeEventListener('dragenter', onNativeDragEnter, true)
    el.removeEventListener('dragleave', onNativeDragLeave, true)
    el.removeEventListener('drop', onNativeDrop, true)
    el.removeEventListener('pointerdown', handlePointerDown as EventListener)
  }
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  window.removeEventListener('pointermove', handleRowPointerMove)
  window.removeEventListener('pointerup', handleRowPointerUp)
  window.removeEventListener('pointercancel', handleRowPointerUp)
})
</script>

<style scoped>
.remote-file-table {
  flex: 1;
  min-width: 0;
  position: relative;
  overflow: hidden;
  background: var(--remote-table-bg);
}

.remote-file-table.is-box-selecting {
  user-select: none;
  -webkit-user-select: none;
}

.remote-file-table :deep(.vxe-table) {
  font-size: 12px;
  font-family: var(--remote-file-font-family, inherit);
  color: var(--remote-table-text);
  background: transparent;
}

.remote-file-table :deep(.vxe-header--column) {
  font-size: 11px;
  font-weight: 600;
  color: var(--remote-table-header-text);
  background: var(--remote-table-header-bg);
}

.remote-file-table :deep(.vxe-table--main-wrapper),
.remote-file-table :deep(.vxe-table--header-wrapper),
.remote-file-table :deep(.vxe-table--body-wrapper),
.remote-file-table :deep(.vxe-table--header-inner-wrapper),
.remote-file-table :deep(.vxe-table--body-inner-wrapper),
.remote-file-table :deep(.vxe-table--border-line),
.remote-file-table :deep(.vxe-table--scroll-y-top-corner),
.remote-file-table :deep(.vxe-table--scroll-y-bottom-corner) {
  background: transparent !important;
}

.remote-file-table :deep(.vxe-table--render-default) {
  --vxe-ui-table-border-color: var(--remote-table-row-border);
  --vxe-ui-table-header-background-color: transparent;
  --vxe-ui-table-row-hover-background-color: transparent;
  --vxe-ui-table-row-current-background-color: transparent;
  --vxe-ui-table-row-hover-current-background-color: transparent;
  --vxe-ui-table-column-current-background-color: transparent;
  --vxe-ui-table-column-hover-current-background-color: transparent;
}

.remote-file-table :deep(.vxe-body--column) {
  background: var(--remote-table-row-bg);
  border-color: var(--remote-table-row-border);
  transition: background-color 0.16s ease;
}

.remote-file-table :deep(.vxe-body--row.row--hover > .vxe-body--column) {
  background: var(--remote-table-row-hover);
}

.remote-file-table :deep(.vxe-body--row.is-selected > .vxe-body--column) {
  background: var(--remote-table-row-selected) !important;
}

.remote-file-table :deep(.vxe-body--row.is-selected.row--hover > .vxe-body--column),
.remote-file-table :deep(.vxe-body--row.is-selected:hover > .vxe-body--column) {
  background: var(--remote-table-row-selected-hover) !important;
}

.remote-file-table :deep(.vxe-body--row.is-selected.row--current > .vxe-body--column),
.remote-file-table :deep(.vxe-body--row.is-selected.row--hover.row--current > .vxe-body--column) {
  background: var(--remote-table-row-selected-current) !important;
}

.remote-file-table :deep(.vxe-body--row.is-drop-target) {
  outline: 2px solid var(--remote-drop-outline);
  outline-offset: -2px;
  border-radius: 4px;
  background: var(--remote-drop-bg);
}

.remote-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: default;
  padding: 2px 4px;
  border-radius: 4px;
}

.remote-name-cell.is-drop-target {
  background: var(--remote-drop-bg);
}

.remote-name-cell__icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.remote-name-cell__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remote-name-cell__input {
  min-width: 0;
  flex: 1;
  height: 24px;
  padding: 0 6px;
  border: 1px solid var(--primary-color, #1677ff);
  border-radius: 6px;
  background: var(--remote-name-input-bg);
  color: var(--remote-name-input-text);
  font: inherit;
  outline: none;
}

.remote-name-cell__symlink {
  font-size: 10px;
  color: var(--warning-color, #faad14);
  margin-left: 2px;
}

.remote-cell__tag {
  font-size: 11px;
  color: var(--remote-meta-text);
}

.remote-cell__mono {
  font-family: var(--remote-file-font-family, var(--font-mono, 'Menlo', monospace));
  font-size: 11px;
  color: var(--remote-mono-text);
}

.remote-selection-box {
  position: fixed;
  border: 1px solid var(--primary-color, #1677ff);
  background: rgba(22, 119, 255, 0.08);
  pointer-events: none;
  z-index: 20;
  border-radius: 2px;
}

.remote-file-table__drop-mask {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--remote-drop-mask-bg);
  border: 2px dashed var(--remote-drop-mask-border);
  border-radius: 8px;
  z-index: 10;
  pointer-events: none;
}

.remote-file-table__drop-icon {
  font-size: 32px;
  color: var(--remote-drop-mask-icon);
}
</style>
