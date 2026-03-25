<template>
  <div
    class="terminal-area"
    :class="[`terminal-area--${theme}`, `terminal-area--${density}`, { 'is-active': active }]"
  >
    <div class="terminal-frame">
      <div ref="container" class="terminal-container" />
      <span ref="measureProbe" class="terminal-measure-probe" :style="measureProbeStyle">M</span>
      <div
        v-if="suggestionOverlayVisible"
        class="terminal-inline-suggestion"
        :style="suggestionOverlayStyle"
      >
        <span v-if="suggestionPrefixText" class="terminal-inline-suggestion__prefix">
          {{ suggestionPrefixText }}
        </span>
        <span class="terminal-inline-suggestion__suffix">
          {{ suggestionSuffixText }}
        </span>
      </div>
      <div v-if="showConnectionOverlay" class="terminal-connection-overlay">
        <div class="terminal-connection-overlay__badge">
          {{ sshState === 'connecting' ? '连接中' : '连接已断开' }}
        </div>
        <div class="terminal-connection-overlay__title">
          {{ overlayTitle }}
        </div>
        <div v-if="overlayMessage" class="terminal-connection-overlay__message">
          {{ overlayMessage }}
        </div>
        <div class="terminal-connection-overlay__hint">
          {{ overlayHint }}
        </div>
      </div>
    </div>
    <div v-if="hasScrollContent" class="scroll-indicator">
      <span>↑ 向上滚动查看更多内容</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { message } from 'antdv-next'
import '@xterm/xterm/css/xterm.css'
import SshService from '../services/SshService'
import TerminalSuggestionService from '../services/TerminalSuggestionService'
import { hideTerminalContextMenu, showTerminalContextMenu } from '../utils/terminalContextMenu'
import { RIGHT_PANEL_TRANSITION_END_EVENT } from '../utils/rightPanelTransition'
import type { FitAddon as XTermFitAddon } from '@xterm/addon-fit'
import type { ITheme, Terminal as XTermTerminal } from '@xterm/xterm'
import type { SshTerminalChunk } from '../services/SshService'
import type { TerminalConfig, ThemeName, WorkspaceDensity } from '../types/app'

const props = withDefaults(defineProps<{
  id: string
  active?: boolean
  theme?: ThemeName
  config?: TerminalConfig
  autoPassword?: string
  sshUser?: string
  sshHost?: string
  sshState?: 'connecting' | 'connected' | 'disconnected'
  connectionError?: string
  reconnectAttempt?: number
  reconnectScheduledAt?: number | null
}>(), {
  active: false,
  theme: 'dark',
  config: () => ({
    fontSize: 13,
    fontFamily: 'Consolas, monospace',
    cursorBlink: true,
    cursorStyle: 'block',
    density: 'compact',
    hostCenterViewMode: 'list',
  }),
  autoPassword: '',
  sshUser: '',
  sshHost: '',
  sshState: 'connected',
  connectionError: '',
  reconnectAttempt: 0,
  reconnectScheduledAt: null,
})

const emit = defineEmits<{
  close: []
  reconnect: []
  currentDirectoryChange: [path: string]
  terminalInput: [data: string]
}>()

const container = ref<HTMLElement | null>(null)
const measureProbe = ref<HTMLElement | null>(null)
const terminal = ref<XTermTerminal | null>(null)
const fitAddon = ref<XTermFitAddon | null>(null)
const nowTs = ref(Date.now())
const density = computed<WorkspaceDensity>(() => props.config.density || 'balanced')
const showConnectionOverlay = computed(() => props.sshState !== 'connected')
const hasScrollContent = computed(() => {
  if (!terminal.value) return false
  return terminal.value.buffer.active.viewportY > 0
})
const reconnectCountdownSeconds = computed(() => {
  if (!props.reconnectScheduledAt) return 0
  return Math.max(0, Math.ceil((props.reconnectScheduledAt - nowTs.value) / 1000))
})
const overlayTitle = computed(() => {
  if (props.sshState === 'connecting') {
    return props.reconnectAttempt ? `正在进行第 ${props.reconnectAttempt} 次重连` : '正在建立 SSH 连接'
  }
  return props.connectionError || 'SSH 会话已断开'
})
const overlayMessage = computed(() => {
  if (props.sshState === 'connecting') {
    return props.connectionError || ''
  }
  if (props.reconnectScheduledAt && reconnectCountdownSeconds.value > 0) {
    return `将在 ${reconnectCountdownSeconds.value} 秒后自动重试`
  }
  return ''
})
const overlayHint = computed(() => (
  props.sshState === 'connecting'
    ? '请稍候，连接恢复后会继续显示终端内容。'
    : '按回车立即手动重连，或等待自动重试。'
))

