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
        <div v-if="chunkedLoadingActive && searchVisible" class="search-toolbar">
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

        <div
          v-show="!chunkedLoadingActive"
          ref="monacoContainer"
          class="monaco-host"
          :class="{ 'monaco-host--search-offset': searchVisible }"
        ></div>

        <textarea
          v-show="chunkedLoadingActive"
          ref="textareaRef"
          :value="fileContent"
          class="file-textarea"
          :class="{
            'is-readonly': readOnly,
            'has-large-file-toolbar': chunkedLoadingActive,
            'has-search-toolbar': chunkedLoadingActive && searchVisible
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
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import type { editor } from 'monaco-editor'
import type { PropType } from 'vue'
import SftpService from '../services/SftpService'
import type { DownloadRequest, SftpFileEntry, ThemeName } from '../types/app'
import { formatBytes } from '../utils/formatters'

type MonacoApi = typeof import('monaco-editor')
type MonacoEditorInstance = editor.IStandaloneCodeEditor
type MonacoModel = editor.ITextModel
type MonacoDisposable = { dispose: () => void }
type MonacoEnvironmentShape = {
  getWorker?: (workerId: string, label: string) => Worker
}

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
const LARGE_FILE_READONLY_BYTES = 256 * 1024

interface SftpTextChunk {
  content: string
  nextOffset: number
  totalBytes: number
  hasMore: boolean
}

const languageContributionLoaders: Record<string, () => Promise<unknown>> = {
  bat: () => import('monaco-editor/esm/vs/basic-languages/bat/bat.contribution'),
  c: () => import('monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution'),
  cpp: () => import('monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution'),
  csharp: () => import('monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution'),
  css: () => import('monaco-editor/esm/vs/language/css/monaco.contribution'),
  go: () => import('monaco-editor/esm/vs/basic-languages/go/go.contribution'),
  html: () => import('monaco-editor/esm/vs/language/html/monaco.contribution'),
  ini: () => import('monaco-editor/esm/vs/basic-languages/ini/ini.contribution'),
  java: () => import('monaco-editor/esm/vs/basic-languages/java/java.contribution'),
  javascript: () => import('monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution'),
  json: () => import('monaco-editor/esm/vs/language/json/monaco.contribution'),
  less: () => import('monaco-editor/esm/vs/basic-languages/less/less.contribution'),
  markdown: () => import('monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution'),
  php: () => import('monaco-editor/esm/vs/basic-languages/php/php.contribution'),
  powershell: () => import('monaco-editor/esm/vs/basic-languages/powershell/powershell.contribution'),
  python: () => import('monaco-editor/esm/vs/basic-languages/python/python.contribution'),
  ruby: () => import('monaco-editor/esm/vs/basic-languages/ruby/ruby.contribution'),
  rust: () => import('monaco-editor/esm/vs/basic-languages/rust/rust.contribution'),
  shell: () => import('monaco-editor/esm/vs/basic-languages/shell/shell.contribution'),
  sql: () => import('monaco-editor/esm/vs/basic-languages/sql/sql.contribution'),
  typescript: () => import('monaco-editor/esm/vs/language/typescript/monaco.contribution'),
  xml: () => import('monaco-editor/esm/vs/basic-languages/xml/xml.contribution'),
  yaml: () => import('monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution'),
}

const loadedLanguages = new Set<string>()

let monacoPromise: Promise<MonacoApi> | null = null
let monacoEditorInstance: MonacoEditorInstance | null = null
let monacoModel: MonacoModel | null = null
let monacoDisposables: MonacoDisposable[] = []
let monacoResizeObserver: ResizeObserver | null = null

function ensureMonacoEnvironment() {
  const globalScope = globalThis as typeof globalThis & { MonacoEnvironment?: MonacoEnvironmentShape }
  if (globalScope.MonacoEnvironment?.getWorker) return

  globalScope.MonacoEnvironment = {
    getWorker(_: string, label: string) {
      if (label === 'json') {
        return new jsonWorker()
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new cssWorker()
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new htmlWorker()
      }
      if (label === 'typescript' || label === 'javascript') {
        return new tsWorker()
      }
      return new editorWorker()
    }
  }
}

