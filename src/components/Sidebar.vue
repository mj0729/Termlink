<template>
  <div class="left-panel" :class="{ collapsed: collapsed }">
    <div class="panel-header">
      <div class="panel-header__content">
        <span class="panel-header__eyebrow">Explorer</span>
        <span class="panel-header__title">文件</span>
      </div>
      <a-button 
        type="text" 
        size="small" 
        @click="$emit('toggle')"
        class="collapse-btn"
      >
        {{ collapsed ? '>' : '<' }}
      </a-button>
    </div>
    
    <div class="panel-content" v-if="!collapsed">
      <div class="section-title">
        <span>文件管理器</span>
      </div>
      <div class="file-manager-section">
        <!-- SFTP文件浏览器 -->
        <div v-if="currentSftpConnection" class="sftp-browser">
          <div class="browser-toolbar">
            <a-space-compact size="small">
              <a-button @click="sftpGoBack" :disabled="!canSftpGoBack" title="返回">
                <ArrowLeftOutlined />
              </a-button>
              <a-button @click="sftpGoUp" :disabled="sftpIsAtRoot" title="上级目录">
                <ArrowUpOutlined />
              </a-button>
              <a-button @click="refreshSftpFiles" title="刷新">
                <ReloadOutlined />
              </a-button>
              <a-button @click="createNewFolder" title="新建文件夹">
                <FolderAddOutlined />
              </a-button>
            </a-space-compact>
            
            <div class="toolbar-right">
              <a-tooltip title="显示隐藏文件">
                <a-button 
                  type="text" 
                  size="small" 
                  @click="toggleShowHidden"
                  :class="{ active: showHiddenFiles }"
                >
                  <EyeOutlined v-if="showHiddenFiles" />
                  <EyeInvisibleOutlined v-else />
                </a-button>
              </a-tooltip>
            </div>
          </div>
          
          <div class="current-path">
            <a-input 
              v-model:value="currentSftpState.pathInput" 
              @pressEnter="navigateToPath"
              @blur="navigateToPath"
              size="small"
              placeholder="输入路径后按Enter"
              class="path-input"
            />
          </div>
          
          <div 
            class="file-list" 
            ref="fileListRef"
            @drop.prevent="handleDrop"
            @dragover.prevent="handleDragOver"
            @dragleave.prevent="handleDragLeave"
            @dragenter.prevent="handleDragEnter"
            :class="{ 'drag-over': isDraggingOver }"
          >
            <a-spin :spinning="currentSftpState?.loading || false" size="small">
              <div 
                v-for="file in currentSftpState?.files || []" 
                :key="file.name"
                @click="handleSftpFileClick(file)"
                @dblclick="handleSftpFileDoubleClick(file)"
                @contextmenu.prevent="showSftpContextMenu($event, file)"
                class="file-item"
                :class="{ directory: file.is_dir }"
              >
                <component :is="getSftpFileIcon(file)" class="file-icon" />
                <span class="file-name">{{ file.name }}</span>
                <div v-if="!file.is_dir" class="file-size">
                  {{ formatFileSize(file.size) }}
                </div>
              </div>
              
              <!-- 拖拽提示 -->
              <div v-if="isDraggingOver" class="drag-overlay">
                <div class="drag-hint">
                  <CloudUploadOutlined style="font-size: 48px;" />
                  <div>释放以上传文件到当前目录</div>
                </div>
              </div>
            </a-spin>
          </div>
        </div>
        
        <!-- 未连接状态 -->
        <div v-else class="no-connection">
          <a-empty description="从顶部主机栏或主机中心选择主机后再浏览远程文件" size="small" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, h } from 'vue'
import { 
  FolderOutlined, 
  DeleteOutlined,
  CloseOutlined,
  ArrowLeftOutlined,
  ArrowUpOutlined,
  ReloadOutlined,
  FileOutlined,
  FileTextOutlined,
  FileImageOutlined,
  FileZipOutlined,
  VideoCameraOutlined,
  SoundOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  CloudUploadOutlined,
  FolderAddOutlined
} from '@antdv-next/icons'
import { invoke } from '@tauri-apps/api/core'
import type {
  ConnectionTab,
  DownloadRequest,
  SelectOption,
  SftpFileEntry,
  SftpState,
  SshProfile,
} from '../types/app'

