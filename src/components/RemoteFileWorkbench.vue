<template>
  <div class="remote-workbench" :class="`remote-workbench--${density}`">
    <div class="remote-workbench__header">
      <div class="remote-workbench__heading">
        <span class="remote-workbench__eyebrow">Explorer</span>
        <div class="remote-workbench__title-row">
          <h3>文件</h3>
          <span class="remote-workbench__context">{{ title }}</span>
        </div>
      </div>

      <a-space-compact class="remote-workbench__quick-actions">
        <a-tooltip title="返回">
          <a-button size="small" @click="goBack" :disabled="!canGoBack">
            <ArrowLeftOutlined />
          </a-button>
        </a-tooltip>
        <a-tooltip title="上级目录">
          <a-button size="small" @click="goUp" :disabled="isAtRoot">
            <ArrowUpOutlined />
          </a-button>
        </a-tooltip>
        <a-tooltip title="刷新">
          <a-button size="small" @click="refreshCurrentPath">
            <ReloadOutlined />
          </a-button>
        </a-tooltip>
        <a-tooltip title="新建文件夹">
          <a-button size="small" @click="createFolder">
            <FolderAddOutlined />
          </a-button>
        </a-tooltip>
        <a-upload
          :show-upload-list="false"
          :before-upload="beforeUpload"
          multiple
        >
          <a-tooltip title="上传文件">
            <a-button size="small">
              <CloudUploadOutlined />
            </a-button>
          </a-tooltip>
        </a-upload>
      </a-space-compact>

      <div class="remote-workbench__filters">
        <a-input
          v-model:value="searchText"
          size="small"
          class="remote-toolbar__search"
          placeholder="筛选当前目录"
          allow-clear
        >
          <template #prefix>
            <SearchOutlined />
          </template>
        </a-input>

        <a-tooltip :title="showHiddenFiles ? '隐藏隐藏文件' : '显示隐藏文件'">
          <a-button
            type="text"
            size="small"
            class="remote-toolbar__toggle"
            :class="{ 'is-active': showHiddenFiles }"
            @click="toggleShowHidden"
          >
            <EyeOutlined v-if="showHiddenFiles" />
            <EyeInvisibleOutlined v-else />
          </a-button>
        </a-tooltip>
      </div>

      <div class="remote-workbench__meta-group">
        <a-tag class="remote-workbench__tag" bordered="false">{{ fileSummary }}</a-tag>
        <a-tag class="remote-workbench__tag" bordered="false">{{ filterSummary }}</a-tag>
        <a-tag
          v-if="selectedEntry"
          class="remote-workbench__tag remote-workbench__tag--active"
          bordered="false"
        >
          {{ isDirectory(selectedEntry) ? '目录已选中' : '文件已选中' }}
        </a-tag>
      </div>
    </div>

    <div v-if="connectionId" class="remote-workbench__body">
      <div class="remote-toolbar">
        <div class="remote-toolbar__path-row">
          <a-breadcrumb class="remote-toolbar__breadcrumb">
            <a-breadcrumb-item v-for="node in breadcrumbNodes" :key="node.path">
              <a-button
                type="text"
                size="small"
                class="remote-toolbar__crumb"
                :class="{ 'is-current': node.path === currentPath }"
                @click="loadFiles(node.path)"
            >
              {{ node.label }}
            </a-button>
          </a-breadcrumb-item>
        </a-breadcrumb>
      </div>
      </div>

      <div class="remote-selection">
        <template v-if="selectedEntry">
          <div class="remote-selection__main">
            <component :is="getFileIcon(selectedEntry)" class="remote-selection__icon" />
            <span class="remote-selection__name">{{ selectedEntry.name }}</span>
          </div>
          <div class="remote-selection__stats">
            <span>{{ isDirectory(selectedEntry) ? '文件夹' : fileKindLabel(selectedEntry.name) }}</span>
            <span>{{ isDirectory(selectedEntry) ? '-' : formatFileSize(selectedEntry.size) }}</span>
            <span>{{ formatModified(selectedEntry.modified) }}</span>
            <span>{{ selectedEntry.permissions || '-' }}</span>
          </div>
        </template>
        <span v-else class="remote-selection__hint">
          支持右键菜单、拖拽上传、双击进入目录或打开文本文件。
        </span>
      </div>

      <div class="remote-workbench__content">
        <aside class="remote-panel remote-tree">
          <div class="remote-panel__head">
            <div>
              <span class="remote-panel__eyebrow">Tree</span>
              <h4>目录</h4>
            </div>
            <span class="remote-panel__count">{{ treeNodeCount }}</span>
          </div>

          <div class="remote-tree__body">
            <a-tree
              v-if="treeData.length"
              block-node
              :virtual="false"
              :tree-data="treeData"
              :expanded-keys="expandedTreeKeys"
              :selected-keys="selectedTreeKeys"
              :show-line="{ showLeafIcon: false }"
              @select="handleTreeSelect"
              @expand="handleTreeExpand"
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
                  :class="{ 'is-current': path === currentPath }"
                  @contextmenu.prevent="openTreeContextMenu(String(path), String(title), $event)"
                >
                  <FolderOutlined class="remote-tree__icon" />
                  <span class="remote-tree__name">{{ title }}</span>
                </span>
              </template>
            </a-tree>

            <div v-else class="remote-tree__empty">当前目录没有可展开的层级</div>
          </div>
        </aside>

        <section
          ref="browserDropRef"
          class="remote-panel remote-browser"
          :class="{ 'is-drag-over': isDraggingOver }"
          @dragenter.prevent="handleDragEnter"
          @dragover.prevent="handleDragOver"
          @dragleave.prevent="handleDragLeave"
          @drop.prevent="handleDrop"
        >
          <div class="remote-panel__head remote-panel__head--table">
            <div>
              <span class="remote-panel__eyebrow">Listing</span>
              <h4>当前目录</h4>
            </div>
            <span class="remote-panel__count">{{ sortedFiles.length }}</span>
          </div>

          <div class="remote-browser__hint-bar">
            <span>双击进入目录或打开文本文件</span>
            <span>右键查看操作</span>
            <span>可直接拖拽文件到此区域上传</span>
          </div>

          <div class="remote-browser__table-shell" @contextmenu.prevent="openSurfaceContextMenu">
            <a-table
              class="remote-file-table"
              :columns="tableColumns"
              :data-source="sortedFiles"
              :pagination="false"
              :loading="loading"
              :row-key="getRowKey"
              :on-row="getRowProps"
              size="small"
              :scroll="{ x: 980, y: '100%' }"
              @change="handleTableChange"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'name'">
                  <div class="remote-name-cell">
                    <component :is="getFileIcon(record)" class="remote-name-cell__icon" />
                    <div class="remote-name-cell__copy">
                      <span class="remote-name-cell__label">{{ record.name }}</span>
                      <span class="remote-name-cell__path">{{ buildFilePath(record) }}</span>
                    </div>
                  </div>
                </template>

                <template v-else-if="column.key === 'kind'">
                  <a-tag
                    class="remote-kind-tag"
                    :bordered="false"
                    :class="{ 'is-directory': isDirectory(record) }"
                  >
                    {{ isDirectory(record) ? '文件夹' : fileKindLabel(record.name) }}
                  </a-tag>
                </template>

                <template v-else-if="column.key === 'size'">
                  <span class="remote-cell__mono">{{ isDirectory(record) ? '-' : formatFileSize(record.size) }}</span>
                </template>

                <template v-else-if="column.key === 'modified'">
                  <span class="remote-cell__mono">{{ formatModified(record.modified) }}</span>
                </template>

                <template v-else-if="column.key === 'permissions'">
                  <span class="remote-cell__mono">{{ record.permissions || '-' }}</span>
                </template>

                <template v-else-if="column.key === 'actions'">
                  <a-dropdown
                    :menu="getEntryMenuProps(record)"
                    :trigger="['click']"
                    placement="bottomRight"
                  >
                    <a-button
                      type="text"
                      size="small"
                      class="remote-row__menu"
                      @click.stop="selectedFileName = record.name"
                    >
                      <MoreOutlined />
                    </a-button>
                  </a-dropdown>
                </template>
              </template>

              <template #emptyText>
                <a-empty :description="searchText ? '没有匹配当前筛选的文件' : '当前目录为空'" />
              </template>
            </a-table>
          </div>

          <div v-if="isDraggingOver" class="remote-browser__drag-mask">
            <CloudUploadOutlined class="remote-browser__drag-icon" />
            <span>释放后上传到 {{ currentPath }}</span>
          </div>
        </section>
      </div>
    </div>

    <div v-else class="remote-workbench__empty">
      <a-empty description="等待 SSH 文件连接建立" />
    </div>

    <div
      v-if="contextMenu.open"
      class="remote-context-menu"
      :style="contextMenuStyle"
      @click.stop
      @contextmenu.prevent
    >
      <a-menu :items="contextMenu.items" @click="handleContextMenuClick" />
    </div>

    <input
      ref="uploadInputRef"
      type="file"
      multiple
      class="remote-upload-input"
      @change="handleContextUploadChange"
    />

    <a-modal
      v-model:open="permissionModal.open"
      title="修改文件权限"
      ok-text="确定"
      cancel-text="取消"
      :confirm-loading="permissionModal.loading"
      @ok="applyEntryPermissions"
      @cancel="closePermissionModal"
    >
      <div class="permission-modal">
        <div class="permission-modal__target">{{ permissionModal.name }}</div>
        <div class="permission-modal__path">{{ permissionModal.path }}</div>
        <div class="permission-modal__meta">
          <span>{{ permissionModal.isDirectory ? '目录' : '文件' }}</span>
          <span>当前模式：{{ permissionModeDisplay }}</span>
        </div>

        <div class="permission-table">
          <div class="permission-table__head" />
          <div class="permission-table__head">读取</div>
          <div class="permission-table__head">写入</div>
          <div class="permission-table__head">执行</div>

          <div class="permission-table__label">所有者</div>
          <a-checkbox v-model:checked="permissionModal.owner.read" />
          <a-checkbox v-model:checked="permissionModal.owner.write" />
          <a-checkbox v-model:checked="permissionModal.owner.execute" />

          <div class="permission-table__label">组</div>
          <a-checkbox v-model:checked="permissionModal.group.read" />
          <a-checkbox v-model:checked="permissionModal.group.write" />
          <a-checkbox v-model:checked="permissionModal.group.execute" />

          <div class="permission-table__label">其他</div>
          <a-checkbox v-model:checked="permissionModal.other.read" />
          <a-checkbox v-model:checked="permissionModal.other.write" />
          <a-checkbox v-model:checked="permissionModal.other.execute" />
        </div>

        <div v-if="permissionModal.isDirectory" class="permission-recursive">
          <a-checkbox v-model:checked="permissionModal.recursive">递归设置子目录</a-checkbox>
          <a-radio-group v-model:value="permissionModal.applyScope" :disabled="!permissionModal.recursive">
            <a-radio value="all">应用到文件和目录</a-radio>
            <a-radio value="files">只应用到文件</a-radio>
            <a-radio value="dirs">只应用到目录</a-radio>
          </a-radio-group>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  ArrowLeftOutlined,
  ArrowUpOutlined,
  CloudUploadOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FileImageOutlined,
  FileOutlined,
  FileTextOutlined,
  FileZipOutlined,
  FolderAddOutlined,
  FolderOutlined,
  MoreOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
  SoundOutlined,
  VideoCameraOutlined,
} from '@antdv-next/icons'
import { invoke } from '@tauri-apps/api/core'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import type { TreeDataNode, TreeEmits } from 'antdv-next'
import type { DownloadRequest, SftpFileEntry, UploadRequest, WorkspaceDensity } from '../types/app'