const suggestionPrefixText = ref('')
const suggestionSuffixText = ref('')
const suggestionOverlayVisible = ref(false)
const suggestionOverlayStyle = ref<Record<string, string>>({})
const measureProbeStyle = computed(() => ({
  fontFamily: props.config.fontFamily,
  fontSize: `${props.config.fontSize}px`,
  lineHeight: String(resolveTerminalLineHeight(density.value)),
}))

let unbindSession: (() => Promise<void>) | null = null
let lastReceivedSeq = 0
let lastSyncedCols = 0
let lastSyncedRows = 0
let reconnectTickTimer: number | null = null
let contextMenuCleanup: (() => void) | null = null
let resizeTimer: number | null = null
let measureProbeObserver: ResizeObserver | null = null
let cachedCellSize: { width: number; height: number } | null = null

let promptBuffer = ''
let shellCwd = ''
let previousShellCwd = ''
let inputBuffer = ''
let pendingPromptDirectory = ''
let pendingPromptDirectoryHasError = false
let pendingReconnectEnter = false
let suggestionHistoryHydrated = false
let suggestionCommand = ''
let suggestionSuffix = ''

const BOOTSTRAP_HISTORY_PATTERNS = [
  '__TERMLINK_BOOTSTRAP=1;',
  'TERMLINK_SHELL_INTEGRATION_READY',
  '__termlink_emit_cwd',
  'TERMLINK_PROMPT_START',
  'TERMLINK_PROMPT_END',
]

const themes: Record<ThemeName, ITheme> = {
  dark: {
    background: '#0b0e14',
    foreground: '#ffffff',
    cursor: '#ffffff',
    selectionBackground: '#264f78',
    selectionForeground: '#ffffff',
    black: '#000000',
    red: '#e06c75',
    green: '#98c379',
    yellow: '#d19a66',
    blue: '#61afef',
    magenta: '#c678dd',
    cyan: '#56b6c2',
    white: '#ffffff',
    brightBlack: '#5c6370',
    brightRed: '#e06c75',
    brightGreen: '#98c379',
    brightYellow: '#d19a66',
    brightBlue: '#61afef',
    brightMagenta: '#c678dd',
    brightCyan: '#56b6c2',
    brightWhite: '#ffffff',
  },
  light: {
    background: '#0b0e14',
    foreground: '#ffffff',
    cursor: '#ffffff',
    selectionBackground: '#264f78',
    selectionForeground: '#ffffff',
    black: '#000000',
    red: '#e06c75',
    green: '#98c379',
    yellow: '#d19a66',
    blue: '#61afef',
    magenta: '#c678dd',
    cyan: '#56b6c2',
    white: '#ffffff',
    brightBlack: '#5c6370',
    brightRed: '#e06c75',
    brightGreen: '#98c379',
    brightYellow: '#d19a66',
    brightBlue: '#61afef',
    brightMagenta: '#c678dd',
    brightCyan: '#56b6c2',
    brightWhite: '#ffffff',
  },
}

function resolveTerminalLineHeight(nextDensity: WorkspaceDensity) {
  if (nextDensity === 'comfortable') return 1.12
  if (nextDensity === 'balanced') return 1.06
  return 1.01
}

function getSuggestionScope() {
  return {
    terminalType: 'ssh' as const,
    host: props.sshHost,
    user: props.sshUser,
    cwd: shellCwd,
  }
}

function getHistorySeedScope() {
  return {
    ...getSuggestionScope(),
    cwd: '',
  }
}

function clearSuggestion() {
  suggestionCommand = ''
  suggestionSuffix = ''
  suggestionPrefixText.value = ''
  suggestionSuffixText.value = ''
  suggestionOverlayVisible.value = false
  suggestionOverlayStyle.value = {}
}

function getPromptPatterns() {
  return [
    /^\[[^@\]]+@[^ ]+\s+[^\]]+\][#$]\s*/,
    /^[^@\s]+@[^:\s]+:[^\s]+[#$]\s*/,
  ]
}

function getActiveLogicalLine() {
  const term = terminal.value
  if (!term) return ''

  const buffer = term.buffer.active
  const currentIndex = buffer.baseY + buffer.cursorY
  let startIndex = currentIndex
  let endIndex = currentIndex

  while (startIndex > 0 && buffer.getLine(startIndex)?.isWrapped) {
    startIndex -= 1
  }

  while (buffer.getLine(endIndex + 1)?.isWrapped) {
    endIndex += 1
  }

  let text = ''
  for (let index = startIndex; index <= endIndex; index += 1) {
    text += stripAnsi(buffer.getLine(index)?.translateToString(true) || '')
  }
  return text
}