const props = withDefaults(defineProps<{
  collapsed?: boolean
  profiles?: SshProfile[]
  activeTab?: ConnectionTab | null
}>(), {
  collapsed: false,
  profiles: () => [],
  activeTab: null
})

const emit = defineEmits(['toggle', 'launchProfile', 'showFileManager', 'refreshProfiles', 'openFilePreview', 'startDownload', 'editProfile'])

// 文件类型扩展名常量（避免每次调用重新创建数组）
const TEXT_EXTS = new Set([
  'txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'vue',
  'py', 'java', 'cpp', 'c', 'h', 'rs', 'go', 'php', 'rb', 'sh',
  'yml', 'yaml', 'ini', 'conf', 'log', 'sql', 'csv'
])
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'])
const VIDEO_EXTS = new Set(['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv'])
const AUDIO_EXTS = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg'])
const ARCHIVE_EXTS = new Set(['zip', 'rar', '7z', 'tar', 'gz'])

// 搜索和视图状态
const searchText = ref('')
const viewMode = ref<'list' | 'group'>('list')
const expandedGroups = ref<Set<string>>(new Set(['未分组']))

// 搜索功能
function onSearch() {
  // 搜索时的逻辑在computed中处理
}

// 过滤后的配置文件
const filteredProfiles = computed<SshProfile[]>(() => {
  if (!searchText.value.trim()) {
    return props.profiles
  }
  
  const search = searchText.value.toLowerCase()
  return props.profiles.filter((profile) => {
    const name = profile.name?.toLowerCase() || ''
    const host = profile.host?.toLowerCase() || ''
    const username = profile.username?.toLowerCase() || ''
    const group = profile.group?.toLowerCase() || ''
    const tags = profile.tags?.join(' ')?.toLowerCase() || ''
    
    return name.includes(search) || 
           host.includes(search) || 
           username.includes(search) ||
           group.includes(search) ||
           tags.includes(search)
  })
})

// 分组后的配置文件
const groupedProfiles = computed<Record<string, SshProfile[]>>(() => {
  const filtered = filteredProfiles.value
  const groups: Record<string, SshProfile[]> = {}
  
  filtered.forEach(profile => {
    const groupName = profile.group || '未分组'
    if (!groups[groupName]) {
      groups[groupName] = []
    }
    groups[groupName].push(profile)
  })
  
  // 按分组名排序，未分组放在最前面
  const sortedGroups: Record<string, SshProfile[]> = {}
  if (groups['未分组']) {
    sortedGroups['未分组'] = groups['未分组']
  }
  
  Object.keys(groups)
    .filter(name => name !== '未分组')
    .sort()
    .forEach(name => {
      sortedGroups[name] = groups[name]
    })
  
  return sortedGroups
})

// 切换分组展开状态
function toggleGroup(groupName: string) {
  if (expandedGroups.value.has(groupName)) {
    expandedGroups.value.delete(groupName)
  } else {
    expandedGroups.value.add(groupName)
  }
}

// SFTP相关状态 - 为每个连接保存独立状态
const sftpStatesByConnection = ref<Map<string, SftpState>>(new Map())
const fileListRef = ref<HTMLElement | null>(null)
const showHiddenFiles = ref(false)
const isDraggingOver = ref(false)

// 创建初始SFTP状态
function createInitialSftpState(): SftpState {
  return {
    currentPath: '/',
    pathInput: '/',
    files: [],
    loading: false,
    history: [],
    historyIndex: -1
  }
}

// 获取当前连接ID
const currentConnectionId = computed<string | null>(() => {
  if (!props.activeTab) return null
  
  // SSH标签页：直接使用 connection_id
  if (props.activeTab.type === 'ssh') {
    return props.activeTab.id
  }
  
  // File标签页：使用 connectionId（从SSH继承）
  if (props.activeTab.type === 'file' && props.activeTab.connectionId) {
    return props.activeTab.connectionId
  }
  
  // 其他类型（如local）不显示SFTP
  return null
})

// 获取或创建当前连接的状态
const currentSftpState = computed<SftpState | null>(() => {
  const connId = currentConnectionId.value
  if (!connId) return null
  
  // 如果这个连接是第一次使用，创建初始状态
  if (!sftpStatesByConnection.value.has(connId)) {
    sftpStatesByConnection.value.set(connId, createInitialSftpState())
  }
  
  return sftpStatesByConnection.value.get(connId)
})