type SortKey = 'name' | 'size' | 'kind' | 'modified' | 'permissions'
type SortOrder = 'ascend' | 'descend'
type MenuScope = 'surface' | 'entry'
type PermissionApplyScope = 'all' | 'files' | 'dirs'

interface PermissionBits {
  read: boolean
  write: boolean
  execute: boolean
}

interface MenuItem {
  key: string
  label: string
  danger?: boolean
}

interface ContextMenuState {
  open: boolean
  scope: MenuScope
  x: number
  y: number
  items: MenuItem[]
  entry: SftpFileEntry | null
}

interface PermissionModalState {
  open: boolean
  loading: boolean
  path: string
  name: string
  isDirectory: boolean
  recursive: boolean
  applyScope: PermissionApplyScope
  owner: PermissionBits
  group: PermissionBits
  other: PermissionBits
}

const props = withDefaults(defineProps<{
  connectionId?: string | null
  title?: string
  active?: boolean
  syncPath?: string
  density?: WorkspaceDensity
}>(), {
  connectionId: '',
  title: '远程工作区',
  active: false,
  syncPath: '',
  density: 'compact',
})

const emit = defineEmits<{
  openFilePreview: [file: SftpFileEntry]
  startDownload: [download: DownloadRequest]
  startUpload: [upload: UploadRequest]
}>()

const currentPath = ref('/')
const files = ref<SftpFileEntry[]>([])
const loading = ref(false)
const browserDropRef = ref<HTMLElement | null>(null)
const showHiddenFiles = ref(false)
const history = ref<string[]>([])
const historyIndex = ref(-1)
const selectedFileName = ref('')
const expandedTreeKeys = ref<string[]>(['/'])
const directoryCache = ref<Record<string, SftpFileEntry[]>>({})
const sortKey = ref<SortKey>('name')
const sortOrder = ref<SortOrder>('ascend')
const searchText = ref('')
const isDraggingOver = ref(false)
const uploadInputRef = ref<HTMLInputElement | null>(null)
const pendingUploadTargetPath = ref('/')
const pendingRemoteArchiveDownloads = ref<Record<string, string>>({})
const permissionModal = reactive<PermissionModalState>({
  open: false,
  loading: false,
  path: '',
  name: '',
  isDirectory: false,
  recursive: false,
  applyScope: 'all',
  owner: { read: false, write: false, execute: false },
  group: { read: false, write: false, execute: false },
  other: { read: false, write: false, execute: false },
})
let loadRequestId = 0
let unlistenNativeDragDrop: UnlistenFn | null = null
let transferCompleteListener: ((event: Event) => void) | null = null
const contextMenu = ref<ContextMenuState>({
  open: false,
  scope: 'surface',
  x: 0,
  y: 0,
  items: [],
  entry: null,
})

const breadcrumbNodes = computed(() => {
  const parts = currentPath.value.split('/').filter(Boolean)
  const nodes = [{ label: '/', path: '/' }]
  let path = ''

  parts.forEach((part) => {
    path += `/${part}`
    nodes.push({ label: part, path })
  })

  return nodes
})

const visibleFiles = computed(() => filterVisibleEntries(files.value))
const directories = computed(() => visibleFiles.value.filter((file) => isDirectory(file)))
const canGoBack = computed(() => historyIndex.value > 0)
const isAtRoot = computed(() => currentPath.value === '/')
const selectedTreeKeys = computed(() => [currentPath.value])
const treeData = computed<TreeDataNode[]>(() => buildTreeData('/'))
const treeNodeCount = computed(() => countTreeNodes(treeData.value))
const selectedEntry = computed(() => visibleFiles.value.find((file) => file.name === selectedFileName.value) || null)
const fileSummary = computed(() => {
  const directoryCount = directories.value.length
  const fileCount = Math.max(visibleFiles.value.length - directoryCount, 0)
  return `${directoryCount} 目录 / ${fileCount} 文件`
})
const filteredEntries = computed(() => {
  const keyword = searchText.value.trim().toLowerCase()
  if (!keyword) return visibleFiles.value

  return visibleFiles.value.filter((file) => {
    const haystack = [
      file.name,
      buildFilePath(file),
      file.permissions,
      fileKindLabel(file.name),
    ].join(' ').toLowerCase()

    return haystack.includes(keyword)
  })
})
const filterSummary = computed(() => searchText.value.trim()
  ? `${filteredEntries.value.length} / ${visibleFiles.value.length} 项`
  : `${visibleFiles.value.length} 项`)

const sortedFiles = computed(() => {
  const entries = [...filteredEntries.value]
  const factor = sortOrder.value === 'ascend' ? 1 : -1

  return entries.sort((a, b) => {
    if (isDirectory(a) !== isDirectory(b)) {
      return isDirectory(a) ? -1 : 1
    }

    let result = 0
    switch (sortKey.value) {
      case 'name':
        result = a.name.localeCompare(b.name)
        break
      case 'size':
        result = (a.size || 0) - (b.size || 0)
        break
      case 'kind':
        result = fileKindLabel(a.name).localeCompare(fileKindLabel(b.name))
        break
      case 'modified':
        result = (a.modified || 0) - (b.modified || 0)
        break
      case 'permissions':
        result = (a.permissions || '').localeCompare(b.permissions || '')
        break
    }

    if (result === 0) {
      return a.name.localeCompare(b.name)
    }

    return result * factor
  })
})

