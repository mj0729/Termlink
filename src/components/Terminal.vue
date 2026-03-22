<template>
  <div
    class="terminal-area"
    :class="[`terminal-area--${theme}`, `terminal-area--${density}`, { 'is-active': active }]"
  >
    <div class="terminal-frame">
      <div ref="container" class="terminal-container" />
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
  }),
  autoPassword: '',
  sshUser: '',
  sshState: 'connected',
  type: 'local'
})

const emit = defineEmits(['close', 'reconnect', 'currentDirectoryChange', 'terminalInput'])

const container = ref<HTMLElement | null>(null)
const terminal = ref<XTermTerminal | null>(null)
const fitAddon = ref<XTermFitAddon | null>(null)
const SSH_CWD_MARKER_PREFIX = '\u001fTERMLINK_CWD:'
let lastReceivedSeq = 0
let commandBuffer = ''
let shellCwd = ''
let previousShellCwd = ''
let homeCwd = ''
let sshOutputBuffer = ''
let promptBuffer = ''
let pendingReconnectEnter = false
let hasShownConnectingNotice = false
const hasScrollContent = computed(() => {
  if (!terminal.value) return false
  return terminal.value.buffer.active.viewportY > 0
})
const density = computed<WorkspaceDensity>(() => props.config.density || 'balanced')

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

function stripAnsi(value: string) {
  return value
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b[@-_]/g, '')
}

function consumeSshOutput(rawOutput: string) {
  const combined = sshOutputBuffer + rawOutput
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

  previousShellCwd = shellCwd || previousShellCwd
  shellCwd = normalized
  if (!homeCwd) {
    homeCwd = normalized
  }
  emit('currentDirectoryChange', normalized)
}

function trackTerminalInput(data: string) {
  for (const char of data) {
    if (char === '\r') {
      commandBuffer = ''
      continue
    }

    if (char === '\u007f') {
      commandBuffer = commandBuffer.slice(0, -1)
      continue
    }

    if (char === '\u0015' || char === '\u0003' || char === '\u001b') {
      commandBuffer = ''
      continue
    }

    if (char >= ' ') {
      commandBuffer += char
    }
  }
}

function syncDirectoryFromPrompt(output: string) {
  const sanitizedOutput = stripAnsi(output)
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

    const nextPath = resolvePromptPath(matchedPath)
    if (nextPath) {
      updateShellDirectory(nextPath)
    }
  }

  const trimmedTrailingLine = trailingLine.trim()
  if (trimmedTrailingLine) {
    const matchedPath = promptPatterns
      .map((pattern) => trimmedTrailingLine.match(pattern)?.[1] || '')
      .find(Boolean)

    if (matchedPath) {
      const nextPath = resolvePromptPath(matchedPath)
      if (nextPath) {
        updateShellDirectory(nextPath)
      }
    }
  }

  promptBuffer = trailingLine.slice(-512)
}

async function syncInitialDirectory() {
  if (!props.id.startsWith('ssh-')) return
  if (shellCwd) return

  try {
    const pwd = await SshService.executeCommand(props.id, 'pwd')
    if (pwd) {
      shellCwd = normalizePosixPath(pwd)
      homeCwd = shellCwd
      previousShellCwd = shellCwd
      emit('currentDirectoryChange', shellCwd)
    }
  } catch (error) {
    console.warn('获取 SSH 当前目录失败:', error)
  }
}

function resetSshSessionState() {
  lastReceivedSeq = 0
  commandBuffer = ''
  shellCwd = ''
  previousShellCwd = ''
  homeCwd = ''
  sshOutputBuffer = ''
  promptBuffer = ''
}