// 当前SFTP连接信息（用于显示）
const currentSftpConnection = computed<{ id: string; title: string } | null>(() => {
  if (!currentConnectionId.value) return null
  
  return {
    id: currentConnectionId.value,
    title: props.activeTab?.title || 'SFTP'
  }
})

// SFTP导航状态
const canSftpGoBack = computed(() => {
  const state = currentSftpState.value
  return state ? state.historyIndex > 0 : false
})

const sftpIsAtRoot = computed(() => {
  const state = currentSftpState.value
  return state ? (!state.currentPath || state.currentPath === '/') : true
})

// 监听连接ID变化，按需加载SFTP文件
watch(() => currentConnectionId.value, async (newConnId, oldConnId) => {
  if (newConnId && newConnId !== oldConnId) {
    // 切换到了不同的连接
    const state = currentSftpState.value
    
    // 如果是新连接且还没加载过文件，加载根目录
    if (state && state.files.length === 0 && state.currentPath === '/') {
      try {
        await loadSftpFiles('/')
      } catch (error) {
        console.warn('加载SFTP文件失败:', error)
      }
    }
  }
}, { immediate: false })

// 加载SFTP文件列表
async function loadSftpFiles(path: string) {
  const state = currentSftpState.value
  if (!state || !currentSftpConnection.value) return
  
  state.loading = true
  try {
    // 使用后端API加载文件
    const files = await invoke<SftpFileEntry[]>('list_sftp_files', { 
      connectionId: currentSftpConnection.value.id,
      path 
    })
    
    // 根据设置过滤隐藏文件
    state.files = showHiddenFiles.value 
      ? files 
      : files.filter((file) => !file.name.startsWith('.'))
    
    // 更新历史记录
    if (state.historyIndex === -1 || state.history[state.historyIndex] !== path) {
      state.history = state.history.slice(0, state.historyIndex + 1)
      state.history.push(path)
      state.historyIndex = state.history.length - 1
    }
    
    state.currentPath = path
    state.pathInput = path // 同步更新路径输入框
  } catch (error) {
    console.error('加载文件列表失败:', error)
    message.error('加载文件列表失败: ' + error)
  } finally {
    state.loading = false
  }
}

// 导航到指定路径
function navigateToPath() {
  const state = currentSftpState.value
  if (!state) return
  
  const path = state.pathInput.trim()
  if (path && path !== state.currentPath) {
    loadSftpFiles(path)
  } else {
    // 如果输入为空或与当前路径相同，恢复原值
    state.pathInput = state.currentPath
  }
}

// SFTP文件点击处理（单击选中）
function handleSftpFileClick(file: SftpFileEntry) {
  // 单击仅用于选中，不执行操作
  console.log('选中文件:', file.name)
}

// SFTP文件双击处理
function handleSftpFileDoubleClick(file: SftpFileEntry) {
  const state = currentSftpState.value
  if (!state) return
  
  if (file.is_dir) {
    // 文件夹双击进入
    const newPath = state.currentPath === '/' 
      ? `/${file.name}` 
      : `${state.currentPath}/${file.name}`
    loadSftpFiles(newPath)
  } else {
    // 文件双击仅在文本文件时打开预览，其他文件不做任何操作
    if (isTextFile(file.name)) {
      openFilePreview(file)
    }
    // 移除了对非文本文件的showFileActions调用
  }
}

// 判断是否为文本文件
function isTextFile(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase()
  return ext ? TEXT_EXTS.has(ext) : false
}

// 打开文件预览
async function openFilePreview(file: SftpFileEntry) {
  const state = currentSftpState.value
  if (!state) return
  
  const filePath = state.currentPath === '/' 
    ? `/${file.name}` 
    : `${state.currentPath}/${file.name}`
    
  emit('openFilePreview', {
    name: file.name,
    path: filePath,
    size: file.size
  })
}

// 显示文件操作选项
function showFileActions(file: SftpFileEntry) {
  Modal.confirm({
    title: `文件操作: ${file.name}`,
    content: '选择要执行的操作',
    okText: '下载',
    cancelText: '取消',
    onOk: () => downloadFile(file)
  })
}