const tableColumns = computed(() => [
  buildColumn('文件名', 'name', 340),
  buildColumn('类型', 'kind', 110),
  buildColumn('大小', 'size', 120),
  buildColumn('修改时间', 'modified', 180),
  buildColumn('权限', 'permissions', 130),
  {
    title: '操作',
    key: 'actions',
    width: 72,
    align: 'right' as const,
  },
])

const contextMenuStyle = computed(() => {
  const menuWidth = 196
  const menuHeight = contextMenu.value.items.length * 34 + 12
  const viewportWidth = window.innerWidth || 0
  const viewportHeight = window.innerHeight || 0
  const safeMargin = 8
  const maxLeft = Math.max(viewportWidth - menuWidth - safeMargin, safeMargin)
  const maxTop = Math.max(viewportHeight - menuHeight - safeMargin, safeMargin)

  return {
    left: `${Math.min(Math.max(contextMenu.value.x, safeMargin), maxLeft)}px`,
    top: `${Math.min(Math.max(contextMenu.value.y, safeMargin), maxTop)}px`,
  }
})

function normalizeRemotePath(path: string) {
  const trimmed = path.trim()
  if (!trimmed || trimmed === '/') return '/'

  const segments = trimmed.split('/').filter(Boolean)
  return `/${segments.join('/')}`
}

function buildExpandedKeys(path: string) {
  const normalizedPath = normalizeRemotePath(path)
  const keys = ['/']

  if (normalizedPath === '/') {
    return keys
  }

  const parts = normalizedPath.split('/').filter(Boolean)
  let current = ''

  parts.forEach((part) => {
    current += `/${part}`
    keys.push(current)
  })

  return keys
}

watch(
  () => [props.connectionId, props.active] as const,
  async ([connectionId, active], [previousConnectionId]) => {
    closeContextMenu()

    if (!connectionId) {
      resetWorkbench()
      return
    }

    if (connectionId !== previousConnectionId) {
      resetWorkbench()
    }

    if (active && files.value.length === 0) {
      expandedTreeKeys.value = buildExpandedKeys('/')
      await loadFiles(props.syncPath || '/')
    }
  },
  { immediate: true },
)

watch(
  () => props.syncPath,
  async (nextPath) => {
    if (!props.connectionId || !props.active || !nextPath || nextPath === currentPath.value) {
      return
    }

    await loadFiles(nextPath)
  },
)

watch(showHiddenFiles, () => {
  selectedFileName.value = ''
})

onMounted(() => {
  window.addEventListener('click', closeContextMenu)
  window.addEventListener('resize', closeContextMenu)
  window.addEventListener('scroll', closeContextMenu, true)
  window.addEventListener('keydown', handleWindowKeydown)
  window.addEventListener('dragenter', handleWindowDragEnter, true)
  window.addEventListener('dragover', handleWindowDragOver, true)
  window.addEventListener('dragleave', handleWindowDragLeave, true)
  window.addEventListener('drop', handleWindowDrop, true)
  setupNativeDragDrop().catch((error) => {
    console.error('注册原生文件拖拽监听失败:', error)
  })

  transferCompleteListener = (event: Event) => {
    const detail = (event as CustomEvent<{
      direction: string
      connectionId: string
      sourcePath?: string
      status: string
    }>).detail
    if (!detail || detail.connectionId !== props.connectionId) return

    if (detail.direction === 'upload' && detail.status === 'completed') {
      refreshCurrentPath()
      return
    }

    if (detail.direction === 'download' && detail.sourcePath) {
      const tempArchivePath = pendingRemoteArchiveDownloads.value[detail.sourcePath]
      if (!tempArchivePath) return

      delete pendingRemoteArchiveDownloads.value[detail.sourcePath]

      invoke('execute_ssh_command', {
        connectionId: props.connectionId,
        command: `rm -f -- ${quoteShellArg(tempArchivePath)}`,
      }).catch((error) => {
        console.error('清理远程临时压缩包失败:', error)
      })
    }
  }
  window.addEventListener('transfer-complete', transferCompleteListener)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', closeContextMenu)
  window.removeEventListener('resize', closeContextMenu)
  window.removeEventListener('scroll', closeContextMenu, true)
  window.removeEventListener('keydown', handleWindowKeydown)
  window.removeEventListener('dragenter', handleWindowDragEnter, true)
  window.removeEventListener('dragover', handleWindowDragOver, true)
  window.removeEventListener('dragleave', handleWindowDragLeave, true)
  window.removeEventListener('drop', handleWindowDrop, true)
  unlistenNativeDragDrop?.()
  unlistenNativeDragDrop = null
  if (transferCompleteListener) {
    window.removeEventListener('transfer-complete', transferCompleteListener)
    transferCompleteListener = null
  }
})

function buildColumn(title: string, key: SortKey, width: number) {
  return {
    title,
    dataIndex: key,
    key,
    width,
    sorter: true,
    ellipsis: true,
    sortOrder: sortKey.value === key ? sortOrder.value : null,
  }
}

function resetWorkbench() {
  files.value = []
  currentPath.value = '/'
  history.value = []
  historyIndex.value = -1
  selectedFileName.value = ''
  expandedTreeKeys.value = buildExpandedKeys('/')
  directoryCache.value = {}
  searchText.value = ''
  sortKey.value = 'name'
  sortOrder.value = 'ascend'
  closeContextMenu()
}

function isDirectory(file: SftpFileEntry) {
  return Boolean(file.is_dir ?? file.is_directory)
}

function buildFilePath(file: SftpFileEntry) {
  if (typeof file.path === 'string' && file.path) {
    return normalizeRemotePath(file.path)
  }

  return currentPath.value === '/' ? `/${file.name}` : `${currentPath.value}/${file.name}`
}

function getRowKey(file: SftpFileEntry) {
  return buildFilePath(file)
}

function getTreeNodeLabel(path: string) {
  if (path === '/') return '/'
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 1] || '/'
}

function getParentPath(path: string) {
  const normalizedPath = normalizeRemotePath(path)
  if (normalizedPath === '/') return '/'
  const parts = normalizedPath.split('/').filter(Boolean)
  parts.pop()
  return parts.length ? `/${parts.join('/')}` : '/'
}

function createDirectoryEntry(path: string, title?: string): SftpFileEntry {
  const normalizedPath = normalizeRemotePath(path)
  return {
    name: title || getTreeNodeLabel(normalizedPath),
    path: normalizedPath,
    size: 0,
    is_dir: true,
    permissions: '',
  }
}