function renderConnectingNotice(force = false) {
  if (!props.id.startsWith('ssh-') || !terminal.value) return
  if (!force && hasShownConnectingNotice) return
  terminal.value.writeln('\r\n正在建立 SSH 连接，请稍候...')
  hasShownConnectingNotice = true
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
    rows: 24, // 适中的行数
    cols: 80, // 标准的列数，过大会导致输入位置问题
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
      if (props.id.startsWith('ssh-') && props.sshState === 'connecting') {
        renderConnectingNotice()
        return
      }
      if (props.id.startsWith('ssh-') && props.sshState === 'disconnected') {
        if (data === '\r') {
          pendingReconnectEnter = true
          terminal.value?.writeln('\r\n正在尝试重连...')
          emit('reconnect')
        }
        return
      }
      if (props.id.startsWith('ssh-')) {
        trackTerminalInput(data)
      }
      emit('terminalInput', data)
      if (props.id.startsWith('ssh-')) {
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
  term.onResize(({ cols, rows }) => {
    if (props.active) {
      if (props.id.startsWith('ssh-')) {
        // SSH终端
        SshService.resizeTerminal(props.id, cols, rows).catch(() => {})
      } else {
        // 本地终端
        invoke('resize_pty', { id: props.id, cols, rows }).catch(() => {})
      }
    }
  })
  
  terminal.value = term
  fitAddon.value = fit
  
  // 打开终端
  term.open(container.value)
  fit.fit()
  
  // 等待终端完全初始化后再添加事件监听器
  setTimeout(() => {
    if (term.element) {
      term.element.addEventListener('contextmenu', (event) => {
        event.preventDefault()
        showContextMenu(event, term)
      })
    }
  }, 100)
}

// 绑定会话
async function bindSession() {
  // 根据终端类型绑定不同的事件
  if (props.id.startsWith('ssh-')) {
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
          if (props.id.startsWith('ssh-')) {
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
  
  // 显示菜单
  showMenu(event, menuItems)
}

// 显示菜单
function showMenu(event, items) {
  // 移除已存在的菜单
  const existingMenu = document.querySelector('.terminal-context-menu')
  if (existingMenu) {
    existingMenu.remove()
  }
  
  // 创建菜单
  const menu = document.createElement('div')
  menu.className = 'terminal-context-menu'
  menu.style.cssText = `
    position: fixed;
    left: ${event.clientX}px;
    top: ${event.clientY}px;
    background: var(--panel-bg);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    min-width: 120px;
    padding: 4px 0;
  `
  
  // 添加菜单项
  items.forEach(item => {
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
    menuItem.addEventListener('click', () => {
      item.action()
      menu.remove()
    })
    menu.appendChild(menuItem)
  })
  
  // 添加到页面
  document.body.appendChild(menu)
  
  // 点击其他地方关闭菜单
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove()
      document.removeEventListener('click', closeMenu)
      document.removeEventListener('contextmenu', closeMenu)
    }
  }
  
  // 右键点击也关闭菜单
  const closeMenuOnRightClick = (e) => {
    menu.remove()
    document.removeEventListener('click', closeMenu)
    document.removeEventListener('contextmenu', closeMenu)
  }
  
  setTimeout(() => {
    document.addEventListener('click', closeMenu)
    document.addEventListener('contextmenu', closeMenuOnRightClick)
  }, 0)
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

// 监听活动状态变化
watch(() => props.active, (isActive) => {
  if (isActive) {
    // 激活时调整大小
    setTimeout(() => {
      applySize()
    }, 0)
  }
})

watch(() => props.sshState, (nextState, prevState) => {
  if (nextState === 'connecting' && prevState !== 'connecting') {
    hasShownConnectingNotice = false
    resetSshSessionState()
    if (unbindSession) {
      Promise.resolve(unbindSession()).then(() => {
        unbindSession = null
      })
    }
    renderConnectingNotice(true)
    return
  }

  if (nextState === 'connected' && prevState !== 'connected' && !unbindSession) {
    hasShownConnectingNotice = false
    resetSshSessionState()
    Promise.resolve(bindSession()).then(async (cleanup) => {
      unbindSession = cleanup
      await syncInitialDirectory()
    })
  }

  if (nextState === 'connected' && prevState === 'disconnected' && pendingReconnectEnter) {
    pendingReconnectEnter = false
    setTimeout(() => {
      if (props.id.startsWith('ssh-')) {
        SshService.writeTerminal(props.id, '\r').catch(() => {})
      }
    }, 120)
  }
})

// 生命周期钩子
let unbindSession = null

onMounted(async () => {
  resetSshSessionState()
  pendingReconnectEnter = false
  hasShownConnectingNotice = false

  // 创建终端
  await createTerminal()

  if (props.id.startsWith('ssh-') && props.sshState === 'connecting') {
    renderConnectingNotice(true)
  } else {
    unbindSession = await bindSession()
    await syncInitialDirectory()
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
})

onBeforeUnmount(async () => {
  // 解绑会话
  if (unbindSession) {
    await unbindSession()
  }
  
  // 销毁终端
  if (terminal.value) {
    terminal.value.dispose()
  }

  if (container.value) {
    container.value.innerHTML = ''
  }
  
  // 移除事件监听
  window.removeEventListener('resize', debouncedApplySize)
})
</script>

<style scoped>
.terminal-area {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 0;
  background: #0b0e14;
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
  inset: 6px 8px 6px 8px;
}

.terminal-area--comfortable .terminal-container {
  inset: 8px 10px 8px 10px;
}

.terminal-area--balanced .terminal-container {
  inset: 6px 8px 6px 8px;
}

.terminal-area--compact .terminal-container {
  inset: 4px 6px 4px 6px;
}

.scroll-indicator {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(20, 32, 52, 0.68);
  color: rgba(255, 255, 255, 0.96);
  text-align: center;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 10px;
  z-index: 10;
  opacity: 0.82;
  transition: opacity 0.3s ease;
}

.scroll-indicator:hover {
  opacity: 1;
}
</style>