// 下载文件
async function downloadFile(file: SftpFileEntry) {
  const state = currentSftpState.value
  if (!state || !currentSftpConnection.value) return
  
  try {
    const remotePath = state.currentPath === '/' 
      ? `/${file.name}` 
      : `${state.currentPath}/${file.name}`
    
    // 选择下载位置
    const savePath = await invoke<string | null>('select_download_location', {
      fileName: file.name
    })
    
    if (!savePath) {
      return // 用户取消了选择
    }
    
    // 通过事件通知父组件开始下载
    emit('startDownload', {
      fileName: file.name,
      remotePath: remotePath,
      savePath: savePath,
      connectionId: currentSftpConnection.value.id
    } satisfies DownloadRequest)
    
  } catch (error) {
    console.error('下载文件失败:', error)
    message.error('下载文件失败: ' + error)
  }
}

// SFTP导航
function sftpGoBack() {
  const state = currentSftpState.value
  if (!state || !canSftpGoBack.value) return
  
  state.historyIndex--
  loadSftpFiles(state.history[state.historyIndex])
}

async function sftpGoUp() {
  const state = currentSftpState.value
  if (!state || sftpIsAtRoot.value) return
  
  const parts = state.currentPath.split('/').filter(p => p)
  parts.pop()
  const newPath = parts.length > 0 ? '/' + parts.join('/') : '/'
  loadSftpFiles(newPath)
}

function refreshSftpFiles() {
  const state = currentSftpState.value
  if (!state) return
  
  loadSftpFiles(state.currentPath)
}

// 切换隐藏文件显示
function toggleShowHidden() {
  const state = currentSftpState.value
  if (!state) return
  
  showHiddenFiles.value = !showHiddenFiles.value
  // 重新加载当前目录
  loadSftpFiles(state.currentPath)
}

// 显示SFTP右键菜单
function showSftpContextMenu(event: MouseEvent, file: SftpFileEntry) {
  event.preventDefault()
  
  // 移除已存在的菜单
  const existingMenu = document.querySelector('.sftp-context-menu')
  if (existingMenu) {
    existingMenu.remove()
  }
  
  // 创建菜单
  const menu = document.createElement('div')
  menu.className = 'sftp-context-menu'
  menu.style.cssText = `
    position: fixed;
    left: ${event.clientX}px;
    top: ${event.clientY}px;
    background: var(--panel-bg);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    min-width: 150px;
    padding: 4px 0;
  `
  
  // 菜单项
  const menuItems: Array<{ label?: string; action?: () => void; danger?: boolean; divider?: boolean }> = []
  
  // 下载
  menuItems.push({
    label: '📥 下载',
    action: () => {
      downloadFile(file)
      menu.remove()
    }
  })
  
  // 如果是文本文件，添加打开/预览选项
  if (!file.is_dir && isTextFile(file.name)) {
    menuItems.push({
      label: '📄 打开',
      action: () => {
        openFilePreview(file)
        menu.remove()
      }
    })
  }
  
  // 分隔线
  menuItems.push({ divider: true })
  
  // 重命名
  menuItems.push({
    label: '✏️ 重命名',
    action: () => {
      renameFile(file)
      menu.remove()
    }
  })
  
  // 删除
  menuItems.push({
    label: '🗑️ 删除',
    action: () => {
      deleteFile(file)
      menu.remove()
    },
    danger: true
  })
  
  // 分隔线
  menuItems.push({ divider: true })
  
  // 复制路径
  menuItems.push({
    label: '📋 复制路径',
    action: () => {
      copyFilePath(file)
      menu.remove()
    }
  })
  
  // 添加菜单项
  menuItems.forEach(item => {
    if (item.divider) {
      const divider = document.createElement('div')
      divider.style.cssText = `
        height: 1px;
        background: var(--border-color);
        margin: 4px 0;
      `
      menu.appendChild(divider)
    } else {
      const menuItem = document.createElement('div')
      menuItem.style.cssText = `
        padding: 8px 16px;
        cursor: pointer;
        color: ${item.danger ? 'var(--error-color)' : 'var(--text-color)'};
        font-size: 14px;
        transition: background-color 0.2s;
      `
      menuItem.textContent = item.label
      menuItem.addEventListener('mouseenter', () => {
        menuItem.style.backgroundColor = 'var(--hover-bg)'
      })
      menuItem.addEventListener('mouseleave', () => {
        menuItem.style.backgroundColor = 'transparent'
      })
      menuItem.addEventListener('click', item.action)
      menu.appendChild(menuItem)
    }
  })
  
  // 添加到页面
  document.body.appendChild(menu)
  
  // 点击其他地方关闭菜单
  const closeMenu = (e: MouseEvent) => {
    const target = e.target
    if (!(target instanceof Node) || !menu.contains(target)) {
      menu.remove()
      document.removeEventListener('click', closeMenu)
    }
  }
  
  setTimeout(() => {
    document.addEventListener('click', closeMenu)
  }, 0)
}