async function loadMonaco() {
  if (!monacoPromise) {
    ensureMonacoEnvironment()
    monacoPromise = import('monaco-editor')
  }

  return monacoPromise
}

async function ensureLanguageContribution(language: string) {
  const normalized = languageContributionLoaders[language] ? language : 'plaintext'
  if (loadedLanguages.has(normalized)) return

  const loader = languageContributionLoaders[normalized]
  if (!loader) return

  await loader()
  loadedLanguages.add(normalized)
}

function getEditorLanguage(filename: string) {
  const extension = filename.split('.').pop()?.toLowerCase() ?? ''
  return SftpService.getLanguageByExtension(extension)
}

function getEditorUri(monaco: MonacoApi) {
  return monaco.Uri.from({
    scheme: 'file',
    path: props.fileInfo.path
  })
}

function getMonacoThemeName() {
  return props.theme === 'dark' ? 'vs-dark' : 'vs'
}

function updateDirtyState(nextValue: string) {
  fileContent.value = nextValue
  hasUnsavedChanges.value = !readOnly.value && nextValue !== originalContent.value
}

function syncMonacoValue(nextValue: string) {
  if (!monacoEditorInstance || !monacoModel) return
  if (monacoModel.getValue() === nextValue) return

  const selection = monacoEditorInstance.getSelection()
  monacoModel.setValue(nextValue)
  if (selection) {
    monacoEditorInstance.setSelection(selection)
  }
}

function disposeMonacoEditor() {
  monacoDisposables.forEach((disposable) => disposable.dispose())
  monacoDisposables = []
  monacoResizeObserver?.disconnect()
  monacoResizeObserver = null
  monacoEditorInstance?.dispose()
  monacoEditorInstance = null
  monacoModel?.dispose()
  monacoModel = null
}

async function initMonacoEditor() {
  if (chunkedLoadingActive.value || !monacoContainer.value) return

  const monaco = await loadMonaco()
  const language = getEditorLanguage(props.fileInfo.name)
  await ensureLanguageContribution(language)

  const uri = getEditorUri(monaco)
  monacoModel?.dispose()
  monacoModel = monaco.editor.createModel(fileContent.value, language, uri)

  monacoEditorInstance?.dispose()
  monacoEditorInstance = monaco.editor.create(monacoContainer.value, {
    automaticLayout: false,
    fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
    fontLigatures: false,
    fontSize: 12,
    glyphMargin: false,
    lineDecorationsWidth: 10,
    lineNumbers: 'on',
    minimap: { enabled: false },
    model: monacoModel,
    padding: { top: 14, bottom: 20 },
    readOnly: readOnly.value,
    renderLineHighlight: 'line',
    roundedSelection: false,
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    tabSize: 2,
    theme: getMonacoThemeName(),
    wordWrap: 'off'
  })

  monacoDisposables = [
    monacoEditorInstance.onDidChangeModelContent(() => {
      const nextValue = monacoModel?.getValue() ?? ''
      updateDirtyState(nextValue)
    })
  ]

  monacoResizeObserver?.disconnect()
  monacoResizeObserver = new ResizeObserver(() => {
    monacoEditorInstance?.layout()
  })
  monacoResizeObserver.observe(monacoContainer.value)

  await nextTick()
  monacoEditorInstance.layout()
}

async function refreshMonacoEditor() {
  if (chunkedLoadingActive.value) {
    disposeMonacoEditor()
    return
  }

  if (!monacoEditorInstance || !monacoModel) {
    await initMonacoEditor()
    return
  }

  const monaco = await loadMonaco()
  const language = getEditorLanguage(props.fileInfo.name)
  await ensureLanguageContribution(language)

  monaco.editor.setTheme(getMonacoThemeName())
  monaco.editor.setModelLanguage(monacoModel, language)
  monacoEditorInstance.updateOptions({
    readOnly: readOnly.value
  })
  syncMonacoValue(fileContent.value)
  monacoEditorInstance.layout()
}

