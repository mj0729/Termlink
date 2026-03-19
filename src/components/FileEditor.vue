<template>
  <div class="file-editor" :class="{ 'file-editor--immersive': immersiveReadonly }">
    <div class="editor-header">
      <div class="file-info">
        <span class="file-name">{{ fileInfo.name }}</span>
        <span class="file-path">{{ fileInfo.path }}</span>
        <span class="file-size">{{ formatFileSize(fileInfo.size) }}</span>
      </div>
      <div class="editor-actions">
        <a-button 
          v-if="hasUnsavedChanges" 
          type="primary" 
          size="small" 
          @click="saveFile"
          :loading="saving"
        >
          保存
        </a-button>
        <a-button 
          v-if="hasUnsavedChanges" 
          size="small" 
          @click="discardChanges"
        >
          撤销更改
        </a-button>
        <a-button 
          size="small" 
          @click="downloadFile" 
          :loading="downloading"
        >
          下载
        </a-button>
        <a-switch
          v-model:checked="readOnly"
          size="small"
          checked-children="只读"
          un-checked-children="编辑"
          :disabled="chunkedLoadingActive"
          style="margin-left: 8px;"
        />
      </div>
    </div>
    
    <div class="editor-content" ref="editorContainer">
      <div class="editor-surface">
        <div v-if="chunkedLoadingActive" class="large-file-toolbar">
          <div class="large-file-summary">
            已加载 {{ formatFileSize(loadedBytes) }} / {{ formatFileSize(totalBytes) }}
            <span v-if="hasMoreChunks">，已启用大日志模式</span>
          </div>
          <a-button
            size="small"
            type="primary"
            @click="loadMore"
            :loading="loadingMore"
            :disabled="!hasMoreChunks"
          >
            {{ hasMoreChunks ? '继续加载 2 MB' : '已加载完成' }}
          </a-button>
        </div>
        <div v-if="searchVisible" class="search-toolbar">
          <a-input
            ref="searchInputRef"
            :value="searchQuery"
            size="small"
            placeholder="搜索当前内容"
            @input="handleSearchInput"
            @keydown.enter.prevent="handleSearchEnter"
            @keydown.esc.prevent="closeSearch"
          />
          <span class="search-summary">
            {{ searchSummary }}
          </span>
          <a-button size="small" @click="findPrevious" :disabled="!searchQuery">
            上一个
          </a-button>
          <a-button size="small" type="primary" @click="findNext" :disabled="!searchQuery">
            下一个
          </a-button>
          <a-button size="small" @click="closeSearch">
            关闭
          </a-button>
        </div>
        <textarea
          ref="textareaRef"
          :value="fileContent"
          class="file-textarea"
          :class="{
            'is-readonly': readOnly,
            'has-large-file-toolbar': chunkedLoadingActive,
            'has-search-toolbar': searchVisible
          }"
          :readonly="readOnly"
          :spellcheck="false"
          wrap="off"
          autocapitalize="off"
          autocomplete="off"
          autocorrect="off"
          @input="handleContentInput"
        ></textarea>
      </div>
      <div v-if="loading" class="editor-loading-overlay">
        <a-spin tip="加载文件内容..." size="large" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import type { PropType } from 'vue'
import type { DownloadRequest, SftpFileEntry, ThemeName } from '../types/app'

const props = defineProps({
  fileInfo: {
    type: Object as PropType<SftpFileEntry>,
    required: true
  },
  active: {
    type: Boolean,
    default: false
  },
  connectionId: {
    type: String,
    default: null
  },
  theme: {
    type: String as PropType<ThemeName>,
    default: 'light'
  }
})

const emit = defineEmits(['startDownload'])

const LARGE_FILE_CHUNK_BYTES = 2 * 1024 * 1024

interface SftpTextChunk {
  content: string
  nextOffset: number
  totalBytes: number
  hasMore: boolean
}

// 状态管理
const editorContainer = ref<HTMLDivElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const searchInputRef = ref()
const fileContent = ref('')
const originalContent = ref('')
const readOnly = ref(false)
const hasUnsavedChanges = ref(false)
const loading = ref(false)
const saving = ref(false)
const downloading = ref(false)
const loadingMore = ref(false)
const loadedBytes = ref(0)
const totalBytes = ref(0)
const hasMoreChunks = ref(false)
const chunkedLoadingActive = ref(false)
const searchVisible = ref(false)
const searchQuery = ref('')
const searchMatchIndex = ref(0)
const searchMatchCount = ref(0)