// 获取文件图标
function getSftpFileIcon(file: SftpFileEntry) {
  if (file.is_dir) return FolderOutlined

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext) return FileOutlined

  if (IMAGE_EXTS.has(ext)) return FileImageOutlined
  if (VIDEO_EXTS.has(ext)) return VideoCameraOutlined
  if (AUDIO_EXTS.has(ext)) return SoundOutlined
  if (TEXT_EXTS.has(ext)) return FileTextOutlined
  if (ARCHIVE_EXTS.has(ext)) return FileZipOutlined

  return FileOutlined
}

// 格式化文件大小
function formatFileSize(bytes?: number) {
  if (!bytes || bytes === 0) return '-'
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

// 重命名文件/文件夹
async function renameFile(file: SftpFileEntry) {
  const nextName = ref(file.name)

  Modal.confirm({
    title: '重命名',
    content: () => h('input', {
      class: 'termlink-confirm-input',
      value: nextName.value,
      autofocus: true,
      onInput: (event: Event) => {
        nextName.value = (event.target as HTMLInputElement).value
      }
    }),
    okText: '重命名',
    cancelText: '取消',
    onOk: async () => {
      const targetName = nextName.value.trim()

      if (!targetName || targetName === file.name) {
        return
      }

      const state = currentSftpState.value
      if (!state || !currentSftpConnection.value) return

      try {
        const oldPath = state.currentPath === '/'
          ? `/${file.name}`
          : `${state.currentPath}/${file.name}`
        const newPath = state.currentPath === '/'
          ? `/${targetName}`
          : `${state.currentPath}/${targetName}`

        await invoke('rename_sftp_file', {
          connectionId: currentSftpConnection.value.id,
          oldPath,
          newPath
        })

        message.success('重命名成功')
        refreshSftpFiles()
      } catch (error) {
        console.error('重命名失败:', error)
        message.error('重命名失败: ' + error)
      }
    }
  })
}

// 删除文件/文件夹
async function deleteFile(file: SftpFileEntry) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除 "${file.name}" 吗？此操作无法撤销。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      const state = currentSftpState.value
      if (!state || !currentSftpConnection.value) return

      try {
        const filePath = state.currentPath === '/'
          ? `/${file.name}`
          : `${state.currentPath}/${file.name}`

        if (file.is_dir) {
          await invoke('delete_sftp_directory', {
            connectionId: currentSftpConnection.value.id,
            path: filePath
          })
        } else {
          await invoke('delete_sftp_file', {
            connectionId: currentSftpConnection.value.id,
            path: filePath
          })
        }

        message.success('删除成功')
        refreshSftpFiles()
      } catch (error) {
        console.error('删除失败:', error)
        message.error('删除失败: ' + error)
      }
    }
  })
}

// 复制文件路径
function copyFilePath(file: SftpFileEntry) {
  const state = currentSftpState.value
  if (!state) return

  const filePath = state.currentPath === '/'
    ? `/${file.name}`
    : `${state.currentPath}/${file.name}`

  navigator.clipboard.writeText(filePath).then(() => {
    message.success('路径已复制到剪贴板')
  }).catch(err => {
    console.error('复制失败:', err)
    message.error('复制失败')
  })
}

// 拖拽事件处理
function handleDragEnter(event: DragEvent) {
  if (!currentSftpConnection.value) return
  isDraggingOver.value = true
}