function hasVisiblePromptPrefix() {
  const currentLine = getActiveLogicalLine()
  return getPromptPatterns().some((pattern) => pattern.test(currentLine))
}

function canShowSuggestion() {
  return props.active && props.sshState === 'connected' && hasVisiblePromptPrefix()
}

function getMeasuredCellSize() {
  if (cachedCellSize) return cachedCellSize
  if (!measureProbe.value) {
    return {
      width: Math.max(8, props.config.fontSize * 0.62),
      height: Math.max(16, props.config.fontSize * resolveTerminalLineHeight(density.value)),
    }
  }
  const rect = measureProbe.value.getBoundingClientRect()
  cachedCellSize = {
    width: Math.max(8, rect.width),
    height: Math.max(16, rect.height),
  }
  return cachedCellSize
}

function invalidateCellSizeCache() {
  cachedCellSize = null
}

function getTerminalTextColumns(value: string) {
  return Array.from(value).length
}

function getVisibleInputPrefix() {
  const currentLine = getActiveLogicalLine()
  for (const pattern of getPromptPatterns()) {
    const matched = currentLine.match(pattern)
    if (matched) {
      return currentLine.slice(matched[0].length)
    }
  }
  return ''
}

function syncInputBufferFromPrompt() {
  inputBuffer = getVisibleInputPrefix()
}

function getPendingInputText() {
  if (!inputBuffer) return ''
  const localChars = Array.from(inputBuffer)
  const visibleChars = Array.from(getVisibleInputPrefix())
  let sharedLength = 0
  while (
    sharedLength < localChars.length
    && sharedLength < visibleChars.length
    && localChars[sharedLength] === visibleChars[sharedLength]
  ) {
    sharedLength += 1
  }
  return localChars.slice(sharedLength).join('')
}

function getPendingInputColumns() {
  return getTerminalTextColumns(getPendingInputText())
}

function renderSuggestionOverlay() {
  const term = terminal.value
  if (!term || !suggestionSuffix || !container.value) {
    suggestionOverlayVisible.value = false
    return
  }

  const containerLeft = container.value.offsetLeft
  const containerTop = container.value.offsetTop
  const textareaLeft = Number.parseFloat(term.textarea?.style.left || '0')
  const textareaTop = Number.parseFloat(term.textarea?.style.top || '0')
  const textareaHeight = Number.parseFloat(term.textarea?.style.height || '0')
  const textareaLineHeight = term.textarea?.style.lineHeight || ''
  const cell = getMeasuredCellSize()

  suggestionPrefixText.value = getPendingInputText()
  suggestionSuffixText.value = suggestionSuffix
  suggestionOverlayStyle.value = {
    left: `${containerLeft + textareaLeft}px`,
    top: `${containerTop + textareaTop}px`,
    height: `${textareaHeight || cell.height}px`,
    lineHeight: textareaLineHeight || `${cell.height}px`,
    fontFamily: props.config.fontFamily,
    fontSize: `${props.config.fontSize}px`,
  }
  suggestionOverlayVisible.value = true
}

function renderSuggestion() {
  const term = terminal.value
  if (!term || !suggestionSuffix) return
  if (!canShowSuggestion() || !inputBuffer.trim()) {
    clearSuggestion()
    return
  }
  if (term.buffer.active.cursorX + getPendingInputColumns() + getTerminalTextColumns(suggestionSuffix) >= term.cols) {
    clearSuggestion()
    return
  }
  requestAnimationFrame(() => {
    renderSuggestionOverlay()
  })
}

function refreshSuggestion() {
  if (!canShowSuggestion() || !inputBuffer.trim()) {
    clearSuggestion()
    return
  }
  const capturedInput = inputBuffer
  queueMicrotask(() => {
    if (capturedInput !== inputBuffer) return
    const matched = TerminalSuggestionService.query(getSuggestionScope(), capturedInput)
    if (!matched) {
      clearSuggestion()
      return
    }
    suggestionCommand = matched.command
    suggestionSuffix = matched.suffix
    renderSuggestion()
  })
}

function saveSubmittedCommand(command: string) {
  const normalized = command.trim()
  if (!normalized) return
  TerminalSuggestionService.save(getSuggestionScope(), normalized)
}

function acceptSuggestion() {
  if (!suggestionSuffix || !props.active || props.sshState !== 'connected') return
  const suffix = suggestionSuffix
  inputBuffer += suffix
  clearSuggestion()
  SshService.writeTerminal(props.id, suffix).catch(() => {})
}

function hasActiveSuggestion() {
  return Boolean(suggestionSuffix && suggestionOverlayVisible.value)
}

function stripAnsi(value: string) {
  return value
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b[@-_]/g, '')
}

