<template>
  <aside
    class="remote-tree"
    @pointermove="handleSurfacePointerMove"
    @pointerleave="handleSurfacePointerLeave"
    @contextmenu.prevent="handleSurfaceContextMenu"
  >
    <a-tree
      v-if="treeData.length"
      block-node
      :tree-data="treeData"
      :expanded-keys="expandedKeys"
      :selected-keys="[currentPath]"
      :show-line="{ showLeafIcon: false }"
      @select="handleSelect"
      @expand="handleExpand"
    >
      <template #switcherIcon="{ expanded, isLeaf }">
        <RightOutlined
          v-if="!isLeaf"
          class="remote-tree__switcher"
          :class="{ 'is-open': expanded }"
        />
      </template>
      <template #titleRender="{ path, title }">
        <span
          class="remote-tree__title"
          :class="{
            'is-current': path === currentPath,
            'is-drop-target': path === internalDragTargetPath,
          }"
          :data-tree-path="String(path)"
          :data-tree-title="String(title)"
          @pointerdown="handleNodePointerDown(String(path), String(title), $event)"
          @contextmenu.prevent.stop="handleNodeContextMenu(String(path), String(title), $event)"
        >
          <FolderTreeIcon class="remote-tree__icon" />
          <input
            v-if="isRenameActive(String(path))"
            :ref="bindRenameInputRef"
            class="remote-tree__input"
            :value="renameValue"
            spellcheck="false"
            @pointerdown.stop
            @click.stop
            @input="handleRenameInput"
            @keydown="handleRenameKeyDown"
            @blur="handleRenameBlur"
          />
          <span v-else class="remote-tree__name">{{ title }}</span>
        </span>
      </template>
    </a-tree>
    <div v-else class="remote-tree__empty">无目录</div>
  </aside>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { RightOutlined } from '@antdv-next/icons'
import { invoke } from '@tauri-apps/api/core'
import type { TreeDataNode, TreeEmits } from 'antdv-next'
import type { SftpFileEntry } from '../../types/app'
import { FolderTreeIcon } from './RemoteFileIcons'

const props = defineProps<{
  connectionId: string | null | undefined
  currentPath: string
  showHidden: boolean
  internalDragActive: boolean
  internalDragTargetPath: string
  internalDragSourcePaths: string[]
  renameView: '' | 'table' | 'tree'
  renamePath: string
  renameValue: string
}>()

const emit = defineEmits<{
  select: [path: string]
  internalDragTargetChange: [path: string]
  internalDragChange: [state: { active: boolean; sourcePaths: string[]; targetPath: string }]
  dragMove: [entries: SftpFileEntry[], targetPath: string]
  contextMenu: [event: MouseEvent, entry: SftpFileEntry | null, entries: SftpFileEntry[], sourceView: 'tree']
  renameValueChange: [value: string]
  renameSubmit: [path: string, value: string]
  renameCancel: []
}>()

const expandedKeys = ref<string[]>(['/'])
const dirCache = ref<Record<string, string[]>>({})
const renameInputRef = ref<HTMLInputElement | null>(null)
const treeDrag = reactive({
  active: false,
  dragging: false,
  pointerId: null as number | null,
  startX: 0,
  startY: 0,
  sourcePath: '',
  sourceTitle: '',
})

function buildExpandedKeys(path: string) {
  const keys = ['/']
  if (path === '/') return keys
  const parts = path.split('/').filter(Boolean)
  let current = ''
  parts.forEach((part) => {
    current += `/${part}`
    keys.push(current)
  })
  return keys
}