function handleDragOver(event: DragEvent) {
  if (!currentSftpConnection.value) return
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function handleDragLeave(event: DragEvent) {
  if (event.target === fileListRef.value) {
    isDraggingOver.value = false
  }
}

async function extractDroppedFiles(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return []

  const directFiles = Array.from(dataTransfer.files || [])
  if (directFiles.length > 0) {
    return directFiles
  }

  return Array.from(dataTransfer.items || [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file))
}

async function handleDrop(event: DragEvent) {
  isDraggingOver.value = false

  if (!currentSftpConnection.value) {
    message.warning('没有活动的SFTP连接')
    return
  }

  const files = await extractDroppedFiles(event.dataTransfer)
  if (files.length === 0) {
    message.warning('未检测到可上传的文件')
    return
  }

  for (const file of files) {
    await uploadFileToServer(file)
  }
}

// 上传文件到服务器
async function uploadFileToServer(file: File) {
  const state = currentSftpState.value
  if (!state || !currentSftpConnection.value) return

  try {
    const remotePath = state.currentPath === '/'
      ? `/${file.name}`
      : `${state.currentPath}/${file.name}`
    const data = Array.from(new Uint8Array(await file.arrayBuffer()))

    message.loading(`正在上传 ${file.name}...`, 0)

    await invoke('upload_sftp_content', {
      connectionId: currentSftpConnection.value.id,
      remotePath,
      data,
    })

    message.destroy()
    message.success(`上传成功: ${file.name}`)
    refreshSftpFiles()
  } catch (error) {
    message.destroy()
    console.error('上传文件失败:', error)
    message.error(`上传失败: ${file.name} - ${error}`)
  }
}

// 创建新文件夹
async function createNewFolder() {
  const state = currentSftpState.value
  if (!state || !currentSftpConnection.value) return
  const folderName = ref('')

  Modal.confirm({
    title: '新建文件夹',
    content: () => h('input', {
      class: 'termlink-confirm-input',
      value: folderName.value,
      placeholder: '请输入文件夹名称',
      autofocus: true,
      onInput: (event: Event) => {
        folderName.value = (event.target as HTMLInputElement).value
      }
    }),
    okText: '创建',
    cancelText: '取消',
    onOk: async () => {
      const nextFolderName = folderName.value.trim()

      if (!nextFolderName) {
        message.warning('请输入文件夹名称')
        return Promise.reject()
      }

      try {
        const folderPath = state.currentPath === '/'
          ? `/${nextFolderName}`
          : `${state.currentPath}/${nextFolderName}`

        await invoke('create_sftp_directory', {
          connectionId: currentSftpConnection.value.id,
          path: folderPath
        })

        message.success('文件夹创建成功')
        refreshSftpFiles()
      } catch (error) {
        console.error('创建文件夹失败:', error)
        message.error('创建文件夹失败: ' + error)
        return Promise.reject()
      }
    }
  })
}

// 删除配置文件
async function deleteProfile(profile: SshProfile) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除主机 "${profile.username ? `${profile.username}@${profile.host}` : profile.host}" 吗？此操作无法撤销。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await invoke('delete_ssh_profile', { profileId: profile.id })
        message.success('主机已删除')
        emit('refreshProfiles')
      } catch (error) {
        console.error('删除主机失败:', error)
        message.error('删除主机失败')
      }
    }
  })
}

// 右键菜单
function handleContextMenu(event: MouseEvent, profile: SshProfile) {
  event.preventDefault()
  showProfileContextMenu(event, profile)
}

// 显示SSH配置文件的右键菜单
function showProfileContextMenu(event: MouseEvent, profile: SshProfile) {
  // 移除已存在的菜单
  const existingMenu = document.querySelector('.profile-context-menu')
  if (existingMenu) {
    existingMenu.remove()
  }
  
  // 创建菜单
  const menu = document.createElement('div')
  menu.className = 'profile-context-menu'
  menu.style.cssText = `
    position: fixed;
    left: ${event.clientX}px;
    top: ${event.clientY}px;
    background: var(--panel-bg);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    min-width: 150px;
    padding: 4px 0;
  `
  
  // 菜单项
  const menuItems: Array<{ label: string; action: () => void }> = [
    {
      label: '编辑',
      action: () => {
        editProfile(profile)
        menu.remove()
      }
    },
    {
      label: '复制配置',
      action: () => {
        copyProfileConfig(profile)
        menu.remove()
      }
    },
    {
      label: '删除',
      action: () => {
        deleteProfile(profile)
        menu.remove()
      }
    }
  ]
  
  // 添加菜单项
  menuItems.forEach(item => {
    const menuItem = document.createElement('div')
    menuItem.style.cssText = `
      padding: 8px 16px;
      cursor: pointer;
      color: var(--text-color);
      font-size: 14px;
      transition: background-color 0.2s;
    `
    menuItem.textContent = item.label
    menuItem.addEventListener('mouseenter', () => {
      menuItem.style.backgroundColor = 'var(--hover-bg)'
    })
    menuItem.addEventListener('mouseleave', () => {
      menuItem.style.backgroundColor = 'transparent'
    })
    menuItem.addEventListener('click', item.action)
    menu.appendChild(menuItem)
  })
  
  // 添加到页面
  document.body.appendChild(menu)
  
  // 点击其他地方关闭菜单
  const closeMenu = (e: MouseEvent) => {
    const target = e.target
    if (!(target instanceof Node) || !menu.contains(target)) {
      menu.remove()
      document.removeEventListener('click', closeMenu)
    }
  }
  
  setTimeout(() => {
    document.addEventListener('click', closeMenu)
  }, 0)
}

