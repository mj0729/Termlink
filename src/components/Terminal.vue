<template>
  <div
    class="terminal-area"
    :class="[`terminal-area--${theme}`, `terminal-area--${density}`, { 'is-active': active }]"
  >
    <div class="terminal-frame">
      <div ref="container" class="terminal-container" />
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
    <!-- 滚动指示器 -->
    <div v-if="hasScrollContent" class="scroll-indicator">
      <span>↑ 向上滚动查看更多内容</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import '@xterm/xterm/css/xterm.css'
import SshService from '../services/SshService'
import { hideTerminalContextMenu, showTerminalContextMenu } from '../utils/terminalContextMenu'
import { RIGHT_PANEL_TRANSITION_END_EVENT } from '../utils/rightPanelTransition'
import type { ITheme, Terminal as XTermTerminal } from '@xterm/xterm'
import type { FitAddon as XTermFitAddon } from '@xterm/addon-fit'
import type { TerminalConfig, ThemeName, WorkspaceDensity } from '../types/app'
import type { SshTerminalChunk } from '../services/SshService'

const props = withDefaults(defineProps<{
  id: string
  active?: boolean
  theme?: ThemeName
  config?: TerminalConfig
  autoPassword?: string
  sshUser?: string
  sshState?: 'connecting' | 'connected' | 'disconnected'
  connectionError?: string
  reconnectAttempt?: number
  reconnectScheduledAt?: number | null
  type?: string
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
  sshState: 'connected',
  connectionError: '',
  reconnectAttempt: 0,
  reconnectScheduledAt: null,
  type: 'local'
})

const emit = defineEmits(['close', 'reconnect', 'currentDirectoryChange', 'terminalInput'])