function normalizePosixPath(path: string) {
  const segments = path.split('/')
  const normalized: string[] = []
  for (const segment of segments) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      normalized.pop()
      continue
    }
    normalized.push(segment)
  }
  return `/${normalized.join('/')}`.replace(/\/+/g, '/')
}

function getUserHomePath() {
  if (!props.sshUser) return ''
  return props.sshUser === 'root' ? '/root' : `/home/${props.sshUser}`
}

function resolvePromptPath(token: string) {
  const value = token.trim()
  if (!value) return ''
  if (value === '~') return getUserHomePath()
  if (value.startsWith('~/')) {
    const home = getUserHomePath()
    return home ? normalizePosixPath(`${home}/${value.slice(2)}`) : ''
  }
  if (value.startsWith('/')) return normalizePosixPath(value)
  return ''
}

function clearPendingPromptDirectory() {
  pendingPromptDirectory = ''
  pendingPromptDirectoryHasError = false
}

function unquoteShellToken(token: string) {
  if (token.length < 2) return token
  const quote = token[0]
  if ((quote === '\'' || quote === '"') && token[token.length - 1] === quote) {
    return token.slice(1, -1)
  }
  return token
}

function resolveTrackedCdPath(rawTarget: string) {
  const target = unquoteShellToken(rawTarget.trim())
  if (!target || target === '~') return getUserHomePath()
  if (target === '-') return previousShellCwd || ''
  const promptPath = resolvePromptPath(target)
  if (promptPath) return promptPath
  if (!shellCwd) return ''
  return normalizePosixPath(`${shellCwd}/${target}`)
}

function parseTrackedCdCommand(command: string) {
  const trimmed = command.trim()
  if (!trimmed) return ''
  if (/[|&;()`]/.test(trimmed)) return ''
  if (/^\s*(?:builtin\s+|command\s+)?cd(?:\s+--)?\s*$/.test(trimmed)) {
    return getUserHomePath()
  }

  const matched = trimmed.match(/^\s*(?:builtin\s+|command\s+)?cd(?:\s+--)?\s+(.+?)\s*$/)
  if (!matched) return ''

  const target = matched[1].trim()
  if (!target || /\s{2,}/.test(target)) return ''
  if (/\s/.test(target) && !(target.startsWith('"') || target.startsWith('\''))) return ''
  return resolveTrackedCdPath(target)
}

function trackTerminalInput(data: string) {
  const submittedCommands: string[] = []

  if (data.includes('\u001b')) {
    inputBuffer = ''
    clearSuggestion()
    return submittedCommands
  }

  for (const char of data) {
    if (char === '\r' || char === '\n') {
      const submittedCommand = inputBuffer.trim()
      const nextPath = parseTrackedCdCommand(inputBuffer)
      if (nextPath) {
        pendingPromptDirectory = nextPath
        pendingPromptDirectoryHasError = false
      } else {
        clearPendingPromptDirectory()
      }
      if (submittedCommand && hasVisiblePromptPrefix()) {
        submittedCommands.push(submittedCommand)
      }
      inputBuffer = ''
      continue
    }

    if (char === '\u007f') {
      inputBuffer = inputBuffer.slice(0, -1)
      continue
    }

    if (char === '\u0003' || char === '\u0004' || char === '\u0015' || char === '\u0018') {
      inputBuffer = ''
      clearPendingPromptDirectory()
      continue
    }

    if (char < ' ') continue
    inputBuffer += char
  }

  return submittedCommands
}

function updateShellDirectory(nextPath: string) {
  const normalized = normalizePosixPath(nextPath)
  if (!normalized || normalized === shellCwd) return
  previousShellCwd = shellCwd
  shellCwd = normalized
  clearPendingPromptDirectory()
  emit('currentDirectoryChange', normalized)
}

function markPendingPromptDirectoryError(output: string) {
  if (!pendingPromptDirectory) return
  const normalizedOutput = stripAnsi(output).toLowerCase()
  const failurePatterns = [
    /cd: .*no such file or directory/,
    /cd: .*not a directory/,
    /cd: .*permission denied/,
    /cd: too many arguments/,
    /can't cd to/,
    /cannot change directory/,
  ]
  if (failurePatterns.some((pattern) => pattern.test(normalizedOutput))) {
    pendingPromptDirectoryHasError = true
  }
}

function applyPromptDirectoryFallback(matchedPath: string) {
  const nextPath = resolvePromptPath(matchedPath)
  if (nextPath) {
    updateShellDirectory(nextPath)
    return
  }
  if (pendingPromptDirectory && !pendingPromptDirectoryHasError) {
    updateShellDirectory(pendingPromptDirectory)
    return
  }
  clearPendingPromptDirectory()
}

function syncDirectoryFromPrompt(output: string) {
  const sanitizedOutput = stripAnsi(output)
  markPendingPromptDirectoryError(sanitizedOutput)
  const combinedOutput = `${promptBuffer}${sanitizedOutput}`
  const lines = combinedOutput.split(/\r?\n/)
  const promptPatterns = [
    /\[[^@\]]+@[^ ]+\s+([^\]]+)\][#$]\s*$/,
    /^[^@\s]+@[^:\s]+:([^\s]+)[#$]\s*$/,
  ]
  const trailingLine = lines.pop() || ''

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue
    const matchedPath = promptPatterns
      .map((pattern) => trimmedLine.match(pattern)?.[1] || '')
      .find(Boolean)
    if (matchedPath) {
      applyPromptDirectoryFallback(matchedPath)
    }
  }

  const trimmedTrailingLine = trailingLine.trim()
  if (trimmedTrailingLine) {
    const matchedPath = promptPatterns
      .map((pattern) => trimmedTrailingLine.match(pattern)?.[1] || '')
      .find(Boolean)
    if (matchedPath) {
      applyPromptDirectoryFallback(matchedPath)
    }
  }

  promptBuffer = trailingLine.slice(-512)
}

function isBootstrapHistoryLine(value: string) {
  return BOOTSTRAP_HISTORY_PATTERNS.some((pattern) => value.includes(pattern))
}

function resetTerminalSessionState() {
  lastReceivedSeq = 0
  lastSyncedCols = 0
  lastSyncedRows = 0
  promptBuffer = ''
  shellCwd = ''
  previousShellCwd = ''
  inputBuffer = ''
  pendingReconnectEnter = false
  suggestionHistoryHydrated = false
  clearSuggestion()
  clearPendingPromptDirectory()
}

async function sanitizeShellHistoryArtifacts() {
  if (props.sshState !== 'connected') return

  try {
    await SshService.executeCommand(
      props.id,
      `sh -lc '
        for file in "$HOME/.bash_history" "$HOME/.zsh_history" "$HOME/.local/share/fish/fish_history"; do
          [ -f "$file" ] || continue
          tmp="$file.termlink.$$"
          if grep -v -E "__TERMLINK_BOOTSTRAP=1;|TERMLINK_SHELL_INTEGRATION_READY|__termlink_emit_cwd|TERMLINK_PROMPT_START|TERMLINK_PROMPT_END" "$file" > "$tmp"; then
            cat "$tmp" > "$file"
          fi
          rm -f "$tmp"
        done
      '`,
    )
  } catch (error) {
    console.warn('清理 SSH 历史中的 Termlink 注入残留失败:', error)
  }
}