function quoteShellArg(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`
}

function createPermissionBits(): PermissionBits {
  return {
    read: false,
    write: false,
    execute: false,
  }
}

function applyPermissionDigit(bits: PermissionBits, digit: number) {
  bits.read = (digit & 4) !== 0
  bits.write = (digit & 2) !== 0
  bits.execute = (digit & 1) !== 0
}

function parsePermissionMode(rawMode: string) {
  const match = rawMode.trim().match(/([0-7]{3,4})/g)
  const mode = match?.[match.length - 1]?.slice(-3)
  return mode && /^[0-7]{3}$/.test(mode) ? mode : null
}

const permissionModeDisplay = computed(() => {
  const owner = Number(permissionModal.owner.read) * 4
    + Number(permissionModal.owner.write) * 2
    + Number(permissionModal.owner.execute)
  const group = Number(permissionModal.group.read) * 4
    + Number(permissionModal.group.write) * 2
    + Number(permissionModal.group.execute)
  const other = Number(permissionModal.other.read) * 4
    + Number(permissionModal.other.write) * 2
    + Number(permissionModal.other.execute)

  return `${owner}${group}${other}`
})

function closePermissionModal() {
  if (permissionModal.loading) return
  permissionModal.open = false
}

async function fetchPermissionMode(path: string) {
  if (!props.connectionId) {
    throw new Error('连接不存在')
  }

  const output = await invoke<string>('execute_ssh_command', {
    connectionId: props.connectionId,
    command: `stat -c %a ${quoteShellArg(path)} 2>/dev/null || stat -f %Lp ${quoteShellArg(path)} 2>/dev/null`,
  })

  const mode = parsePermissionMode(output)
  if (!mode) {
    throw new Error(`无法解析权限模式: ${String(output).trim() || '空输出'}`)
  }

  return mode
}

function hydratePermissionModal(file: SftpFileEntry, path: string, mode: string) {
  const [owner, group, other] = mode.split('').map((digit) => Number(digit))
  permissionModal.path = path
  permissionModal.name = file.name
  permissionModal.isDirectory = isDirectory(file)
  permissionModal.recursive = false
  permissionModal.applyScope = 'all'
  permissionModal.loading = false
  applyPermissionDigit(permissionModal.owner, owner)
  applyPermissionDigit(permissionModal.group, group)
  applyPermissionDigit(permissionModal.other, other)
  permissionModal.open = true
}

function buildPermissionCommand() {
  const mode = permissionModeDisplay.value
  const path = quoteShellArg(permissionModal.path)

  if (!permissionModal.isDirectory || !permissionModal.recursive) {
    return `chmod ${mode} ${path}`
  }

  switch (permissionModal.applyScope) {
    case 'files':
      return `find ${path} -type f -exec chmod ${mode} {} +`
    case 'dirs':
      return `find ${path} -type d -exec chmod ${mode} {} +`
    default:
      return `chmod -R ${mode} ${path}`
  }
}

function getDirectoriesForPath(path: string) {
  return filterVisibleEntries(directoryCache.value[path] || [])
}

async function ensureDirectoryChildren(path: string) {
  if (!props.connectionId || path in directoryCache.value) return

  try {
    const entries = await invoke<SftpFileEntry[]>('list_sftp_files', {
      connectionId: props.connectionId,
      path,
    })

    directoryCache.value = {
      ...directoryCache.value,
      [path]: entries.filter((file) => isDirectory(file)),
    }
  } catch (error) {
    console.warn(`加载目录树子目录失败: ${path}`, error)
  }
}

function getAncestorPaths(path: string) {
  if (path === '/') return []

  const parts = path.split('/').filter(Boolean)
  const ancestors = ['/']
  let current = ''

  for (let index = 0; index < parts.length - 1; index += 1) {
    current += `/${parts[index]}`
    ancestors.push(current)
  }

  return ancestors
}

async function primeAncestorDirectories(path: string) {
  if (!props.connectionId) return

  const missingAncestors = getAncestorPaths(path).filter((ancestor) => !(ancestor in directoryCache.value))
  if (!missingAncestors.length) return

  const nextCache = { ...directoryCache.value }

  for (const ancestor of missingAncestors) {
    try {
      const entries = await invoke<SftpFileEntry[]>('list_sftp_files', {
        connectionId: props.connectionId,
        path: ancestor,
      })
      nextCache[ancestor] = entries.filter((file) => isDirectory(file))
    } catch (error) {
      console.warn(`预热祖先目录失败: ${ancestor}`, error)
    }
  }

  directoryCache.value = nextCache
}

function buildTreeChildren(parentPath: string): TreeDataNode[] {
  const childDirectories = getDirectoriesForPath(parentPath)

  return childDirectories.map((directory) => {
    const childPath = parentPath === '/' ? `/${directory.name}` : `${parentPath}/${directory.name}`
    const cachedDirectories = getDirectoriesForPath(childPath)
    const hasCachedDirectories = childPath in directoryCache.value
    const shouldRenderChildren = expandedTreeKeys.value.includes(childPath) && hasCachedDirectories

    const node: TreeDataNode = {
      key: childPath,
      title: directory.name,
      path: childPath,
      isLeaf: hasCachedDirectories ? cachedDirectories.length === 0 : false,
    } as TreeDataNode & { path: string }

    if (shouldRenderChildren) {
      node.children = buildTreeChildren(childPath)
    }

    return node
  })
}

function buildTreeData(path: string): TreeDataNode[] {
  return [{
    key: path,
    title: getTreeNodeLabel(path),
    path,
    isLeaf: false,
    children: buildTreeChildren(path),
  } as TreeDataNode & { path: string }]
}

function countTreeNodes(nodes: TreeDataNode[]) {
  return nodes.reduce((count, node) => {
    const childrenCount = Array.isArray(node.children) ? countTreeNodes(node.children) : 0
    return count + 1 + childrenCount
  }, 0)
}

function filterVisibleEntries(entries: SftpFileEntry[]) {
  return showHiddenFiles.value
    ? entries
    : entries.filter((file) => !file.name.startsWith('.'))
}

async function loadFiles(path: string, fromHistory = false) {
  if (!props.connectionId) return

  const normalizedPath = normalizeRemotePath(path)
  const requestId = ++loadRequestId
  loading.value = true
  closeContextMenu()
  try {
    const entries = await invoke<SftpFileEntry[]>('list_sftp_files', {
      connectionId: props.connectionId,
      path: normalizedPath,
    })

    if (requestId !== loadRequestId) {
      return
    }

    files.value = entries
    directoryCache.value = {
      ...directoryCache.value,
      [normalizedPath]: entries.filter((file) => isDirectory(file)),
    }
    await primeAncestorDirectories(normalizedPath)
    if (requestId !== loadRequestId) {
      return
    }
    currentPath.value = normalizedPath
    selectedFileName.value = ''

    if (!fromHistory) {
      history.value = history.value.slice(0, historyIndex.value + 1)
      history.value.push(normalizedPath)
      historyIndex.value = history.value.length - 1
    }

    expandedTreeKeys.value = buildExpandedKeys(normalizedPath)
  } catch (error) {
    if (requestId !== loadRequestId) {
      return
    }
    console.error('加载远程文件失败:', error)
    message.error(`加载远程文件失败: ${String(error)}`)
  } finally {
    if (requestId === loadRequestId) {
      loading.value = false
    }
  }
}

const handleTreeSelect: TreeEmits['select'] = (selectedKeys, info) => {
  const path = String(info.node.path || selectedKeys[0] || '')
  if (path) {
    loadFiles(path)
  }
}

const handleTreeExpand: TreeEmits['expand'] = async (keys) => {
  const nextKeys = new Set((keys as string[]).map(String))
  nextKeys.add('/')
  const previousKeys = new Set(expandedTreeKeys.value)
  expandedTreeKeys.value = Array.from(nextKeys)

  const addedKeys = Array.from(nextKeys).filter((key) => !previousKeys.has(key))
  await Promise.all(addedKeys.map((path) => ensureDirectoryChildren(path)))
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeContextMenu()
  }
}

function getFileNameFromLocalPath(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path
}

function createTransferBatchMeta(prefix: string, count: number) {
  if (count <= 1) {
    return { batchId: undefined, batchLabel: undefined }
  }

  const batchId = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return {
    batchId,
    batchLabel: `批量${prefix === 'upload' ? '上传' : '传输'} (${count}项)`,
  }
}

function normalizeNativeLocalPath(path: string) {
  let normalized = path.trim()
  if (!normalized) return normalized

  if (normalized.startsWith('file://')) {
    try {
      normalized = decodeURIComponent(new URL(normalized).pathname)
    } catch {
      normalized = normalized.replace(/^file:\/\//, '')
    }
  }

  if (/^\/[A-Za-z]:\//.test(normalized)) {
    normalized = normalized.slice(1)
  }

  return normalized
}

function toClientPosition(position: { x: number; y: number }) {
  const ratio = window.devicePixelRatio || 1
  return {
    x: position.x / ratio,
    y: position.y / ratio,
  }
}

function closeContextMenu() {
  if (!contextMenu.value.open) return
  contextMenu.value = {
    open: false,
    scope: 'surface',
    x: 0,
    y: 0,
    items: [],
    entry: null,
  }
}

function openSurfaceContextMenu(event: MouseEvent) {
  event.preventDefault()
  contextMenu.value = {
    open: true,
    scope: 'surface',
    x: event.clientX,
    y: event.clientY,
    items: getSurfaceMenuItems(),
    entry: null,
  }
}

function openEntryContextMenu(file: SftpFileEntry, event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  selectedFileName.value = file.name
  contextMenu.value = {
    open: true,
    scope: 'entry',
    x: event.clientX,
    y: event.clientY,
    items: getEntryMenuItems(file),
    entry: file,
  }
}

function openTreeContextMenu(path: string, title: string, event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  const entry = createDirectoryEntry(path, title)
  selectedFileName.value = entry.name
  contextMenu.value = {
    open: true,
    scope: 'entry',
    x: event.clientX,
    y: event.clientY,
    items: getEntryMenuItems(entry),
    entry,
  }
}

function goBack() {
  if (!canGoBack.value) return
  historyIndex.value -= 1
  loadFiles(history.value[historyIndex.value], true)
}

function goUp() {
  if (isAtRoot.value) return
  const parts = currentPath.value.split('/').filter(Boolean)
  parts.pop()
  const nextPath = parts.length ? `/${parts.join('/')}` : '/'
  loadFiles(nextPath)
}

function refreshCurrentPath() {
  loadFiles(currentPath.value, true)
}

function toggleShowHidden() {
  showHiddenFiles.value = !showHiddenFiles.value
  closeContextMenu()
}

function handleDragEnter() {
  if (!props.connectionId) return
  isDraggingOver.value = true
}

function handleDragOver(event: DragEvent) {
  if (!props.connectionId) return
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function handleDragLeave(event: DragEvent) {
  if (event.currentTarget === event.target) {
    isDraggingOver.value = false
  }
}

async function extractDroppedFiles(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return []

  const directFiles = Array.from(dataTransfer.files || [])
  if (directFiles.length > 0) {
    return directFiles
  }

  const items = Array.from(dataTransfer.items || [])
  const resolvedFiles = items
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file))

  return resolvedFiles
}

function hasFilePayload(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return false
  return Array.from(dataTransfer.types || []).includes('Files')
}

function isPointInsideBrowser(clientX: number, clientY: number) {
  const rect = browserDropRef.value?.getBoundingClientRect()
  if (!rect) return false

  return clientX >= rect.left
    && clientX <= rect.right
    && clientY >= rect.top
    && clientY <= rect.bottom
}

function handleWindowDragEnter(event: DragEvent) {
  if (!props.connectionId || !hasFilePayload(event.dataTransfer)) return
  if (isPointInsideBrowser(event.clientX, event.clientY)) {
    event.preventDefault()
    isDraggingOver.value = true
  }
}

function handleWindowDragOver(event: DragEvent) {
  if (!props.connectionId || !hasFilePayload(event.dataTransfer)) return

  if (isPointInsideBrowser(event.clientX, event.clientY)) {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy'
    }
    isDraggingOver.value = true
    return
  }

  isDraggingOver.value = false
}

function handleWindowDragLeave(event: DragEvent) {
  if (!props.connectionId || !hasFilePayload(event.dataTransfer)) return

  if (!isPointInsideBrowser(event.clientX, event.clientY)) {
    isDraggingOver.value = false
  }
}

async function handleDrop(event: DragEvent) {
  isDraggingOver.value = false
  closeContextMenu()
  if (!props.connectionId) return

  const droppedFiles = await extractDroppedFiles(event.dataTransfer)
  if (!droppedFiles.length) {
    message.warning('未检测到可上传的文件')
    return
  }

  await uploadFiles(droppedFiles)
}

async function handleWindowDrop(event: DragEvent) {
  if (!props.connectionId || !hasFilePayload(event.dataTransfer)) return
  if (!isPointInsideBrowser(event.clientX, event.clientY)) return

  event.preventDefault()
  event.stopPropagation()
  await handleDrop(event)
}

function isSortKey(value: string): value is SortKey {
  return ['name', 'size', 'kind', 'modified', 'permissions'].includes(value)
}

function handleTableChange(_: unknown, __: unknown, sorter: { columnKey?: unknown; order?: unknown } | Array<{ columnKey?: unknown; order?: unknown }>) {
  const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter
  const nextKey = String(activeSorter?.columnKey || '')
  const nextOrder = activeSorter?.order === 'descend' ? 'descend' : activeSorter?.order === 'ascend' ? 'ascend' : null

  if (!nextOrder || !isSortKey(nextKey)) {
    sortKey.value = 'name'
    sortOrder.value = 'ascend'
    return
  }

  sortKey.value = nextKey
  sortOrder.value = nextOrder
}

function fileKindLabel(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (!ext) return '文件'
  return ext.toUpperCase()
}

function isTextFile(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase()
  return [
    'txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'vue',
    'py', 'java', 'cpp', 'c', 'h', 'rs', 'go', 'php', 'rb', 'sh',
    'yml', 'yaml', 'ini', 'conf', 'log', 'sql', 'csv',
  ].includes(ext || '')
}

function getFileIcon(file: SftpFileEntry) {
  if (isDirectory(file)) return FolderOutlined

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext) return FileOutlined

  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) return FileImageOutlined
  if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv'].includes(ext)) return VideoCameraOutlined
  if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) return SoundOutlined
  if (['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'vue'].includes(ext)) return FileTextOutlined
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return FileZipOutlined

  return FileOutlined
}

function formatFileSize(bytes?: number) {
  if (!bytes || bytes === 0) return '-'
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1)
  return `${Math.round((bytes / Math.pow(1024, index)) * 100) / 100} ${sizes[index]}`
}

function formatModified(timestamp?: number) {
  if (!timestamp) return '-'
  return new Date(timestamp * 1000).toLocaleString()
}

function getRowProps(record: SftpFileEntry) {
  return {
    class: selectedFileName.value === record.name ? 'is-selected' : '',
    onClick: () => {
      selectedFileName.value = record.name
      closeContextMenu()
    },
    onDblclick: () => openEntry(record),
    onContextmenu: (event: MouseEvent) => openEntryContextMenu(record, event),
  }
}

function openEntry(file: SftpFileEntry) {
  selectedFileName.value = file.name
  if (isDirectory(file)) {
    loadFiles(buildFilePath(file))
    return
  }

  if (isTextFile(file.name)) {
    openFilePreview(file)
  }
}

function openFilePreview(file: SftpFileEntry) {
  emit('openFilePreview', {
    ...file,
    path: buildFilePath(file),
  })
}

async function downloadFile(file: SftpFileEntry) {
  if (!props.connectionId) return

  if (isDirectory(file)) {
    await downloadDirectory(file)
    return
  }

  try {
    const savePath = await invoke<string | null>('select_download_location', {
      fileName: file.name,
    })

    if (!savePath) return

    emit('startDownload', {
      fileName: file.name,
      remotePath: buildFilePath(file),
      savePath,
      connectionId: props.connectionId,
    })
  } catch (error) {
    console.error('下载文件失败:', error)
    message.error(`下载文件失败: ${String(error)}`)
  }
}

function buildPromptInput(model: { value: string }, placeholder: string) {
  return () => h(Input, {
    value: model.value,
    autofocus: true,
    placeholder,
    'onUpdate:value': (value: string) => {
      model.value = value
    },
  })
}

async function createFolder(parentPath = currentPath.value) {
  if (!props.connectionId) return
  const folderName = ref('')

  Modal.confirm({
    title: '新建文件夹',
    content: buildPromptInput(folderName, '请输入文件夹名称'),
    okText: '创建',
    cancelText: '取消',
    onOk: async () => {
      const nextName = folderName.value.trim()
      if (!nextName) return Promise.reject()

      try {
        const normalizedParentPath = normalizeRemotePath(parentPath)
        await invoke('create_sftp_directory', {
          connectionId: props.connectionId,
          path: normalizedParentPath === '/' ? `/${nextName}` : `${normalizedParentPath}/${nextName}`,
        })
        message.success('文件夹创建成功')
        if (currentPath.value === normalizedParentPath) {
          refreshCurrentPath()
        } else {
          await loadFiles(currentPath.value, true)
        }
      } catch (error) {
        console.error('创建文件夹失败:', error)
        message.error(`创建文件夹失败: ${String(error)}`)
        return Promise.reject()
      }
    },
  })
}

async function renameFile(file: SftpFileEntry) {
  if (!props.connectionId) return
  const oldPath = buildFilePath(file)
  const parentPath = getParentPath(oldPath)
  const nextName = ref(file.name)

  Modal.confirm({
    title: '重命名',
    content: buildPromptInput(nextName, '请输入新的名称'),
    okText: '重命名',
    cancelText: '取消',
    onOk: async () => {
      const targetName = nextName.value.trim()
      if (!targetName || targetName === file.name) return

      try {
        const newPath = parentPath === '/' ? `/${targetName}` : `${parentPath}/${targetName}`
        await invoke('rename_sftp_file', {
          connectionId: props.connectionId,
          oldPath,
          newPath,
        })
        message.success('重命名成功')
        if (currentPath.value === oldPath) {
          await loadFiles(newPath, true)
          return
        }

        if (currentPath.value.startsWith(`${oldPath}/`)) {
          const nextCurrentPath = `${newPath}${currentPath.value.slice(oldPath.length)}`
          await loadFiles(nextCurrentPath, true)
          return
        }

        refreshCurrentPath()
      } catch (error) {
        console.error('重命名失败:', error)
        message.error(`重命名失败: ${String(error)}`)
      }
    },
  })
}

async function deleteFile(file: SftpFileEntry) {
  if (!props.connectionId) return
  const path = buildFilePath(file)

  Modal.confirm({
    title: isDirectory(file) ? '确认删除目录' : '确认删除文件',
    content: `确定删除 "${file.name}" 吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        if (isDirectory(file)) {
          await invoke('delete_sftp_directory', {
            connectionId: props.connectionId,
            path,
          })
        } else {
          await invoke('delete_sftp_file', {
            connectionId: props.connectionId,
            path,
          })
        }
        message.success('删除成功')
        await refreshAfterEntryRemoval(path)
      } catch (error) {
        console.error('删除失败:', error)
        message.error(`删除失败: ${String(error)}`)
      }
    },
  })
}