function isReadOnlyByDefault(filename: string, size?: number) {
  const ext = filename.split('.').pop()?.toLowerCase()
  const largeFileThreshold = 256 * 1024
  const readOnlyExtensions = new Set(['log', 'txt', 'out', 'trace'])
  return readOnlyExtensions.has(ext || '') || (size || 0) >= largeFileThreshold
}

function isImmersiveFile(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase()
  return ['log', 'txt', 'out', 'trace'].includes(ext || '')
}

const immersiveReadonly = computed(() => readOnly.value && isImmersiveFile(props.fileInfo.name))
const shouldUseChunkedLoading = computed(() => (
  isImmersiveFile(props.fileInfo.name) && (props.fileInfo.size || 0) > LARGE_FILE_CHUNK_BYTES
))
const searchSummary = computed(() => {
  if (!searchQuery.value) {
    return chunkedLoadingActive.value ? '搜索仅针对已加载内容' : '输入关键字后回车搜索'
  }

  if (!searchMatchCount.value) {
    return '未找到'
  }

  const base = `${searchMatchIndex.value}/${searchMatchCount.value}`
  return chunkedLoadingActive.value ? `${base}，仅在已加载内容中搜索` : base
})

function resetEditorMode() {
  readOnly.value = chunkedLoadingActive.value || isReadOnlyByDefault(props.fileInfo.name, props.fileInfo.size)
  hasUnsavedChanges.value = false
}

function handleContentInput() {
  const nextValue = textareaRef.value?.value ?? fileContent.value
  if (readOnly.value) {
    fileContent.value = originalContent.value
    return
  }

  fileContent.value = nextValue
  hasUnsavedChanges.value = true
}

function resetLoadState() {
  fileContent.value = ''
  originalContent.value = ''
  loadedBytes.value = 0
  totalBytes.value = props.fileInfo.size || 0
  hasMoreChunks.value = false
  chunkedLoadingActive.value = false
  loadingMore.value = false
}

function countMatches(query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return 0

  const haystack = fileContent.value.toLowerCase()
  let count = 0
  let fromIndex = 0

  while (fromIndex <= haystack.length) {
    const index = haystack.indexOf(needle, fromIndex)
    if (index === -1) break
    count += 1
    fromIndex = index + needle.length
  }

  return count
}

function getOccurrenceIndex(targetIndex: number, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return 0

  const haystack = fileContent.value.toLowerCase()
  let occurrence = 0
  let fromIndex = 0

  while (fromIndex <= haystack.length) {
    const index = haystack.indexOf(needle, fromIndex)
    if (index === -1 || index > targetIndex) break
    occurrence += 1
    if (index === targetIndex) break
    fromIndex = index + needle.length
  }

  return occurrence
}

function measureLineWidth(text: string, textarea: HTMLTextAreaElement) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return 0

  const styles = window.getComputedStyle(textarea)
  context.font = [
    styles.fontStyle,
    styles.fontVariant,
    styles.fontWeight,
    styles.fontSize,
    styles.fontFamily,
  ].filter(Boolean).join(' ')

  return context.measureText(text).width
}

function scrollSelectionIntoView(index: number) {
  const textarea = textareaRef.value
  if (!textarea) return

  const styles = window.getComputedStyle(textarea)
  const fontSize = parseFloat(styles.fontSize || '13')
  const lineHeight = Number.isFinite(parseFloat(styles.lineHeight))
    ? parseFloat(styles.lineHeight)
    : fontSize * 1.6

  const beforeText = fileContent.value.slice(0, index)
  const lineNumber = beforeText.split('\n').length - 1
  const lineStart = beforeText.lastIndexOf('\n') + 1
  const currentLineText = fileContent.value.slice(lineStart, index)

  const targetTop = Math.max(0, lineNumber * lineHeight - textarea.clientHeight / 2 + lineHeight)
  const targetLeft = Math.max(0, measureLineWidth(currentLineText, textarea) - textarea.clientWidth / 2)

  textarea.scrollTop = targetTop
  textarea.scrollLeft = targetLeft
}

function selectMatch(index: number, query: string) {
  const textarea = textareaRef.value
  if (!textarea) return

  const end = index + query.length
  textarea.focus()
  textarea.setSelectionRange(index, end)
  searchMatchIndex.value = getOccurrenceIndex(index, query)
  requestAnimationFrame(() => {
    scrollSelectionIntoView(index)
  })
}