function navigateShellHistory(direction: 'up' | 'down', attempt = 0) {
  if (!props.active || props.sshState !== 'connected') return
  if (attempt > 6) {
    syncInputBufferFromPrompt()
    refreshSuggestion()
    return
  }

  const sequence = direction === 'up' ? '\u001b[A' : '\u001b[B'
  SshService.writeTerminal(props.id, sequence).catch(() => {})

  window.setTimeout(() => {
    const currentLine = getActiveLogicalLine()
    if (isBootstrapHistoryLine(currentLine)) {
      navigateShellHistory(direction, attempt + 1)
      return
    }
    syncInputBufferFromPrompt()
    if (!inputBuffer.trim()) {
      clearSuggestion()
      return
    }
    refreshSuggestion()
  }, 80)
}

async function hydrateSuggestionHistory() {
  if (suggestionHistoryHydrated || props.sshState !== 'connected') return
  suggestionHistoryHydrated = true

  try {
    const rawHistory = await SshService.executeCommand(
      props.id,
      `sh -lc '
        [ -f "$HOME/.bash_history" ] && tail -n 400 "$HOME/.bash_history" 2>/dev/null || true
        [ -f "$HOME/.zsh_history" ] && tail -n 400 "$HOME/.zsh_history" 2>/dev/null | sed -E "s/^: [0-9]+:[0-9]+;//" || true
        [ -f "$HOME/.local/share/fish/fish_history" ] && tail -n 400 "$HOME/.local/share/fish/fish_history" 2>/dev/null | sed -n "s/^- cmd: //p" || true
      '`,
    )
    const seen = new Set<string>()
    const commands = rawHistory
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => {
        if (!line || seen.has(line)) return false
        seen.add(line)
        return true
      })

    if (!commands.length) return
    TerminalSuggestionService.seed(getHistorySeedScope(), commands.reverse())
    refreshSuggestion()
  } catch (error) {
    suggestionHistoryHydrated = false
    console.warn('预热 SSH 历史联想失败:', error)
  }
}