async function quickDeleteWithRm(file: SftpFileEntry) {
  if (!props.connectionId) return
  const path = buildFilePath(file)

  Modal.confirm({
    title: '确认快速删除',
    content: `将通过 rm -rf 直接删除 "${path}"，是否继续？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await invoke('execute_ssh_command', {
          connectionId: props.connectionId,
          command: `rm -rf -- ${quoteShellArg(path)}`,
        })
        message.success('快速删除成功')
        await refreshAfterEntryRemoval(path)
      } catch (error) {
        console.error('快速删除失败:', error)
        message.error(`快速删除失败: ${String(error)}`)
      }
    },
  })
}

async function showEntryPermissions(file: SftpFileEntry) {
  if (!props.connectionId) return

  try {
    const path = buildFilePath(file)
    const mode = await fetchPermissionMode(path)
    hydratePermissionModal(file, path, mode)
  } catch (error) {
    console.error('获取权限信息失败:', error)
    message.error(`获取权限信息失败: ${String(error)}`)
  }
}

async function applyEntryPermissions() {
  if (!props.connectionId) return

  permissionModal.loading = true
  try {
    await invoke('execute_ssh_command', {
      connectionId: props.connectionId,
      command: buildPermissionCommand(),
    })
    permissionModal.open = false
    message.success('权限更新成功')
    refreshCurrentPath()
  } catch (error) {
    console.error('更新权限失败:', error)
    message.error(`更新权限失败: ${String(error)}`)
  } finally {
    permissionModal.loading = false
  }
}

async function downloadDirectory(file: SftpFileEntry) {
  if (!props.connectionId) return

  const remotePath = buildFilePath(file)
  const archiveName = `${file.name || 'directory'}.tar.gz`

  try {
    const savePath = await invoke<string | null>('select_download_location', {
      fileName: archiveName,
    })

    if (!savePath) return

    const tempRemoteArchivePath = `/tmp/termlink-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tar.gz`
    const parentPath = getParentPath(remotePath)
    const command = [
      `cd ${quoteShellArg(parentPath)}`,
      `tar -czf ${quoteShellArg(tempRemoteArchivePath)} ${quoteShellArg(file.name)}`,
    ].join(' && ')

    await invoke('execute_ssh_command', {
      connectionId: props.connectionId,
      command,
    })

    pendingRemoteArchiveDownloads.value = {
      ...pendingRemoteArchiveDownloads.value,
      [tempRemoteArchivePath]: tempRemoteArchivePath,
    }

    emit('startDownload', {
      fileName: archiveName,
      remotePath: tempRemoteArchivePath,
      savePath,
      connectionId: props.connectionId,
    })
  } catch (error) {
    console.error('下载目录失败:', error)
    message.error(`下载目录失败: ${String(error)}`)
  }
}

async function refreshAfterEntryRemoval(path: string) {
  const normalizedPath = normalizeRemotePath(path)
  if (currentPath.value === normalizedPath || currentPath.value.startsWith(`${normalizedPath}/`)) {
    await loadFiles(getParentPath(normalizedPath), true)
    return
  }

  refreshCurrentPath()
}

function copyText(text: string, successMessage: string) {
  navigator.clipboard.writeText(text).then(() => {
    message.success(successMessage)
  }).catch(() => {
    message.error('复制失败')
  })
}

function getSurfaceMenuItems(): MenuItem[] {
  return [
    { key: 'mkdir', label: '新建文件夹' },
    { key: 'refresh', label: '刷新当前目录' },
    { key: 'toggleHidden', label: showHiddenFiles.value ? '隐藏隐藏文件' : '显示隐藏文件' },
    { key: 'copyPath', label: '复制当前路径' },
  ]
}

function getEntryMenuItems(file: SftpFileEntry): MenuItem[] {
  const path = buildFilePath(file)
  const isRootDirectory = isDirectory(file) && path === '/'
  const items: MenuItem[] = []

  if (isDirectory(file)) {
    items.push(
      { key: 'open', label: '打开' },
      { key: 'refresh', label: '刷新' },
      { key: 'mkdir', label: '新建文件夹' },
    )

    if (!isRootDirectory) {
      items.push({ key: 'rename', label: '重命名' })
      items.push({ key: 'delete', label: '删除', danger: true })
      items.push({ key: 'quickDelete', label: '快速删除(rm命令)', danger: true })
      items.push({ key: 'download', label: '下载' })
    }

    items.push(
      { key: 'copyPath', label: '复制路径' },
      { key: 'upload', label: '上传...' },
      { key: 'permissions', label: '文件权限...' },
    )
  } else {
    if (isTextFile(file.name)) {
      items.push({ key: 'preview', label: '打开预览' })
    }
    items.push(
      { key: 'download', label: '下载文件' },
      { key: 'copyPath', label: '复制路径' },
      { key: 'rename', label: '重命名' },
      { key: 'delete', label: '删除文件', danger: true },
      { key: 'permissions', label: '文件权限...' },
    )
  }

  return items
}

function getEntryMenuProps(file: SftpFileEntry) {
  return {
    items: getEntryMenuItems(file),
    onClick: ({ key }: { key: string }) => handleEntryMenuClick(file, key),
  }
}

function handleContextMenuClick({ key }: { key: string }) {
  const { scope, entry } = contextMenu.value
  closeContextMenu()

  if (scope === 'surface') {
    handleSurfaceMenuClick(key)
    return
  }

  if (entry) {
    handleEntryMenuClick(entry, key)
  }
}

function handleSurfaceMenuClick(key: string) {
  switch (key) {
    case 'mkdir':
      createFolder()
      break
    case 'refresh':
      refreshCurrentPath()
      break
    case 'toggleHidden':
      toggleShowHidden()
      break
    case 'copyPath':
      copyText(currentPath.value, '路径已复制')
      break
  }
}

function handleEntryMenuClick(file: SftpFileEntry, key: string) {
  selectedFileName.value = file.name

  switch (key) {
    case 'open':
      openEntry(file)
      break
    case 'refresh':
      loadFiles(buildFilePath(file), true)
      break
    case 'mkdir':
      createFolder(buildFilePath(file))
      break
    case 'preview':
      openFilePreview(file)
      break
    case 'download':
      downloadFile(file)
      break
    case 'copyPath':
      copyText(buildFilePath(file), '路径已复制')
      break
    case 'upload':
      openUploadPicker(buildFilePath(file))
      break
    case 'permissions':
      showEntryPermissions(file)
      break
    case 'rename':
      renameFile(file)
      break
    case 'delete':
      deleteFile(file)
      break
    case 'quickDelete':
      quickDeleteWithRm(file)
      break
  }
}

async function beforeUpload(file: File) {
  await uploadFiles([file])
  return false
}

function openUploadPicker(targetPath = currentPath.value) {
  pendingUploadTargetPath.value = normalizeRemotePath(targetPath)
  if (uploadInputRef.value) {
    uploadInputRef.value.value = ''
    uploadInputRef.value.click()
  }
}

async function handleContextUploadChange(event: Event) {
  const input = event.target as HTMLInputElement
  const selectedFiles = Array.from(input.files || [])
  if (!selectedFiles.length) return
  await uploadFiles(selectedFiles, pendingUploadTargetPath.value)
  input.value = ''
}

async function uploadFiles(fileList: File[], targetPath = currentPath.value) {
  if (!props.connectionId || !fileList.length) return
  const batchMeta = createTransferBatchMeta('upload', fileList.length)
  const normalizedTargetPath = normalizeRemotePath(targetPath)

  for (const file of fileList) {
    emit('startUpload', {
      fileName: file.name,
      targetPath: normalizedTargetPath === '/' ? `/${file.name}` : `${normalizedTargetPath}/${file.name}`,
      connectionId: props.connectionId,
      batchId: batchMeta.batchId,
      batchLabel: batchMeta.batchLabel,
      source: {
        kind: 'file',
        file,
      },
    })
  }
}

async function uploadLocalPaths(localPaths: string[], targetPath = currentPath.value) {
  if (!props.connectionId || localPaths.length === 0) return
  const batchMeta = createTransferBatchMeta('upload', localPaths.length)
  const normalizedTargetPath = normalizeRemotePath(targetPath)

  for (const rawLocalPath of localPaths) {
    const localPath = normalizeNativeLocalPath(rawLocalPath)
    const fileName = getFileNameFromLocalPath(localPath)
    emit('startUpload', {
      fileName,
      targetPath: normalizedTargetPath === '/' ? `/${fileName}` : `${normalizedTargetPath}/${fileName}`,
      connectionId: props.connectionId,
      batchId: batchMeta.batchId,
      batchLabel: batchMeta.batchLabel,
      source: {
        kind: 'local-path',
        localPath,
      },
    })
  }
}

async function setupNativeDragDrop() {
  unlistenNativeDragDrop = await getCurrentWebview().onDragDropEvent(async (event) => {
    if (!props.connectionId || !props.active) return

    if (event.payload.type === 'leave') {
      isDraggingOver.value = false
      return
    }

    if (event.payload.type === 'over') {
      const point = toClientPosition(event.payload.position)
      isDraggingOver.value = isPointInsideBrowser(point.x, point.y)
      return
    }

    if (event.payload.type === 'enter') {
      const point = toClientPosition(event.payload.position)
      isDraggingOver.value = isPointInsideBrowser(point.x, point.y)
      return
    }

    if (event.payload.type === 'drop') {
      const point = toClientPosition(event.payload.position)
      isDraggingOver.value = false

      if (!isPointInsideBrowser(point.x, point.y)) {
        return
      }

      await uploadLocalPaths(event.payload.paths)
    }
  })
}
</script>

<style scoped>
.remote-workbench {
  --rw-header-padding: 8px 10px 7px;
  --rw-body-padding: 6px 8px 8px;
  --rw-panel-radius: 12px;
  --rw-panel-head-padding: 8px 10px 7px;
  --rw-toolbar-padding: 5px 10px;
  --rw-toolbar-height: 30px;
  --rw-selection-min-height: 24px;
  --rw-tree-width: 184px;
  --rw-tree-row-height: 26px;
  --rw-table-cell-padding: 7px;
  --rw-name-size: 11px;
  --rw-meta-size: 10px;
  --rw-context-size: 10px;
  --rw-eyebrow-size: 8px;
  --rw-tag-bg: var(--surface-1);
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: linear-gradient(180deg, color-mix(in srgb, var(--surface-0) 96%, transparent), color-mix(in srgb, var(--surface-1) 90%, transparent));
}

.remote-workbench--comfortable {
  --rw-header-padding: 10px 12px 8px;
  --rw-body-padding: 8px 10px 10px;
  --rw-panel-radius: 13px;
  --rw-panel-head-padding: 9px 12px 8px;
  --rw-toolbar-padding: 6px 12px;
  --rw-toolbar-height: 32px;
  --rw-selection-min-height: 28px;
  --rw-tree-width: 208px;
  --rw-tree-row-height: 28px;
  --rw-table-cell-padding: 8px;
  --rw-name-size: 12px;
  --rw-meta-size: 11px;
  --rw-context-size: 11px;
}

.remote-workbench--balanced {
  --rw-header-padding: 8px 10px 7px;
  --rw-body-padding: 6px 8px 8px;
  --rw-panel-radius: 12px;
  --rw-panel-head-padding: 8px 10px 7px;
  --rw-toolbar-padding: 5px 10px;
  --rw-toolbar-height: 30px;
  --rw-selection-min-height: 24px;
  --rw-tree-width: 192px;
  --rw-tree-row-height: 26px;
  --rw-table-cell-padding: 7px;
}

.remote-workbench--compact {
  --rw-header-padding: 6px 8px 5px;
  --rw-body-padding: 4px 6px 6px;
  --rw-panel-radius: 10px;
  --rw-panel-head-padding: 6px 8px 5px;
  --rw-toolbar-padding: 4px 8px;
  --rw-toolbar-height: 28px;
  --rw-selection-min-height: 20px;
  --rw-tree-width: 178px;
  --rw-tree-row-height: 24px;
  --rw-table-cell-padding: 5px;
  --rw-name-size: 11px;
  --rw-meta-size: 10px;
  --rw-context-size: 10px;
}

.remote-workbench__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: var(--rw-header-padding);
  border-bottom: 1px solid var(--border-color);
}

.remote-workbench__heading {
  flex-shrink: 0;
  flex-basis: auto;
  min-width: 0;
}

.remote-workbench__eyebrow,
.remote-panel__eyebrow {
  display: block;
  color: var(--muted-color);
  font-size: var(--rw-eyebrow-size);
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.remote-workbench__title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin-top: 1px;
}

.remote-workbench__title-row h3,
.remote-panel__head h4 {
  margin: 0;
  font-size: 13px;
  line-height: 1;
}

.remote-workbench__context {
  color: var(--muted-color);
  font-size: var(--rw-context-size);
  font-weight: 700;
}

.remote-workbench__meta-group {
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
  justify-content: flex-end;
  align-items: center;
  flex: 0 0 auto;
  margin-left: auto;
}

.remote-workbench__filters {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 220px;
  flex: 1;
  justify-content: flex-end;
}

.remote-workbench__quick-actions {
  flex-shrink: 0;
  margin-left: 6px;
}

:deep(.remote-workbench__quick-actions .ant-btn),
.remote-toolbar__toggle {
  border-radius: 10px !important;
  box-shadow: none !important;
}

:deep(.remote-workbench__quick-actions .ant-btn) {
  min-width: 30px;
  height: 30px;
  border-color: var(--border-color);
  background: var(--surface-1);
}

:deep(.remote-workbench__quick-actions .ant-btn:hover),
.remote-toolbar__toggle:hover {
  border-color: var(--strong-border) !important;
  background: var(--surface-2) !important;
}

.remote-workbench__tag {
  margin-inline-end: 0;
  background: var(--rw-tag-bg);
  color: var(--muted-color);
  border-radius: 999px;
  font-size: var(--rw-meta-size);
  line-height: 1.6;
}

.remote-workbench__tag--active {
  background: var(--primary-soft);
  color: var(--primary-color);
}

.remote-workbench__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
  padding: var(--rw-body-padding);
  background: linear-gradient(180deg, color-mix(in srgb, var(--surface-0) 98%, transparent), color-mix(in srgb, var(--surface-1) 92%, transparent));
  border-radius: var(--rw-panel-radius);
}

.remote-toolbar {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: var(--rw-toolbar-padding);
  border-radius: var(--rw-panel-radius);
  background: var(--surface-1);
  box-shadow: inset 0 0 0 1px var(--border-color);
}

.remote-toolbar__path-row,
.remote-toolbar__breadcrumb {
  display: flex;
  align-items: center;
  min-width: 0;
}

.remote-toolbar__path-row {
  min-height: var(--rw-toolbar-height);
}

.remote-toolbar__breadcrumb {
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
}

.remote-toolbar__breadcrumb::-webkit-scrollbar {
  display: none;
}

.remote-toolbar__crumb {
  border-radius: 999px;
  color: var(--muted-color);
}

.remote-toolbar__crumb.is-current {
  color: var(--primary-color);
  background: var(--primary-soft);
}

.remote-toolbar__search {
  width: 100%;
  min-width: 180px;
  max-width: 320px;
  flex: 1;
}

.remote-toolbar__toggle.is-active {
  color: var(--primary-color);
}

:deep(.remote-toolbar .ant-btn) {
  height: var(--rw-toolbar-height) !important;
  padding-inline: 8px !important;
  border-radius: 10px !important;
}

:deep(.remote-toolbar .ant-input),
:deep(.remote-toolbar .ant-input-affix-wrapper) {
  min-height: calc(var(--rw-toolbar-height) + 2px) !important;
}

.remote-selection {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: var(--rw-selection-min-height);
  padding: 0 2px;
}

.remote-selection__main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.remote-selection__icon {
  color: var(--primary-color);
}

.remote-selection__name {
  font-size: var(--rw-name-size);
  font-weight: 700;
}

.remote-selection__stats,
.remote-selection__hint {
  color: var(--muted-color);
  font-size: var(--rw-meta-size);
}

.remote-selection__stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.remote-workbench__content {
  display: grid;
  grid-template-columns: var(--rw-tree-width) minmax(0, 1fr);
  gap: 6px;
  min-height: 0;
  flex: 1;
}

.remote-panel {
  min-height: 0;
  border-radius: var(--rw-panel-radius);
  background: linear-gradient(180deg, color-mix(in srgb, var(--surface-1) 94%, transparent), color-mix(in srgb, var(--surface-0) 90%, transparent));
  box-shadow:
    inset 0 0 0 1px var(--border-color),
    var(--shadow-card);
}

.remote-panel__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  padding: var(--rw-panel-head-padding);
  border-bottom: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--surface-1) 88%, transparent);
}

.remote-panel__count {
  color: var(--muted-color);
  font-size: var(--rw-meta-size);
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--surface-1);
  border: 1px solid var(--border-color);
}

.remote-tree {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.remote-tree__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px;
}

.remote-tree__title {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  min-width: 0;
}

.remote-tree__title.is-current,
.remote-tree__icon {
  color: var(--primary-color);
}

.remote-tree__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--rw-name-size);
}

.remote-tree__switcher {
  font-size: var(--rw-name-size);
  color: var(--muted-color);
  transition: transform 0.18s ease;
}

.remote-tree__switcher.is-open {
  transform: rotate(90deg);
}

.remote-tree__empty {
  padding: 10px;
  color: var(--muted-color);
  font-size: 10px;
  background: var(--surface-1);
  border: 1px dashed var(--border-color);
  border-radius: 10px;
}

:deep(.remote-tree .ant-tree) {
  background: transparent;
  color: var(--text-color);
}

:deep(.remote-tree .ant-tree-node-content-wrapper) {
  width: calc(100% - 4px);
  min-height: var(--rw-tree-row-height);
  margin: 1px 2px;
  padding: 0 4px 0 2px !important;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
}

:deep(.remote-tree .ant-tree-title) {
  display: block;
  width: 100%;
  min-width: 0;
}

:deep(.remote-tree .ant-tree-node-content-wrapper:hover),
:deep(.remote-tree .ant-tree-node-selected) {
  background: var(--surface-1) !important;
  box-shadow: inset 0 0 0 1px var(--border-color);
}

.remote-browser {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.remote-browser.is-drag-over {
  box-shadow:
    inset 0 0 0 2px rgba(45, 125, 255, 0.32),
    0 12px 28px rgba(41, 71, 116, 0.06);
}

.remote-browser__hint-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 8px 0;
  color: var(--muted-color);
  font-size: var(--rw-meta-size);
  background: transparent;
}

.remote-browser__table-shell {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border-radius: 8px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--surface-0) 98%, transparent), color-mix(in srgb, var(--surface-1) 86%, transparent));
}

:deep(.remote-file-table .ant-table) {
  background: transparent;
  color: var(--text-color);
  height: 100%;
}

:deep(.remote-file-table .ant-spin-nested-loading),
:deep(.remote-file-table .ant-spin-container),
:deep(.remote-file-table .ant-table-container),
:deep(.remote-file-table .ant-table-content) {
  height: 100%;
}

:deep(.remote-file-table .ant-table-container) {
  border-inline-start: 0 !important;
  background: transparent !important;
}

:deep(.remote-file-table .ant-table-body) {
  max-height: none !important;
  background: transparent !important;
}

:deep(.remote-file-table .ant-table-placeholder),
:deep(.remote-file-table .ant-table-placeholder:hover > td),
:deep(.remote-file-table .ant-table-tbody > .ant-table-placeholder > td) {
  background: transparent !important;
}

:deep(.remote-file-table .ant-table-thead > tr > th) {
  background: color-mix(in srgb, var(--surface-1) 88%, transparent);
  border-color: var(--border-color);
  color: var(--muted-color);
  font-size: calc(var(--rw-meta-size) - 1px);
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding-top: calc(var(--rw-table-cell-padding) - 1px) !important;
  padding-bottom: calc(var(--rw-table-cell-padding) - 1px) !important;
}

:deep(.remote-file-table .ant-table-tbody > tr > td) {
  border-color: var(--border-subtle);
  padding-top: var(--rw-table-cell-padding);
  padding-bottom: var(--rw-table-cell-padding);
  background: transparent;
}

:deep(.remote-file-table .ant-table-tbody > tr) {
  cursor: pointer;
}

:deep(.remote-file-table .ant-table-tbody > tr:hover > td),
:deep(.remote-file-table .ant-table-tbody > tr.is-selected > td) {
  background: var(--surface-1) !important;
}

.remote-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.remote-name-cell__icon {
  flex-shrink: 0;
  color: var(--primary-color);
}

.remote-name-cell__copy {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.remote-name-cell__label,
.remote-name-cell__path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remote-name-cell__label {
  font-size: var(--rw-name-size);
  font-weight: 700;
}

.remote-name-cell__path {
  color: var(--muted-color);
  font-size: calc(var(--rw-meta-size) - 1px);
}

.remote-kind-tag {
  margin-inline-end: 0;
  background: var(--surface-1);
  color: var(--muted-color);
}

.remote-kind-tag.is-directory {
  background: var(--primary-soft);
  color: var(--primary-color);
}

.remote-cell__mono {
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
}

.remote-row__menu {
  color: var(--muted-color);
}

.remote-workbench__empty {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  border-radius: var(--rw-panel-radius);
  background: linear-gradient(180deg, color-mix(in srgb, var(--surface-0) 98%, transparent), color-mix(in srgb, var(--surface-1) 90%, transparent));
  border: 1px solid var(--border-color);
}

:deep(.remote-file-table .ant-empty) {
  color: var(--muted-color);
}

:deep(.remote-file-table .ant-empty-image) {
  opacity: 0.82;
}

:deep(.remote-file-table .ant-empty-description) {
  color: var(--muted-color) !important;
}

.remote-browser__drag-mask {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface-0) 96%, transparent);
  backdrop-filter: blur(6px);
  color: var(--primary-color);
  font-size: 13px;
  font-weight: 700;
  pointer-events: none;
}

.remote-browser__drag-icon {
  font-size: 34px;
}

.remote-context-menu {
  position: fixed;
  z-index: 1200;
  min-width: 188px;
  padding: 4px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-1) 96%, transparent);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(10px);
}

.remote-upload-input {
  display: none;
}

.permission-modal {
  display: grid;
  gap: 14px;
}

.permission-modal__target {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-color);
}

.permission-modal__path {
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--surface-1);
  color: var(--muted-color);
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
}

.permission-modal__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: var(--muted-color);
  font-size: 12px;
}

.permission-table {
  display: grid;
  grid-template-columns: 72px repeat(3, minmax(0, 1fr));
  gap: 10px 12px;
  align-items: center;
}

.permission-table__head {
  color: var(--muted-color);
  font-size: 12px;
  font-weight: 700;
}

.permission-table__label {
  color: var(--text-color);
  font-size: 13px;
  font-weight: 600;
}

.permission-recursive {
  display: grid;
  gap: 10px;
  padding-top: 4px;
}

.permission-recursive :deep(.ant-radio-group) {
  display: grid;
  gap: 8px;
}

:deep(.remote-context-menu .ant-menu) {
  background: transparent;
  border-inline-end: 0;
}

:deep(.remote-context-menu .ant-menu-item) {
  height: 30px;
  margin: 2px 0;
  border-radius: 8px;
  line-height: 30px;
}

:deep(.remote-context-menu .ant-menu-item:hover),
:deep(.remote-context-menu .ant-menu-item-selected) {
  background: var(--primary-soft);
}

@media (max-width: 1240px) {
  .remote-workbench__header,
  .remote-toolbar__path-row,
  .remote-selection {
    align-items: flex-start;
    flex-direction: column;
  }

  .remote-workbench__filters {
    width: 100%;
    align-items: flex-start;
    justify-content: flex-start;
    flex: none;
  }

  .remote-workbench__meta-group {
    width: 100%;
    flex-wrap: wrap;
    justify-content: flex-start;
    margin-left: 0;
  }

  .remote-toolbar__search {
    width: 100%;
    max-width: none;
  }

  .remote-workbench__content {
    grid-template-columns: 1fr;
  }

  .remote-tree {
    max-height: 220px;
  }
}
</style>