// 状态管理
const editorContainer = ref<HTMLDivElement | null>(null)
const monacoContainer = ref<HTMLDivElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const searchInputRef = ref()
const fileContent = ref('')
const originalContent = ref('')
const hasLoaded = ref(false)
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
  const readOnlyExtensions = new Set(['log', 'txt', 'out', 'trace'])
  return readOnlyExtensions.has(ext || '') || (size || 0) >= LARGE_FILE_READONLY_BYTES
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
    return chunkedLoadingActive.value ? '搜索仅针对已加载内容' : 'Monaco 自带搜索'
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

  updateDirtyState(nextValue)
}

function resetLoadState() {
  fileContent.value = ''
  originalContent.value = ''
  hasLoaded.value = false
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
  if (!chunkedLoadingActive.value) return

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
  if (isFindShortcut && chunkedLoadingActive.value) {
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
  hasLoaded.value = true
  loadedBytes.value = chunk.nextOffset
  totalBytes.value = chunk.totalBytes
  hasMoreChunks.value = chunk.hasMore
  chunkedLoadingActive.value = true
  resetEditorMode()
  disposeMonacoEditor()

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
      hasLoaded.value = true
      resetEditorMode()
      await nextTick()
      await refreshMonacoEditor()
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
    const content = monacoModel?.getValue() ?? fileContent.value
    await invoke('write_sftp_file', {
      connectionId: props.connectionId,
      path: props.fileInfo.path,
      content
    })

    originalContent.value = content
    updateDirtyState(content)
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
  syncMonacoValue(originalContent.value)
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
    const savePath = await invoke<string | null>('select_download_location', {
      fileName: props.fileInfo.name
    })

    if (!savePath) {
      downloading.value = false
      return
    }

    emit('startDownload', {
      fileName: props.fileInfo.name,
      remotePath: props.fileInfo.path,
      savePath,
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

const formatFileSize = (bytes?: number) => formatBytes(bytes, { emptyValue: '-' })

watch(() => readOnly.value, async (newValue) => {
  if (newValue) {
    hasUnsavedChanges.value = false
  } else {
    hasUnsavedChanges.value = fileContent.value !== originalContent.value
  }

  if (!chunkedLoadingActive.value) {
    await refreshMonacoEditor()
  }
})

watch(() => props.active, async (newActive) => {
  if (!newActive) return

  if (!hasLoaded.value) {
    await loadFileContent()
    return
  }

  await nextTick()
  await refreshMonacoEditor()
})

watch(() => props.fileInfo.path, async () => {
  resetLoadState()
  resetEditorMode()
  closeSearch()
  disposeMonacoEditor()
  if (props.active) {
    await loadFileContent()
  }
})

watch(() => props.theme, async () => {
  if (!chunkedLoadingActive.value) {
    await refreshMonacoEditor()
  }
})

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown)
  resetEditorMode()
  if (props.active) {
    await loadFileContent()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  disposeMonacoEditor()
})
</script>

<style scoped>
.file-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 0;
  background: var(--surface-1);
  position: relative;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--surface-1);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-color);
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
  flex-wrap: wrap;
}

.file-editor--immersive .editor-header {
  position: relative;
  top: auto;
  right: auto;
  z-index: 1;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  background: var(--surface-1);
  pointer-events: auto;
}

.file-editor--immersive .file-info {
  display: flex;
}

.file-editor--immersive .editor-actions {
  padding: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
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
  right: 14px;
  top: 14px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-1) 96%, transparent);
  box-shadow: none;
  backdrop-filter: none;
}

.search-toolbar {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-1) 96%, transparent);
  box-shadow: none;
  backdrop-filter: none;
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

.monaco-host {
  width: 100%;
  height: 100%;
  background: transparent;
}

.file-editor--immersive .monaco-host {
  padding-top: 0;
}

.file-textarea {
  display: block;
  width: 100%;
  height: 100%;
  padding: 14px 16px 18px;
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
  padding-top: 14px;
}

.file-textarea.has-search-toolbar {
  padding-top: 58px;
}

.file-textarea.has-large-file-toolbar {
  padding-top: 60px;
  padding-bottom: 18px;
}

.file-textarea.is-readonly {
  cursor: default;
}

.editor-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--surface-1) 84%, transparent);
  backdrop-filter: none;
}
</style>