async function syncInitialDirectory() {
  if (shellCwd) return
  try {
    const pwd = await SshService.executeCommand(props.id, 'pwd')
    if (pwd) {
      updateShellDirectory(pwd)
    }
  } catch (error) {
    console.warn('获取 SSH 当前目录失败:', error)
  }
}

function applyTheme() {
  if (terminal.value) {
    terminal.value.options.theme = themes[props.theme]
  }
}

function syncSshViewport(force = false) {
  if (!terminal.value || props.sshState !== 'connected') return
  const { cols, rows } = terminal.value
  if (!cols || !rows) return
  if (!force && cols === lastSyncedCols && rows === lastSyncedRows) return
  lastSyncedCols = cols
  lastSyncedRows = rows
  SshService.resizeTerminal(props.id, cols, rows).catch(() => {})
}

function applyConfig() {
  if (!terminal.value) return
  terminal.value.options.fontSize = props.config.fontSize
  terminal.value.options.fontFamily = props.config.fontFamily
  terminal.value.options.cursorBlink = props.config.cursorBlink
  terminal.value.options.cursorStyle = props.config.cursorStyle
  terminal.value.options.lineHeight = resolveTerminalLineHeight(density.value)
  requestAnimationFrame(() => {
    applySize()
    renderSuggestion()
  })
}

function applySize() {
  if (fitAddon.value) {
    fitAddon.value.fit()
  }
  syncSshViewport()
  renderSuggestion()
}

function debouncedApplySize() {
  if (resizeTimer) cancelAnimationFrame(resizeTimer)
  resizeTimer = requestAnimationFrame(() => {
    applySize()
  })
}

function syncReconnectTicker() {
  if (reconnectTickTimer) {
    window.clearInterval(reconnectTickTimer)
    reconnectTickTimer = null
  }
  if (!props.reconnectScheduledAt) return
  nowTs.value = Date.now()
  reconnectTickTimer = window.setInterval(() => {
    nowTs.value = Date.now()
  }, 1000)
}

function showContextMenu(event: MouseEvent, term: XTermTerminal) {
  const selection = term.getSelection()
  const hasSelection = Boolean(selection && selection.length > 0)
  const menuItems = []

  if (hasSelection) {
    menuItems.push({
      label: '复制',
      action: () => {
        navigator.clipboard.writeText(selection).catch((error) => {
          console.error('复制失败:', error)
        })
      },
    })
  }

  menuItems.push({
    label: '粘贴',
    action: () => {
      navigator.clipboard.readText().then((text) => {
        if (!text || !props.active || props.sshState !== 'connected') return
        SshService.writeTerminal(props.id, text).catch(() => {})
      }).catch((error) => {
        console.error('粘贴失败:', error)
      })
    },
  })

  if (hasSelection) {
    menuItems.push({
      label: '全选',
      action: () => {
        term.selectAll()
      },
    })
  }

  menuItems.push({
    label: '清屏',
    action: () => {
      term.clear()
    },
  })

  showTerminalContextMenu(event, menuItems)
}