function runSearch(forward = true) {
  const textarea = textareaRef.value
  const query = searchQuery.value.trim()
  if (!textarea || !query) {
    searchMatchCount.value = 0
    searchMatchIndex.value = 0
    return
  }

  const haystack = fileContent.value.toLowerCase()
  const needle = query.toLowerCase()
  searchMatchCount.value = countMatches(query)

  if (!searchMatchCount.value) {
    searchMatchIndex.value = 0
    return
  }

  const selectionStart = textarea.selectionStart ?? 0
  const selectionEnd = textarea.selectionEnd ?? 0

  let index = -1
  if (forward) {
    const searchFrom = selectionEnd < haystack.length ? selectionEnd : 0
    index = haystack.indexOf(needle, searchFrom)
    if (index === -1 && searchFrom > 0) {
      index = haystack.indexOf(needle, 0)
    }
  } else {
    const searchFrom = selectionStart > 0 ? selectionStart - 1 : haystack.length
    index = haystack.lastIndexOf(needle, searchFrom)
    if (index === -1 && searchFrom < haystack.length) {
      index = haystack.lastIndexOf(needle)
    }
  }

  if (index === -1) {
    searchMatchIndex.value = 0
    return
  }

  selectMatch(index, query)
}

function openSearch() {
  searchVisible.value = true
  const textarea = textareaRef.value
  const selectedText = textarea
    ? fileContent.value.slice(textarea.selectionStart ?? 0, textarea.selectionEnd ?? 0).trim()
    : ''

  if (selectedText && selectedText.length <= 120 && !selectedText.includes('\n')) {
    searchQuery.value = selectedText
    searchMatchCount.value = countMatches(selectedText)
  }

  nextTick(() => {
    const input = searchInputRef.value?.input ?? searchInputRef.value
    input?.focus?.()
    input?.select?.()
  })
}

function closeSearch() {
  searchVisible.value = false
  searchMatchIndex.value = 0
  searchMatchCount.value = 0
  textareaRef.value?.focus()
}

function handleSearchInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  searchQuery.value = value
  searchMatchCount.value = countMatches(value)
  searchMatchIndex.value = 0
}

function handleSearchEnter(event: KeyboardEvent) {
  runSearch(!event.shiftKey)
}

function findNext() {
  runSearch(true)
}

function findPrevious() {
  runSearch(false)
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (!props.active) return

  const isFindShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f'
  if (isFindShortcut) {
    event.preventDefault()
    openSearch()
    return
  }

  if (!searchVisible.value) return

  if (event.key === 'Escape') {
    event.preventDefault()
    closeSearch()
  }
}

async function appendChunk(offset: number, replaceContent = false) {
  if (!props.connectionId) return

  const chunk = await invoke<SftpTextChunk>('read_sftp_file_chunk', {
    connectionId: props.connectionId,
    path: props.fileInfo.path,
    offset,
    maxBytes: LARGE_FILE_CHUNK_BYTES
  })

  const textarea = textareaRef.value
  const wasNearBottom = textarea
    ? textarea.scrollTop + textarea.clientHeight >= textarea.scrollHeight - 24
    : false

  fileContent.value = replaceContent ? chunk.content : `${fileContent.value}${chunk.content}`
  originalContent.value = fileContent.value
  loadedBytes.value = chunk.nextOffset
  totalBytes.value = chunk.totalBytes
  hasMoreChunks.value = chunk.hasMore
  chunkedLoadingActive.value = true
  resetEditorMode()

  requestAnimationFrame(() => {
    if (textareaRef.value && wasNearBottom) {
      textareaRef.value.scrollTop = textareaRef.value.scrollHeight
    }
  })
}

// 加载文件内容
async function loadFileContent() {
  if (!props.active || !props.connectionId) return
  
  loading.value = true
  try {
    resetLoadState()
    if (shouldUseChunkedLoading.value) {
      await appendChunk(0, true)
    } else {
      const content = await invoke<string>('read_sftp_file', { 
        connectionId: props.connectionId,
        path: props.fileInfo.path 
      })
      fileContent.value = content
      originalContent.value = content
      resetEditorMode()
    }
  } catch (error) {
    console.error('加载文件失败:', error)
    const errorMessage = String(error)
    if (errorMessage.includes('UTF-') || errorMessage.includes('纯文本') || errorMessage.includes('空字节')) {
      message.warning('无法加载非文本文件，请下载后查看')
    } else {
      message.error('加载文件失败: ' + errorMessage)
    }
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!props.connectionId || !hasMoreChunks.value || loadingMore.value) return

  loadingMore.value = true
  try {
    await appendChunk(loadedBytes.value)
  } catch (error) {
    console.error('继续加载文件失败:', error)
    message.error(`继续加载失败: ${String(error)}`)
  } finally {
    loadingMore.value = false
  }
}