const container = ref<HTMLElement | null>(null)
const terminal = ref<XTermTerminal | null>(null)
const fitAddon = ref<XTermFitAddon | null>(null)
const SSH_CWD_MARKER_PREFIX = '\u001fTERMLINK_CWD:'
const SSH_BOOTSTRAP_ECHO_TOKEN = '__TERMLINK_BOOTSTRAP=1;'
let lastReceivedSeq = 0
let shellCwd = ''
let previousShellCwd = ''
let sshOutputBuffer = ''
let sshEchoFilterBuffer = ''
let promptBuffer = ''
let inputBuffer = ''
let pendingPromptDirectory = ''
let pendingPromptDirectoryHasError = false
let pendingReconnectEnter = false
let hasShownConnectingNotice = false
let contextMenuCleanup: (() => void) | null = null
let reconnectTickTimer: number | null = null
const nowTs = ref(Date.now())
const hasScrollContent = computed(() => {
  if (!terminal.value) return false
  return terminal.value.buffer.active.viewportY > 0
})
const density = computed<WorkspaceDensity>(() => props.config.density || 'balanced')
const showConnectionOverlay = computed(() => isSshTerminal() && props.sshState !== 'connected')
const reconnectCountdownSeconds = computed(() => {
  if (!props.reconnectScheduledAt) return 0
  return Math.max(0, Math.ceil((props.reconnectScheduledAt - nowTs.value) / 1000))
})
const overlayTitle = computed(() => {
  if (props.sshState === 'connecting') {
    if (props.reconnectAttempt) {
      return `正在进行第 ${props.reconnectAttempt} 次重连`
    }
    return '正在建立 SSH 连接'
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
const overlayHint = computed(() => {
  if (props.sshState === 'connecting') {
    return '请稍候，连接恢复后会继续显示终端内容。'
  }

  return '按回车立即手动重连，或等待自动重试。'
})

function isSshTerminal() {
  return props.type === 'ssh' || props.id.startsWith('ssh-')
}

function handleRightPanelTransitionEnd() {
  if (!props.active) return
  debouncedApplySize()
}

// 主题配置
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
    brightWhite: '#ffffff'
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
    brightWhite: '#ffffff'
  }
}

function resolveTerminalLineHeight(nextDensity: WorkspaceDensity) {
  if (nextDensity === 'comfortable') return 1.12
  if (nextDensity === 'balanced') return 1.06
  return 1.01
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

  if (value === '~') {
    return getUserHomePath()
  }

  if (value.startsWith('~/')) {
    const home = getUserHomePath()
    return home ? normalizePosixPath(`${home}/${value.slice(2)}`) : ''
  }

  if (value.startsWith('/')) {
    return normalizePosixPath(value)
  }

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
  if (!target || target === '~') {
    return getUserHomePath()
  }

  if (target === '-') {
    return previousShellCwd || ''
  }

  const promptPath = resolvePromptPath(target)
  if (promptPath) {
    return promptPath
  }

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

function trackSshInput(data: string) {
  if (!isSshTerminal()) return
  if (data.includes('\u001b')) {
    inputBuffer = ''
    return
  }

  for (const char of data) {
    if (char === '\r' || char === '\n') {
      const nextPath = parseTrackedCdCommand(inputBuffer)
      if (nextPath) {
        pendingPromptDirectory = nextPath
        pendingPromptDirectoryHasError = false
      } else {
        clearPendingPromptDirectory()
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

    if (char < ' ' || char === '\u007f') {
      continue
    }

    inputBuffer += char
  }
}

function stripAnsi(value: string) {
  return value
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b[@-_]/g, '')
}

function getPromptPatterns() {
  return [
    /^\[[^@\]]+@[^ ]+\s+[^\]]+\][#$]\s*/,
    /^[^@\s]+@[^:\s]+:[^\s]+[#$]\s*/,
  ]
}

function getBootstrapEchoBufferStart(value: string) {
  const maxLength = Math.min(value.length, SSH_BOOTSTRAP_ECHO_TOKEN.length - 1)

  for (let length = maxLength; length > 0; length -= 1) {
    if (SSH_BOOTSTRAP_ECHO_TOKEN.startsWith(value.slice(-length))) {
      return value.length - length
    }
  }

  return value.length
}

function trimTrailingPromptEcho(value: string) {
  const promptEchoPatterns = getPromptPatterns().map((pattern) => new RegExp(`${pattern.source}$`))

  for (const pattern of promptEchoPatterns) {
    if (pattern.test(value)) {
      return value.replace(pattern, '')
    }
  }

  return value
}

function filterInjectedBootstrapEcho(output: string) {
  const combined = sshEchoFilterBuffer + output
  let cursor = 0
  let filtered = ''

  while (cursor < combined.length) {
    const tokenStart = combined.indexOf(SSH_BOOTSTRAP_ECHO_TOKEN, cursor)
    if (tokenStart === -1) {
      const bufferStart = getBootstrapEchoBufferStart(combined.slice(cursor))
      filtered += combined.slice(cursor, cursor + bufferStart)
      sshEchoFilterBuffer = combined.slice(cursor + bufferStart)
      return filtered
    }

    filtered += '\r\x1b[2K'
    filtered += trimTrailingPromptEcho(combined.slice(cursor, tokenStart))
    const markerStart = combined.indexOf(SSH_CWD_MARKER_PREFIX, tokenStart)
    if (markerStart === -1) {
      sshEchoFilterBuffer = combined.slice(tokenStart)
      return filtered
    }

    cursor = markerStart
  }

  sshEchoFilterBuffer = ''
  return filtered
}

function consumeSshOutput(rawOutput: string) {
  const combined = sshOutputBuffer + filterInjectedBootstrapEcho(rawOutput)
  let cursor = 0
  let renderedOutput = ''

  while (cursor < combined.length) {
    const markerStart = combined.indexOf(SSH_CWD_MARKER_PREFIX, cursor)
    if (markerStart === -1) {
      renderedOutput += combined.slice(cursor)
      sshOutputBuffer = ''
      return renderedOutput
    }

    renderedOutput += combined.slice(cursor, markerStart)

    const markerValueStart = markerStart + SSH_CWD_MARKER_PREFIX.length
    const markerEnd = combined.indexOf('\u001f', markerValueStart)
    if (markerEnd === -1) {
      sshOutputBuffer = combined.slice(markerStart)
      return renderedOutput
    }

    const nextPath = combined.slice(markerValueStart, markerEnd).trim()
    if (nextPath) {
      updateShellDirectory(nextPath)
    }

    cursor = markerEnd + 1
  }

  sshOutputBuffer = ''
  return renderedOutput
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

    if (!matchedPath) continue

    applyPromptDirectoryFallback(matchedPath)
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

async function syncInitialDirectory() {
  if (!isSshTerminal()) return
  if (shellCwd) return

  try {
    const pwd = await SshService.executeCommand(props.id, 'pwd')
    if (pwd) {
      shellCwd = normalizePosixPath(pwd)
      emit('currentDirectoryChange', shellCwd)
    }
  } catch (error) {
    console.warn('获取 SSH 当前目录失败:', error)
  }
}

function resetSshSessionState() {
  lastReceivedSeq = 0
  shellCwd = ''
  previousShellCwd = ''
  sshOutputBuffer = ''
  sshEchoFilterBuffer = ''
  promptBuffer = ''
  inputBuffer = ''
  clearPendingPromptDirectory()
}

function renderConnectingNotice(force = false) {
  if (!isSshTerminal() || !terminal.value) return
  if (!force && hasShownConnectingNotice) return
  terminal.value.writeln('\r\n正在建立 SSH 连接，请稍候...')
  hasShownConnectingNotice = true
}

function syncReconnectTicker() {
  if (reconnectTickTimer) {
    window.clearInterval(reconnectTickTimer)
    reconnectTickTimer = null
  }

  if (!props.reconnectScheduledAt) {
    return
  }

  nowTs.value = Date.now()
  reconnectTickTimer = window.setInterval(() => {
    nowTs.value = Date.now()
  }, 1000)
}

// 创建终端实例
async function createTerminal() {
  const { Terminal } = await import('@xterm/xterm')
  const { FitAddon } = await import('@xterm/addon-fit')

  // 强制清空挂载点，避免热更新或重建时残留旧的 DOM 节点
  if (container.value) {
    container.value.innerHTML = ''
  }
  if (!container.value) {
    return
  }
  
  const term = new Terminal({
    convertEol: true,
    fontFamily: props.config.fontFamily,
    fontSize: props.config.fontSize,
    lineHeight: resolveTerminalLineHeight(density.value),
    windowsMode: false, // 禁用Windows模式以正确处理Clink输出
    cursorBlink: props.config.cursorBlink,
    cursorStyle: props.config.cursorStyle,
    theme: themes[props.theme],
    scrollback: 10000, // 从 50000 降至 10000，每个终端减少约 50MB 内存
    // 不指定 rows/cols，由 FitAddon.fit() 根据容器实际尺寸决定
    // 硬编码 80 列会导致 shell 初始列宽与渲染宽度不一致，按上键时光标错位
    allowTransparency: true,
    fastScrollModifier: 'alt',
    fastScrollSensitivity: 5,
    scrollOnUserInput: false,
    rightClickSelectsWord: false, // 禁用右键选择单词，允许右键菜单
    wordSeparator: ' ()[]{}\',"`',
    disableStdin: false,  // 允许用户输入
    macOptionIsMeta: true, // Mac上的Option键作为Meta键
    macOptionClickForcesSelection: false, // 禁用Option点击强制选择
    altClickMovesCursor: false, // 禁用Alt点击移动光标
  })
  
  const fit = new FitAddon()
  term.loadAddon(fit)
  
  // 设置数据处理器
  term.onData(data => {
    // 只有当这个终端实例是激活状态时才发送数据
    if (props.active) {
      if (isSshTerminal() && props.sshState === 'connecting') {
        renderConnectingNotice()
        return
      }
      if (isSshTerminal() && props.sshState === 'disconnected') {
        if (data === '\r') {
          pendingReconnectEnter = true
          terminal.value?.writeln('\r\n正在尝试重连...')
          emit('reconnect')
        }
        return
      }
      emit('terminalInput', data)
      if (isSshTerminal()) {
        trackSshInput(data)
        // SSH终端
        SshService.writeTerminal(props.id, data).catch(() => {})
      } else {
        // 本地终端
        invoke('write_pty', { id: props.id, data }).catch(() => {})
      }
    }
  })
  
  // 设置键盘事件处理器，用于处理重连功能
  term.onKey(({ key, domEvent }) => {
    // 如果按回车键且终端中有连接失败信息，尝试重连
    if (domEvent.code === 'Enter' && props.active) {
      const content = term.buffer.active.getLine(term.buffer.active.cursorY)?.translateToString()
      if (content && (content.includes('Connection refused') || 
                      content.includes('ssh:') ||
                      content.includes('Connection timed out') ||
                      content.includes('No route to host') ||
                      content.includes('Connection closed'))) {
        // 触发重连事件
        terminal.value?.writeln('\r\n正在尝试重连...')
        emit('reconnect')
      }
    }
  })
  
  // 监听终端大小变化，自动同步PTY大小
  // 注意：不限制 props.active，否则非活动 tab 的 PTY 尺寸无法更新，
  // 导致切回时 shell 仍使用旧列宽，按上键时光标位置错乱
  term.onResize(({ cols, rows }) => {
    if (isSshTerminal()) {
      // SSH终端
      SshService.resizeTerminal(props.id, cols, rows).catch(() => {})
    } else {
      // 本地终端
      invoke('resize_pty', { id: props.id, cols, rows }).catch(() => {})
    }
  })
  
  terminal.value = term
  fitAddon.value = fit
  
  // 打开终端
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

// 绑定会话
async function bindSession() {
  // 根据终端类型绑定不同的事件
  if (isSshTerminal()) {
    if (props.sshState !== 'connected') {
      return async () => {}
    }

    let hydrating = true
    const pendingChunks: SshTerminalChunk[] = []

    const applyChunk = (chunk: SshTerminalChunk) => {
      if (!terminal.value || chunk.seq <= lastReceivedSeq) return
      const output = consumeSshOutput(chunk.data)
      if (output) {
        syncDirectoryFromPrompt(output)
        terminal.value.write(output)
      }
      lastReceivedSeq = chunk.seq
    }

    // SSH终端
    const offDataP = listen<SshTerminalChunk>(`ssh_data://${props.id}`, e => {
      const chunk = e.payload
      if (hydrating) {
        pendingChunks.push(chunk)
        return
      }
      applyChunk(chunk)
    })
    
    const offExitP = listen(`ssh_exit://${props.id}`, () => {
      emit('close')
    })
    
    const offErrorP = listen(`ssh_error`, e => {
      const payload = String(e.payload || '')
      if (payload.startsWith(`${props.id}: `)) {
        const errorMsg = payload.substring(props.id.length + 2)
        if (terminal.value) {
          terminal.value.writeln(`\r\n\x1b[31m${errorMsg}\x1b[0m`)
        }
        // 显示错误弹窗
        message.error({
          content: errorMsg,
          duration: 8,
          style: {
            marginTop: '50px',
            maxWidth: '400px'
          }
        })
      }
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
      (await offDataP)(); 
      (await offExitP)();
      (await offErrorP)();
    }
  } else {
    // 本地终端
    const offOutP = listen(`pty://${props.id}`, e => {
      // 只有当这个终端实例是激活状态时才写入数据
      if (terminal.value) {
        const output = String(e.payload || '')
        terminal.value.write(output)
        
        // 检测密码提示并自动输入密码
        if (props.autoPassword && (output.includes('password:') || output.includes('Password:'))) {
          setTimeout(() => {
            if (terminal.value && props.active) {
              invoke('write_pty', { id: props.id, data: props.autoPassword + '\r\n' }).catch(() => {})
            }
          }, 100) // 等待100ms让提示显示完成
        }
      }
    })
    
    const offExitP = listen(`pty_exit://${props.id}`, () => {
      emit('close')
    })
    
    return async () => { 
      (await offOutP)(); 
      (await offExitP)() 
    }
  }
}

// 应用主题
function applyTheme() {
  if (terminal.value) {
    const theme = themes[props.theme]
    terminal.value.options.theme = theme
    // 使用 requestAnimationFrame 替代 setTimeout，更高效
    requestAnimationFrame(() => terminal.value?.refresh(0, terminal.value.rows - 1))
  }
}

// 应用配置
function applyConfig() {
  if (terminal.value) {
    terminal.value.options.fontSize = props.config.fontSize
    terminal.value.options.fontFamily = props.config.fontFamily
    terminal.value.options.cursorBlink = props.config.cursorBlink
    terminal.value.options.cursorStyle = props.config.cursorStyle
    terminal.value.options.lineHeight = resolveTerminalLineHeight(density.value)
    requestAnimationFrame(() => {
      applySize()
    })
  }
}

// 应用大小
function applySize() {
  if (fitAddon.value) {
    fitAddon.value.fit()
  }
}

// Debounced resize handler（使用 rAF 减少 80% reflow 开销）
let resizeTimer: number | null = null
function debouncedApplySize() {
  if (resizeTimer) cancelAnimationFrame(resizeTimer)
  resizeTimer = requestAnimationFrame(() => applySize())
}

// 显示右键菜单
function showContextMenu(event: MouseEvent, term: XTermTerminal) {
  const selection = term.getSelection()
  const hasSelection = selection && selection.length > 0
  
  // 创建菜单项
  const menuItems = []
  
  if (hasSelection) {
    menuItems.push({
      label: '复制',
      action: () => {
        navigator.clipboard.writeText(selection).then(() => {
          console.log('已复制到剪贴板')
        }).catch(err => {
          console.error('复制失败:', err)
        })
      }
    })
  }
  
  menuItems.push({
    label: '粘贴',
    action: () => {
      navigator.clipboard.readText().then(text => {
        if (props.active) {
          if (isSshTerminal()) {
            SshService.writeTerminal(props.id, text).catch(() => {})
          } else {
            invoke('write_pty', { id: props.id, data: text }).catch(() => {})
          }
        }
      }).catch(err => {
        console.error('粘贴失败:', err)
      })
    }
  })
  
  if (hasSelection) {
    menuItems.push({
      label: '全选',
      action: () => {
        term.selectAll()
      }
    })
  }
  
  menuItems.push({
    label: '清屏',
    action: () => {
      term.clear()
    }
  })

  showTerminalContextMenu(event, menuItems)
}

// 监听主题变化
watch(() => props.theme, () => {
  applyTheme()
})

// 监听配置变化
watch(() => props.config, () => {
  applyConfig()
  applySize()
}, { deep: true })

let unbindSession: (() => Promise<void>) | null = null

async function cleanupSession() {
  if (!unbindSession) return
  const cleanup = unbindSession
  unbindSession = null
  await cleanup()
}

async function syncSessionBinding() {
  if (!isSshTerminal()) {
    if (!unbindSession) {
      unbindSession = await bindSession()
    }
    return
  }

  if (!props.active || props.sshState !== 'connected') {
    await cleanupSession()
    return
  }

  if (!unbindSession) {
    unbindSession = await bindSession()
    await syncInitialDirectory()
  }
}

watch(() => props.active, (isActive) => {
  if (isActive) {
    setTimeout(() => {
      applySize()
    }, 0)
  }

  if (isSshTerminal()) {
    void syncSessionBinding()
  }
})

watch(() => props.sshState, (nextState, prevState) => {
  if (!isSshTerminal()) return

  if (nextState === 'connecting' && prevState !== 'connecting') {
    hasShownConnectingNotice = false
    resetSshSessionState()
    void cleanupSession().then(() => {
      renderConnectingNotice(true)
    })
    return
  }

  if (nextState === 'connected' && prevState !== 'connected') {
    hasShownConnectingNotice = false
    resetSshSessionState()
    void syncSessionBinding()
  }

  if (nextState !== 'connected' && prevState === 'connected') {
    void cleanupSession()
  }

  if (nextState === 'connected' && prevState === 'disconnected' && pendingReconnectEnter) {
    pendingReconnectEnter = false
    setTimeout(() => {
      if (isSshTerminal()) {
        SshService.writeTerminal(props.id, '\r').catch(() => {})
      }
    }, 120)
  }
})

watch(() => props.reconnectScheduledAt, () => {
  syncReconnectTicker()
}, { immediate: true })

onMounted(async () => {
  resetSshSessionState()
  pendingReconnectEnter = false
  hasShownConnectingNotice = false

  // 创建终端
  await createTerminal()

  if (isSshTerminal() && props.sshState === 'connecting') {
    renderConnectingNotice(true)
  } else {
    await syncSessionBinding()
  }
  
  // 应用主题和配置
  applyTheme()
  applyConfig()
  
  // 如果是活动状态，调整大小
  if (props.active) {
    setTimeout(() => {
      applySize()
    }, 0)
  }
  
  // 监听窗口大小变化
  window.addEventListener('resize', debouncedApplySize)
  window.addEventListener(RIGHT_PANEL_TRANSITION_END_EVENT, handleRightPanelTransitionEnd as EventListener)
})

onBeforeUnmount(async () => {
  await cleanupSession()
  contextMenuCleanup?.()
  contextMenuCleanup = null
  hideTerminalContextMenu()
  
  // 销毁终端
  if (terminal.value) {
    terminal.value.dispose()
  }

  if (reconnectTickTimer) {
    window.clearInterval(reconnectTickTimer)
    reconnectTickTimer = null
  }

  if (container.value) {
    container.value.innerHTML = ''
  }
  
  // 移除事件监听
  window.removeEventListener('resize', debouncedApplySize)
  window.removeEventListener(RIGHT_PANEL_TRANSITION_END_EVENT, handleRightPanelTransitionEnd as EventListener)
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