async function createTerminal() {
  const { Terminal } = await import('@xterm/xterm')
  const { FitAddon } = await import('@xterm/addon-fit')

  if (!container.value) return
  container.value.innerHTML = ''

  const term = new Terminal({
    convertEol: true,
    fontFamily: props.config.fontFamily,
    fontSize: props.config.fontSize,
    lineHeight: resolveTerminalLineHeight(density.value),
    cursorBlink: props.config.cursorBlink,
    cursorStyle: props.config.cursorStyle,
    theme: themes[props.theme],
    scrollback: 10000,
    allowTransparency: true,
    fastScrollModifier: 'alt',
    fastScrollSensitivity: 5,
    scrollOnUserInput: false,
    rightClickSelectsWord: false,
    wordSeparator: ' ()[]{}\',"`',
    disableStdin: false,
    macOptionIsMeta: true,
    macOptionClickForcesSelection: false,
    altClickMovesCursor: false,
  })

  const fit = new FitAddon()
  term.loadAddon(fit)

  term.onData((data) => {
    if (!props.active) return

    if (props.sshState === 'connecting') return
    if (props.sshState === 'disconnected') {
      if (data === '\r') {
        pendingReconnectEnter = true
        emit('reconnect')
      }
      return
    }

    emit('terminalInput', data)
    const submittedCommands = trackTerminalInput(data)
    submittedCommands.forEach((command) => {
      saveSubmittedCommand(command)
    })
    SshService.writeTerminal(props.id, data).catch(() => {})
    if (!inputBuffer.trim()) {
      clearSuggestion()
    } else {
      refreshSuggestion()
    }
  })

  term.onKey(({ domEvent }) => {
    if (domEvent.ctrlKey && !domEvent.metaKey && !domEvent.altKey && domEvent.key.toLowerCase() === 'e') {
      domEvent.preventDefault()
      acceptSuggestion()
      return
    }

    if (!domEvent.ctrlKey && !domEvent.metaKey && !domEvent.altKey && hasActiveSuggestion()) {
      if (domEvent.key === 'Tab' || domEvent.key === 'ArrowRight') {
        domEvent.preventDefault()
        acceptSuggestion()
        return
      }
    }

    if (!domEvent.ctrlKey && !domEvent.metaKey && !domEvent.altKey && (domEvent.key === 'ArrowUp' || domEvent.key === 'ArrowDown')) {
      domEvent.preventDefault()
      clearSuggestion()
      navigateShellHistory(domEvent.key === 'ArrowUp' ? 'up' : 'down')
      return
    }

    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Tab', 'Escape'].includes(domEvent.key)) {
      clearSuggestion()
    }

    if (domEvent.code !== 'Enter' || !props.active || props.sshState === 'connected') return
    const content = term.buffer.active.getLine(term.buffer.active.cursorY)?.translateToString() || ''
    if (
      content.includes('Connection refused')
      || content.includes('ssh:')
      || content.includes('Connection timed out')
      || content.includes('No route to host')
      || content.includes('Connection closed')
    ) {
      pendingReconnectEnter = true
      emit('reconnect')
    }
  })

  term.onResize(({ cols, rows }) => {
    lastSyncedCols = cols
    lastSyncedRows = rows
    SshService.resizeTerminal(props.id, cols, rows).catch(() => {})
  })

  terminal.value = term
  fitAddon.value = fit
  term.open(container.value)
  fit.fit()

  if (term.element) {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()
      showContextMenu(event, term)
    }
    term.element.addEventListener('contextmenu', handleContextMenu)
    contextMenuCleanup = () => {
      term.element?.removeEventListener('contextmenu', handleContextMenu)
    }
  }
}

async function bindSession() {
  if (props.sshState !== 'connected') {
    return async () => {}
  }

  let hydrating = true
  const pendingChunks: SshTerminalChunk[] = []

  const applyChunk = (chunk: SshTerminalChunk) => {
    if (!terminal.value || chunk.seq <= lastReceivedSeq) return
    const output = chunk.data
    if (output) {
      syncDirectoryFromPrompt(output)
      terminal.value.write(output)
      refreshSuggestion()
    }
    lastReceivedSeq = chunk.seq
  }

  const offData = await listen<SshTerminalChunk>(`ssh_data://${props.id}`, (event) => {
    const chunk = event.payload
    if (hydrating) {
      pendingChunks.push(chunk)
      return
    }
    applyChunk(chunk)
  })

  const offExit = await listen(`ssh_exit://${props.id}`, () => {
    emit('close')
  })

  const offError = await listen('ssh_error', (event) => {
    const payload = String(event.payload || '')
    if (!payload.startsWith(`${props.id}: `)) return
    const errorMsg = payload.slice(props.id.length + 2)
    if (terminal.value) {
      terminal.value.writeln(`\r\n\x1b[31m${errorMsg}\x1b[0m`)
    }
    message.error({
      content: errorMsg,
      duration: 8,
      style: {
        marginTop: '50px',
        maxWidth: '400px',
      },
    })
  })

  const snapshot = await SshService.readTerminalSnapshot(props.id)
  snapshot.chunks.forEach((chunk) => {
    applyChunk(chunk)
  })
  pendingChunks
    .sort((a, b) => a.seq - b.seq)
    .forEach((chunk) => {
      applyChunk(chunk)
    })
  hydrating = false

  return async () => {
    offData()
    offExit()
    offError()
  }
}

async function cleanupSession() {
  if (!unbindSession) return
  const cleanup = unbindSession
  unbindSession = null
  await cleanup()
}

async function syncSessionBinding() {
  if (!props.active || props.sshState !== 'connected') {
    await cleanupSession()
    return
  }

  if (!unbindSession) {
    unbindSession = await bindSession()
    await syncInitialDirectory()
    await sanitizeShellHistoryArtifacts()
    await hydrateSuggestionHistory()
    requestAnimationFrame(() => {
      applySize()
      syncSshViewport(true)
      terminal.value?.focus()
    })
  }
}

watch(() => props.theme, () => {
  applyTheme()
})

watch(() => props.config, () => {
  applyConfig()
}, { deep: true })

watch(() => props.active, () => {
  if (props.active) {
    requestAnimationFrame(() => {
      applySize()
      terminal.value?.focus()
    })
  } else {
    clearSuggestion()
  }
  void syncSessionBinding()
})