// 保存文件
async function saveFile() {
  if (!props.connectionId || readOnly.value || chunkedLoadingActive.value) return
  
  saving.value = true
  try {
    const content = fileContent.value
    await invoke('write_sftp_file', {
      connectionId: props.connectionId,
      path: props.fileInfo.path,
      content: content
    })
    
    originalContent.value = content
    hasUnsavedChanges.value = false
    message.success('文件保存成功')
  } catch (error) {
    console.error('保存文件失败:', error)
    if (typeof error === 'string') {
      if (error.includes('权限')) {
        message.error('保存文件失败: 权限不足，请检查文件权限')
      } else {
        message.error('保存文件失败: ' + error)
      }
    } else {
      message.error('保存文件失败: 未知错误')
    }
  } finally {
    saving.value = false
  }
}

// 撤销更改
function discardChanges() {
  fileContent.value = originalContent.value
  hasUnsavedChanges.value = false
  message.info('已撤销所有更改')
}

// 下载文件
async function downloadFile() {
  if (!props.connectionId) {
    message.error('无法获取连接信息')
    return
  }
  
  downloading.value = true
  try {
    // 选择下载位置
    const savePath = await invoke<string | null>('select_download_location', {
      fileName: props.fileInfo.name
    })
    
    if (!savePath) {
      downloading.value = false
      return // 用户取消了选择
    }
    
    // 通过事件通知父组件开始下载
    emit('startDownload', {
      fileName: props.fileInfo.name,
      remotePath: props.fileInfo.path,
      savePath: savePath,
      connectionId: props.connectionId
    } satisfies DownloadRequest)
    
    message.info(`正在下载到: ${savePath}`)
  } catch (error) {
    console.error('下载文件失败:', error)
    message.error('下载文件失败: ' + error)
  } finally {
    downloading.value = false
  }
}

// 格式化文件大小
function formatFileSize(bytes?: number) {
  if (!bytes || bytes === 0) return '-'
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

// 监听只读模式切换
watch(() => readOnly.value, (newValue) => {
  if (newValue) {
    hasUnsavedChanges.value = false
  }
})

// 监听active状态变化
watch(() => props.active, async (newActive) => {
  if (newActive && !originalContent.value) {
    await loadFileContent()
  }
})

watch(() => props.fileInfo.path, () => {
  resetLoadState()
  resetEditorMode()
  closeSearch()
  if (props.active) {
    void loadFileContent()
  }
})

// 组件挂载时加载文件
onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown)
  resetEditorMode()
  if (props.active) {
    await loadFileContent()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<style scoped>
.file-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
    var(--terminal-bg);
  position: relative;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: var(--panel-header-bg);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--primary-color);
}

.file-path {
  font-size: 11px;
  color: var(--muted-color);
  font-family: monospace;
}

.file-size {
  font-size: 10px;
  color: var(--muted-color);
}

.editor-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.file-editor--immersive .editor-header {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  padding: 0;
  border-bottom: none;
  background: transparent;
  pointer-events: none;
}

.file-editor--immersive .file-info {
  display: none;
}

.file-editor--immersive .editor-actions {
  padding: 7px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface-1) 92%, transparent);
  box-shadow:
    0 10px 24px rgba(41, 71, 116, 0.1),
    inset 0 0 0 1px rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(16px);
  pointer-events: auto;
}

.editor-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  min-height: 0;
  padding: 0;
}

.editor-surface {
  position: absolute;
  inset: 0;
  min-height: 0;
}

.large-file-toolbar {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface-1) 94%, transparent);
  box-shadow:
    0 14px 28px rgba(41, 71, 116, 0.14),
    inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(16px);
}

.search-toolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface-1) 96%, transparent);
  box-shadow:
    0 14px 28px rgba(41, 71, 116, 0.1),
    inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(16px);
}

.search-toolbar :deep(.ant-input-affix-wrapper),
.search-toolbar :deep(.ant-input) {
  min-width: 220px;
}

.search-summary {
  min-width: 110px;
  font-size: 11px;
  color: var(--muted-color);
  white-space: nowrap;
}

.large-file-summary {
  font-size: 11px;
  color: var(--muted-color);
  white-space: nowrap;
}

.file-textarea {
  display: block;
  width: 100%;
  height: 100%;
  padding: 14px 16px 20px;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--text-color);
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  letter-spacing: 0;
  tab-size: 2;
  overflow: auto;
}

.file-editor--immersive .file-textarea {
  padding-top: 16px;
}

.file-textarea.has-search-toolbar {
  padding-top: 64px;
}

.file-textarea.has-large-file-toolbar {
  padding-bottom: 76px;
}

.file-textarea.is-readonly {
  cursor: default;
}

.editor-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--surface-1) 72%, transparent);
  backdrop-filter: blur(6px);
}
</style>