// 编辑配置文件
function editProfile(profile: SshProfile) {
  // 触发编辑事件，让父组件处理
  emit('editProfile', profile)
}

// 复制配置信息
function copyProfileConfig(profile: SshProfile) {
  const configText = `名称: ${profile.name || '未命名'}
主机: ${profile.host}
端口: ${profile.port}
用户名: ${profile.username}
分组: ${profile.group || '未分组'}
标签: ${profile.tags ? profile.tags.join(', ') : '无'}
认证方式: ${profile.private_key ? '私钥' : '密码'}`
  
  navigator.clipboard.writeText(configText).then(() => {
    message.success('配置信息已复制到剪贴板')
  }).catch(err => {
    console.error('复制失败:', err)
    message.error('复制失败')
  })
}
</script>

<style scoped>
.left-panel {
  width: 258px;
  display: flex;
  flex-direction: column;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.08)),
    var(--panel-bg);
  border-radius: 24px;
  backdrop-filter: blur(16px);
  transition: width 0.28s ease;
}

.left-panel.collapsed {
  width: 56px;
}

.left-panel.collapsed .panel-header__content {
  display: none;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 14px 10px;
  background: transparent;
}

.panel-header__content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.panel-header__eyebrow {
  color: var(--muted-color);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.panel-header__title {
  color: var(--text-color);
  font-size: 18px;
  font-weight: 700;
  margin-top: 2px;
}

.collapse-btn {
  width: 30px !important;
  height: 30px !important;
  border-radius: 999px;
  color: var(--muted-color);
}

.panel-content {
  flex: 1;
  padding: 8px 12px 14px;
  overflow-y: auto;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  color: var(--muted-color);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.file-manager-section {
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.44);
  box-shadow: 0 18px 32px rgba(41, 71, 116, 0.08);
  padding: 12px;
}

.sftp-browser {
  border-radius: 18px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.22);
}

.browser-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.28);
}

.toolbar-right {
  display: flex;
  gap: 6px;
}

.toolbar-right .ant-btn.active {
  background: var(--primary-soft) !important;
  color: var(--primary-color) !important;
}

.current-path {
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.18);
}

.path-input {
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
  font-size: 12px;
}

.file-list {
  position: relative;
  min-height: 260px;
  max-height: 420px;
  overflow-y: auto;
  resize: vertical;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0)),
    var(--panel-bg);
  transition:
    border-color 0.24s ease,
    background-color 0.24s ease;
}

.file-list.drag-over {
  background: var(--hover-bg);
  box-shadow: inset 0 0 0 2px var(--primary-color);
}

.drag-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(45, 125, 255, 0.08);
  backdrop-filter: blur(6px);
  z-index: 10;
  pointer-events: none;
}

.drag-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  color: var(--primary-color);
  font-size: 15px;
  font-weight: 700;
  text-align: center;
  padding: 20px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  margin: 4px;
  border-radius: 12px;
  cursor: pointer;
  color: var(--text-color);
  font-size: 12px;
  transition: background-color 0.2s ease;
}

.file-item:hover {
  background: var(--hover-bg);
}

.file-item.directory {
  font-weight: 700;
}

.file-icon {
  flex-shrink: 0;
  font-size: 15px;
}

.file-item.directory .file-icon {
  color: var(--primary-color);
}

.file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  flex-shrink: 0;
  color: var(--muted-color);
  font-size: 10px;
}

.no-connection {
  padding: 24px 8px 10px;
}

:deep(.ant-empty) {
  margin-block: 8px 0;
}

@media (max-width: 768px) {
  .left-panel {
    width: 220px !important;
  }

  .left-panel.collapsed {
    width: 52px !important;
  }

  .file-list {
    max-height: 240px;
  }
}
</style>