watch(() => props.sshState, (nextState, prevState) => {
  if (nextState === 'connecting' && prevState !== 'connecting') {
    resetTerminalSessionState()
    void cleanupSession()
    return
  }

  if (nextState === 'connected' && prevState !== 'connected') {
    resetTerminalSessionState()
    terminal.value?.clear()
    void syncSessionBinding()
  }

  if (nextState !== 'connected' && prevState === 'connected') {
    void cleanupSession()
  }

  if (nextState === 'connected' && prevState === 'disconnected' && pendingReconnectEnter) {
    pendingReconnectEnter = false
    window.setTimeout(() => {
      SshService.writeTerminal(props.id, '\r').catch(() => {})
    }, 120)
  }
})

watch(() => props.reconnectScheduledAt, () => {
  syncReconnectTicker()
}, { immediate: true })

onMounted(async () => {
  resetTerminalSessionState()
  await createTerminal()
  await syncSessionBinding()
  applyTheme()
  applyConfig()

  if (props.active) {
    requestAnimationFrame(() => {
      applySize()
      terminal.value?.focus()
    })
  }

  window.addEventListener('resize', debouncedApplySize)
  window.addEventListener(RIGHT_PANEL_TRANSITION_END_EVENT, debouncedApplySize as EventListener)

  if (measureProbe.value && typeof ResizeObserver !== 'undefined') {
    measureProbeObserver = new ResizeObserver(() => {
      invalidateCellSizeCache()
    })
    measureProbeObserver.observe(measureProbe.value)
  }
})

onBeforeUnmount(async () => {
  await cleanupSession()
  clearSuggestion()
  contextMenuCleanup?.()
  contextMenuCleanup = null
  hideTerminalContextMenu()

  if (resizeTimer) {
    cancelAnimationFrame(resizeTimer)
    resizeTimer = null
  }
  if (reconnectTickTimer) {
    window.clearInterval(reconnectTickTimer)
    reconnectTickTimer = null
  }
  measureProbeObserver?.disconnect()
  measureProbeObserver = null
  invalidateCellSizeCache()

  if (terminal.value) {
    terminal.value.dispose()
  }
  if (container.value) {
    container.value.innerHTML = ''
  }

  window.removeEventListener('resize', debouncedApplySize)
  window.removeEventListener(RIGHT_PANEL_TRANSITION_END_EVENT, debouncedApplySize as EventListener)
})
</script>

<style scoped>
.terminal-area {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 0;
  background: #0d0f14;
}

.terminal-frame {
  position: relative;
  height: 100%;
  border-radius: 0;
  overflow: hidden;
  background: #0b0e14;
  border: none;
  box-shadow: none;
}

.terminal-container {
  position: absolute;
  inset: 8px 10px 8px 10px;
}

.terminal-measure-probe {
  position: absolute;
  visibility: hidden;
  pointer-events: none;
  white-space: pre;
  inset: 0 auto auto 0;
}

.terminal-inline-suggestion {
  position: absolute;
  z-index: 3;
  pointer-events: none;
  user-select: none;
  white-space: pre;
  display: inline-flex;
  align-items: center;
}

.terminal-inline-suggestion__prefix {
  color: var(--text-color);
  opacity: 1;
}

.terminal-inline-suggestion__suffix {
  color: color-mix(in srgb, var(--muted-color) 88%, var(--text-color) 12%);
  opacity: 0.82;
}

.terminal-connection-overlay {
  position: absolute;
  inset: 18px 20px auto 20px;
  z-index: 4;
  display: grid;
  gap: 8px;
  max-width: min(520px, calc(100% - 40px));
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--connection-disconnected) 28%, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
  background: rgba(9, 12, 18, 0.92);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(10px);
}

.terminal-connection-overlay__badge {
  width: fit-content;
  padding: 3px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--connection-disconnected-soft) 72%, transparent);
  color: var(--connection-disconnected);
  font-size: 11px;
  font-weight: 700;
}

.terminal-connection-overlay__title {
  color: #f5f7fa;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
}

.terminal-connection-overlay__message,
.terminal-connection-overlay__hint {
  color: rgba(233, 237, 242, 0.82);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.terminal-area--comfortable .terminal-container {
  inset: 10px 12px 10px 12px;
}

.terminal-area--balanced .terminal-container {
  inset: 8px 10px 8px 10px;
}

.terminal-area--compact .terminal-container {
  inset: 6px 8px 6px 8px;
}

.scroll-indicator {
  position: absolute;
  top: 48px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(17, 17, 17, 0.82);
  color: rgba(255, 255, 255, 0.92);
  text-align: center;
  padding: 3px 8px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.01em;
  z-index: 10;
  opacity: 0.72;
  transition: opacity 0.3s ease;
}

.scroll-indicator:hover {
  opacity: 1;
}
</style>