function buildChildren(parentPath: string): TreeDataNode[] {
  const childNames = dirCache.value[parentPath] || []
  const filtered = props.showHidden ? childNames : childNames.filter(n => !n.startsWith('.'))

  return filtered.map((name) => {
    const childPath = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`
    const hasChildren = childPath in dirCache.value
    const node: TreeDataNode & { path: string } = {
      key: childPath,
      title: name,
      path: childPath,
      isLeaf: hasChildren ? (dirCache.value[childPath]?.length === 0) : false,
    }
    if (hasChildren && expandedKeys.value.includes(childPath)) {
      node.children = buildChildren(childPath)
    }
    return node
  })
}

const treeData = ref<TreeDataNode[]>([])

function normalizeDirPrefix(path: string) {
  return path.endsWith('/') ? path : `${path}/`
}

function isValidDropTarget(path: string) {
  if (!props.internalDragActive || !path) return false
  if (props.internalDragSourcePaths.includes(path)) return false
  return !props.internalDragSourcePaths.some(sourcePath => path.startsWith(normalizeDirPrefix(sourcePath)))
}

function updateInternalDragTarget(path: string) {
  if (!props.internalDragActive) return
  const nextPath = isValidDropTarget(path) ? path : ''
  if (nextPath !== props.internalDragTargetPath) {
    emit('internalDragTargetChange', nextPath)
  }
}

function buildDirectoryEntry(path: string, title?: string): SftpFileEntry {
  const fallbackName = path === '/' ? '/' : path.split('/').filter(Boolean).pop() || path
  return {
    name: title || fallbackName,
    path,
    is_dir: true,
    is_directory: true,
  } as SftpFileEntry
}

function bindRenameInputRef(el: Element | null) {
  renameInputRef.value = el as HTMLInputElement | null
}

function isRenameActive(path: string) {
  return props.renameView === 'tree' && props.renamePath === path
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

function syncInternalDragChange(active: boolean, targetPath = '') {
  emit('internalDragChange', {
    active,
    sourcePaths: active && treeDrag.sourcePath ? [treeDrag.sourcePath] : [],
    targetPath,
  })
}

function finishTreeDrag() {
  syncInternalDragChange(false, '')
  treeDrag.active = false
  treeDrag.dragging = false
  treeDrag.pointerId = null
  treeDrag.sourcePath = ''
  treeDrag.sourceTitle = ''
  window.removeEventListener('pointermove', handleTreePointerMove)
  window.removeEventListener('pointerup', handleTreePointerUp)
  window.removeEventListener('pointercancel', handleTreePointerUp)
}

function rebuildTree() {
  treeData.value = [{
    key: '/',
    title: '/',
    path: '/',
    isLeaf: false,
    children: buildChildren('/'),
  } as TreeDataNode & { path: string }]
}

async function loadDirChildren(path: string) {
  if (!props.connectionId || path in dirCache.value) return
  try {
    const entries = await invoke<SftpFileEntry[]>('list_sftp_files', {
      connectionId: props.connectionId,
      path,
    })
    dirCache.value[path] = entries
      .filter(e => e.is_dir || e.is_directory)
      .map(e => e.name)
    rebuildTree()
  } catch {
    // ignore
  }
}

async function ensureAncestors(path: string) {
  const parts = path.split('/').filter(Boolean)
  let current = '/'
  for (const part of parts) {
    await loadDirChildren(current)
    current = current === '/' ? `/${part}` : `${current}/${part}`
  }
  await loadDirChildren(current)
}

const handleSelect: TreeEmits['select'] = async (_keys, info) => {
  const path = String((info.node as any).path || _keys[0] || '')
  if (!path) return

  const isExpanded = expandedKeys.value.includes(path)
  if (path === props.currentPath && path !== '/') {
    if (isExpanded) {
      expandedKeys.value = expandedKeys.value.filter(key => key !== path)
    } else {
      expandedKeys.value = Array.from(new Set([...expandedKeys.value, path, '/']))
      await loadDirChildren(path)
    }
    return
  }

  if (!isExpanded) {
    expandedKeys.value = Array.from(new Set([...expandedKeys.value, path, '/']))
    await loadDirChildren(path)
  }
  emit('select', path)
}

const handleExpand: TreeEmits['expand'] = async (keys) => {
  expandedKeys.value = Array.from(new Set([...keys.map(String), '/']))
  const newKeys = keys.map(String).filter(k => !(k in dirCache.value))
  await Promise.all(newKeys.map(loadDirChildren))
}

function handleSurfacePointerMove(event: PointerEvent) {
  if (!props.internalDragActive) return
  const target = (event.target as HTMLElement | null)?.closest?.('[data-tree-path]') as HTMLElement | null
  updateInternalDragTarget(target?.dataset.treePath || '')
}

function handleSurfacePointerLeave() {
  if (!props.internalDragActive) return
  if (props.internalDragTargetPath) {
    emit('internalDragTargetChange', '')
  }
}

function handleNodePointerDown(path: string, title: string, event: PointerEvent) {
  if (isRenameActive(path)) return
  if (event.button !== 0 || props.internalDragActive) return
  treeDrag.active = true
  treeDrag.dragging = false
  treeDrag.pointerId = event.pointerId
  treeDrag.startX = event.clientX
  treeDrag.startY = event.clientY
  treeDrag.sourcePath = path
  treeDrag.sourceTitle = title
  window.addEventListener('pointermove', handleTreePointerMove)
  window.addEventListener('pointerup', handleTreePointerUp)
  window.addEventListener('pointercancel', handleTreePointerUp)
}

function handleTreePointerMove(event: PointerEvent) {
  if (!treeDrag.active || event.pointerId !== treeDrag.pointerId) return
  if (!treeDrag.dragging) {
    if (Math.hypot(event.clientX - treeDrag.startX, event.clientY - treeDrag.startY) < 6) return
    treeDrag.dragging = true
    syncInternalDragChange(true, '')
  }

  event.preventDefault()
  const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null
  const path = target?.closest?.('[data-tree-path]')?.getAttribute('data-tree-path') || ''
  updateInternalDragTarget(path)
}

function handleTreePointerUp(event: PointerEvent) {
  if (!treeDrag.active || event.pointerId !== treeDrag.pointerId) return
  const targetPath = props.internalDragTargetPath
  const shouldMove = treeDrag.dragging && Boolean(targetPath) && targetPath !== treeDrag.sourcePath
  const entry = buildDirectoryEntry(treeDrag.sourcePath, treeDrag.sourceTitle)
  finishTreeDrag()
  if (shouldMove && targetPath) {
    emit('dragMove', [entry], targetPath)
  }
}

function handleNodeContextMenu(path: string, title: string, event: MouseEvent) {
  emit('contextMenu', event, buildDirectoryEntry(path, title), [buildDirectoryEntry(path, title)], 'tree')
}

function handleSurfaceContextMenu(event: MouseEvent) {
  const target = (event.target as HTMLElement | null)?.closest?.('[data-tree-path]')
  if (target) return
  emit('contextMenu', event, null, [], 'tree')
}

watch(() => props.currentPath, async (newPath) => {
  expandedKeys.value = buildExpandedKeys(newPath)
  await ensureAncestors(newPath)
}, { immediate: true })

watch(() => props.connectionId, async (id) => {
  if (id) {
    dirCache.value = {}
    expandedKeys.value = ['/']
    await loadDirChildren('/')
  }
}, { immediate: true })

watch(() => props.showHidden, () => rebuildTree())

watch(() => props.renamePath, (path) => {
  if (props.renameView === 'tree' && path) {
    focusRenameInput()
  }
})

watch(() => props.renameView, (view) => {
  if (view === 'tree' && props.renamePath) {
    focusRenameInput()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', handleTreePointerMove)
  window.removeEventListener('pointerup', handleTreePointerUp)
  window.removeEventListener('pointercancel', handleTreePointerUp)
})
</script>

<style scoped>
.remote-tree {
  width: 200px;
  min-width: 160px;
  max-width: 280px;
  border-right: 1px solid var(--remote-tree-border);
  font-family: var(--remote-file-font-family, inherit);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 6px 6px 6px 8px;
  background: var(--remote-tree-bg);
  box-shadow: var(--remote-tree-shadow);
}

.remote-tree__switcher {
  font-size: 10px;
  color: var(--remote-tree-switcher-color);
  transition: transform 0.2s;
}

.remote-tree__switcher.is-open {
  transform: rotate(90deg);
}

.remote-tree__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--remote-tree-text);
  padding: 2px 6px;
  border-radius: 6px;
  transition: background-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
}

.remote-tree__title.is-current {
  background: var(--remote-tree-current-bg);
  color: var(--remote-tree-current-text);
  font-weight: 600;
  box-shadow: var(--remote-tree-current-shadow);
}

.remote-tree__title.is-drop-target {
  background: var(--remote-tree-drop-bg);
  box-shadow: var(--remote-tree-drop-shadow);
}

.remote-tree__icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.remote-tree__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remote-tree__input {
  min-width: 0;
  flex: 1;
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--primary-color, #1677ff);
  border-radius: 6px;
  background: var(--remote-name-input-bg);
  color: var(--remote-name-input-text);
  font: inherit;
  outline: none;
}

.remote-tree__empty {
  padding: 16px;
  text-align: center;
  color: var(--remote-tree-empty-text);
  font-size: 12px;
}

.remote-tree :deep(.ant-tree) {
  background: transparent;
  color: inherit;
}

.remote-tree :deep(.ant-tree-node-content-wrapper) {
  min-height: 24px;
  margin: 1px 0;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  width: calc(100% - 2px);
  transition: background-color 0.16s ease;
}

.remote-tree :deep(.ant-tree-node-content-wrapper:hover) {
  background: var(--remote-tree-hover-bg);
}

.remote-tree :deep(.ant-tree-node-selected) {
  background: transparent !important;
}
</style>
