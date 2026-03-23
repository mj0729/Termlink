import type {
  HostCenterViewMode,
  TerminalConfig,
  TerminalCursorStyle,
  ThemeCenterConfig,
  ThemeConfig,
  ThemeMode,
  ThemeName,
  ThemePresetId,
  ThemePresetOption,
  ThemeStatusSaturation,
  WorkspaceDensity,
} from '../types/app'

type ThemeListenerPayload = {
  theme: ThemeName
  themeConfig: ThemeCenterConfig
}

type ThemeListener = (payload: ThemeListenerPayload) => void

type SurfacePalette = {
  bg: string
  surface0: string
  surface1: string
  surface2: string
  surface3: string
  text: string
  muted: string
  border: string
  borderSubtle: string
  strongBorder: string
  hover: string
  overlayMask: string
}

type ThemePresetDefinition = {
  id: ThemePresetId
  name: string
  description: string
  accent: string
  light: SurfacePalette
  dark: SurfacePalette
}

type AntdThemeTokens = {
  colorPrimary: string
  borderRadius: number
  colorBgBase: string
  colorBgLayout: string
  colorBgContainer: string
  colorBgElevated: string
  colorText: string
  colorTextSecondary: string
  colorBorder: string
  colorSuccess: string
  colorWarning: string
  colorError: string
}

const THEME_STORAGE_KEY = 'termlink_theme_center'
const LEGACY_THEME_STORAGE_KEY = 'termlink_theme'
const HOST_CENTER_VIEW_MODE_STORAGE_KEY = 'termlink_hostCenterViewMode'
const LEGACY_HOST_CENTER_VIEW_MODE_STORAGE_KEY = 'termlink_connectionHubViewMode'

const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
  fontSize: 13,
  fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  cursorBlink: true,
  cursorStyle: 'block',
  density: 'compact',
  hostCenterViewMode: 'grid',
}

const DEFAULT_THEME_CENTER_CONFIG: ThemeCenterConfig = {
  mode: 'light',
  presetId: 'minimal-black',
  accentColor: '#111111',
  statusSaturation: 'soft',
}

const THEME_PRESETS: Record<ThemePresetId, ThemePresetDefinition> = {
  'minimal-black': {
    id: 'minimal-black',
    name: '极简黑白',
    description: '纯粹的黑白工具感，最接近当前 Termlink 的目标气质。',
    accent: '#111111',
    light: {
      bg: '#ffffff',
      surface0: '#ffffff',
      surface1: '#ffffff',
      surface2: '#f5f5f5',
      surface3: '#ededed',
      text: '#111111',
      muted: '#6b7280',
      border: '#e5e7eb',
      borderSubtle: '#f3f4f6',
      strongBorder: '#111111',
      hover: '#f5f5f5',
      overlayMask: 'rgba(17, 17, 17, 0.16)',
    },
    dark: {
      bg: '#111111',
      surface0: '#111111',
      surface1: '#171717',
      surface2: '#1f1f1f',
      surface3: '#262626',
      text: '#f5f5f5',
      muted: '#a3a3a3',
      border: '#303030',
      borderSubtle: '#262626',
      strongBorder: '#f5f5f5',
      hover: '#1f1f1f',
      overlayMask: 'rgba(0, 0, 0, 0.52)',
    },
  },
  'soft-gray': {
    id: 'soft-gray',
    name: '柔和灰阶',
    description: '层次更柔和，适合长时间工作与信息密集界面。',
    accent: '#52525b',
    light: {
      bg: '#fafaf9',
      surface0: '#fafaf9',
      surface1: '#ffffff',
      surface2: '#f4f4f5',
      surface3: '#e7e7e9',
      text: '#18181b',
      muted: '#71717a',
      border: '#e4e4e7',
      borderSubtle: '#f4f4f5',
      strongBorder: '#27272a',
      hover: '#f4f4f5',
      overlayMask: 'rgba(24, 24, 27, 0.16)',
    },
    dark: {
      bg: '#121212',
      surface0: '#121212',
      surface1: '#191919',
      surface2: '#202020',
      surface3: '#292929',
      text: '#f4f4f5',
      muted: '#a1a1aa',
      border: '#303032',
      borderSubtle: '#27272a',
      strongBorder: '#fafafa',
      hover: '#202020',
      overlayMask: 'rgba(0, 0, 0, 0.54)',
    },
  },
  'terminal-green': {
    id: 'terminal-green',
    name: '终端绿',
    description: '保留克制底色，在交互里带一点终端感的绿色倾向。',
    accent: '#3f6f5a',
    light: {
      bg: '#f8fbf9',
      surface0: '#f8fbf9',
      surface1: '#ffffff',
      surface2: '#eff5f1',
      surface3: '#e2ebe5',
      text: '#15221c',
      muted: '#617166',
      border: '#d9e4dd',
      borderSubtle: '#edf4ef',
      strongBorder: '#22352c',
      hover: '#eef5f0',
      overlayMask: 'rgba(21, 34, 28, 0.16)',
    },
    dark: {
      bg: '#101412',
      surface0: '#101412',
      surface1: '#151c19',
      surface2: '#1c2521',
      surface3: '#243029',
      text: '#eff7f2',
      muted: '#9eb1a6',
      border: '#2d3b34',
      borderSubtle: '#243029',
      strongBorder: '#eff7f2',
      hover: '#1c2521',
      overlayMask: 'rgba(0, 0, 0, 0.56)',
    },
  },
  'cool-slate': {
    id: 'cool-slate',
    name: '冷调石板',
    description: '偏冷灰蓝的理性工具感，适合文件和运维场景。',
    accent: '#475569',
    light: {
      bg: '#f8fafc',
      surface0: '#f8fafc',
      surface1: '#ffffff',
      surface2: '#f1f5f9',
      surface3: '#e2e8f0',
      text: '#111827',
      muted: '#64748b',
      border: '#dbe2ea',
      borderSubtle: '#edf2f7',
      strongBorder: '#1f2937',
      hover: '#f1f5f9',
      overlayMask: 'rgba(17, 24, 39, 0.16)',
    },
    dark: {
      bg: '#0f1318',
      surface0: '#0f1318',
      surface1: '#151b22',
      surface2: '#1c2430',
      surface3: '#253041',
      text: '#eef2f7',
      muted: '#94a3b8',
      border: '#2f3b4a',
      borderSubtle: '#24303d',
      strongBorder: '#eef2f7',
      hover: '#1c2430',
      overlayMask: 'rgba(0, 0, 0, 0.56)',
    },
  },
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '').trim()
  const safe = normalized.length === 3
    ? normalized.split('').map((segment) => segment + segment).join('')
    : normalized

  const value = Number.parseInt(safe, 16)
  if (Number.isNaN(value)) {
    return { r: 17, g: 17, b: 17 }
  }

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function withAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function clampHexColor(value?: string | null, fallback = '#111111') {
  if (!value) return fallback
  const normalized = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized
  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    return `#${normalized.slice(1).split('').map((segment) => segment + segment).join('')}`
  }
  return fallback
}

function buildTerminalTheme(theme: ThemeName, accentColor: string): ThemeConfig {
  if (theme === 'dark') {
    return {
      background: '#0d0f14',
      foreground: '#f5f5f5',
      cursor: '#f5f5f5',
      selection: withAlpha('#f5f5f5', 0.18),
      black: '#000000',
      red: '#de7878',
      green: '#60c08f',
      yellow: '#d3a247',
      blue: accentColor,
      magenta: '#b294ff',
      cyan: '#8ac5c0',
      white: '#f5f5f5',
      brightBlack: '#737373',
      brightRed: '#e68f8f',
      brightGreen: '#7dd3a7',
      brightYellow: '#dfb769',
      brightBlue: accentColor,
      brightMagenta: '#c8b4ff',
      brightCyan: '#9dd5d0',
      brightWhite: '#ffffff',
    }
  }

  return {
    background: '#ffffff',
    foreground: '#111111',
    cursor: '#111111',
    selection: withAlpha('#111111', 0.12),
    black: '#111111',
    red: '#bc6464',
    green: '#4b9b73',
    yellow: '#b9892f',
    blue: accentColor,
    magenta: '#8b5cf6',
    cyan: '#0f766e',
    white: '#111111',
    brightBlack: '#374151',
    brightRed: '#c77777',
    brightGreen: '#5baa82',
    brightYellow: '#c89a43',
    brightBlue: accentColor,
    brightMagenta: '#9f7aea',
    brightCyan: '#148a82',
    brightWhite: '#111111',
  }
}

function buildStatusColors(theme: ThemeName, saturation: ThemeStatusSaturation) {
  if (theme === 'dark') {
    return saturation === 'normal'
      ? {
          connected: '#7ad7a3',
          connecting: '#e3b453',
          disconnected: '#f08e8e',
        }
      : {
          connected: '#60c08f',
          connecting: '#d3a247',
          disconnected: '#de7878',
        }
  }

  return saturation === 'normal'
    ? {
        connected: '#2f8f5b',
        connecting: '#c28a1b',
        disconnected: '#c45a5a',
      }
    : {
        connected: '#4b9b73',
        connecting: '#b9892f',
        disconnected: '#bc6464',
      }
}

function buildCssVars(
  theme: ThemeName,
  palette: SurfacePalette,
  accentColor: string,
  statusColors: ReturnType<typeof buildStatusColors>,
) {
  const primarySoft = withAlpha(accentColor, theme === 'dark' ? 0.12 : 0.08)
  const primaryRing = withAlpha(accentColor, theme === 'dark' ? 0.18 : 0.14)

  return {
    '--bg-color': palette.bg,
    '--surface-0': palette.surface0,
    '--surface-1': palette.surface1,
    '--surface-2': palette.surface2,
    '--surface-3': palette.surface3,
    '--chrome-bg': palette.bg,
    '--panel-bg': palette.surface1,
    '--panel-header-bg': palette.surface1,
    '--menu-bg': palette.surface1,
    '--tabs-bg': palette.surface0,
    '--toolbar-bg': palette.surface1,
    '--status-bg': palette.surface0,
    '--terminal-bg': palette.bg,
    '--text-color': palette.text,
    '--muted-color': palette.muted,
    '--border-color': palette.border,
    '--border-subtle': palette.borderSubtle,
    '--strong-border': palette.strongBorder,
    '--hover-bg': palette.hover,
    '--primary-color': accentColor,
    '--primary-soft': primarySoft,
    '--primary-ring': primaryRing,
    '--success-color': statusColors.connected,
    '--warning-color': statusColors.connecting,
    '--error-color': statusColors.disconnected,
    '--shadow-soft': 'none',
    '--shadow-card': 'none',
    '--workspace-frame-bg': palette.bg,
    '--workspace-frame-border': palette.border,
    '--workspace-center-bg': palette.bg,
    '--workspace-terminal-bg': palette.bg,
    '--workspace-empty-bg': palette.bg,
    '--workspace-empty-border': palette.border,
    '--topbar-bg': palette.bg,
    '--tabs-strip-bg': palette.bg,
    '--status-strip-bg': palette.bg,
    '--monitor-card-bg': palette.surface1,
    '--monitor-card-strong': palette.surface1,
    '--monitor-rail-bg': palette.surface2,
    '--terminal-shell-bg': palette.bg,
    '--terminal-shell-border': palette.border,
    '--terminal-toolbar-bg': palette.surface1,
    '--workspace-view-bg': palette.bg,
    '--workspace-view-border': palette.border,
    '--workspace-view-shadow': 'none',
    '--overlay-mask-bg': palette.overlayMask,
    '--overlay-panel-bg': palette.surface1,
    '--overlay-panel-solid': palette.surface1,
    '--overlay-header-bg': palette.surface1,
    '--overlay-divider-color': palette.border,
    '--connection-connected': statusColors.connected,
    '--connection-connecting': statusColors.connecting,
    '--connection-disconnected': statusColors.disconnected,
    '--connection-connected-soft': withAlpha(statusColors.connected, theme === 'dark' ? 0.22 : 0.18),
    '--connection-connecting-soft': withAlpha(statusColors.connecting, theme === 'dark' ? 0.22 : 0.18),
    '--connection-disconnected-soft': withAlpha(statusColors.disconnected, theme === 'dark' ? 0.22 : 0.18),
  } satisfies Record<string, string>
}

function buildAntdTokens(
  palette: SurfacePalette,
  accentColor: string,
  statusColors: ReturnType<typeof buildStatusColors>,
): AntdThemeTokens {
  return {
    colorPrimary: accentColor,
    borderRadius: 10,
    colorBgBase: palette.bg,
    colorBgLayout: palette.bg,
    colorBgContainer: palette.surface1,
    colorBgElevated: palette.surface2,
    colorText: palette.text,
    colorTextSecondary: palette.muted,
    colorBorder: palette.border,
    colorSuccess: statusColors.connected,
    colorWarning: statusColors.connecting,
    colorError: statusColors.disconnected,
  }
}

function readLegacyTheme(): ThemeMode {
  const legacy = localStorage.getItem(LEGACY_THEME_STORAGE_KEY)
  if (legacy === 'dark' || legacy === 'light') {
    return legacy
  }
  return DEFAULT_THEME_CENTER_CONFIG.mode
}

function readThemeCenterConfig(): ThemeCenterConfig {
  const raw = localStorage.getItem(THEME_STORAGE_KEY)
  if (!raw) {
    return {
      ...DEFAULT_THEME_CENTER_CONFIG,
      mode: readLegacyTheme(),
    }
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ThemeCenterConfig>
    const preset = parsed.presetId && THEME_PRESETS[parsed.presetId]
      ? parsed.presetId
      : DEFAULT_THEME_CENTER_CONFIG.presetId
    const accentFallback = THEME_PRESETS[preset].accent

    return {
      mode: parsed.mode === 'dark' || parsed.mode === 'light' || parsed.mode === 'system'
        ? parsed.mode
        : readLegacyTheme(),
      presetId: preset,
      accentColor: clampHexColor(parsed.accentColor, accentFallback),
      statusSaturation: parsed.statusSaturation === 'normal' ? 'normal' : 'soft',
    }
  } catch {
    return {
      ...DEFAULT_THEME_CENTER_CONFIG,
      mode: readLegacyTheme(),
    }
  }
}

/**
 * 主题服务 - 处理主题配置中心、运行时主题与终端配置。
 */
class ThemeService {
  private theme: ThemeName
  private themeCenterConfig: ThemeCenterConfig
  private terminalConfig: TerminalConfig
  private terminalTheme: Record<ThemeName, ThemeConfig>
  private antdTokens: AntdThemeTokens
  private pendingBodyTheme: ThemeName | null = null
  private listeners = new Set<ThemeListener>()
  private mediaQuery: MediaQueryList | null = null

  constructor() {
    this.themeCenterConfig = readThemeCenterConfig()
    this.theme = this.resolveThemeName(this.themeCenterConfig.mode)
    this.terminalConfig = {
      fontSize: parseInt(localStorage.getItem('termlink_fontSize') || String(DEFAULT_TERMINAL_CONFIG.fontSize), 10),
      fontFamily: localStorage.getItem('termlink_fontFamily') || DEFAULT_TERMINAL_CONFIG.fontFamily,
      cursorBlink: localStorage.getItem('termlink_cursorBlink') !== 'false',
      cursorStyle: (localStorage.getItem('termlink_cursorStyle') as TerminalCursorStyle | null) || DEFAULT_TERMINAL_CONFIG.cursorStyle,
      density: (localStorage.getItem('termlink_density') as WorkspaceDensity | null) || DEFAULT_TERMINAL_CONFIG.density,
      hostCenterViewMode: (
        localStorage.getItem(HOST_CENTER_VIEW_MODE_STORAGE_KEY)
        || localStorage.getItem(LEGACY_HOST_CENTER_VIEW_MODE_STORAGE_KEY)
      ) as HostCenterViewMode | null || DEFAULT_TERMINAL_CONFIG.hostCenterViewMode,
    }
    this.terminalTheme = {
      light: buildTerminalTheme('light', this.themeCenterConfig.accentColor),
      dark: buildTerminalTheme('dark', this.themeCenterConfig.accentColor),
    }
    this.antdTokens = buildAntdTokens(
      THEME_PRESETS[this.themeCenterConfig.presetId][this.theme],
      this.themeCenterConfig.accentColor,
      buildStatusColors(this.theme, this.themeCenterConfig.statusSaturation),
    )

    this.initSystemThemeListener()
    this.applyTheme(this.theme)
  }

  private initSystemThemeListener() {
    if (!window.matchMedia) return

    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (this.themeCenterConfig.mode !== 'system') return
      const nextTheme = this.resolveThemeName('system')
      if (nextTheme === this.theme) return
      this.theme = nextTheme
      this.applyTheme(nextTheme)
      this.notifyListeners()
    }
    this.mediaQuery.addEventListener?.('change', handler)
  }

  private resolveThemeName(mode: ThemeMode): ThemeName {
    if (mode === 'dark' || mode === 'light') return mode
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  private applyCssVars(themeName: ThemeName) {
    const preset = THEME_PRESETS[this.themeCenterConfig.presetId]
    const palette = preset[themeName]
    const accentColor = clampHexColor(this.themeCenterConfig.accentColor, preset.accent)
    const statusColors = buildStatusColors(themeName, this.themeCenterConfig.statusSaturation)
    const cssVars = buildCssVars(themeName, palette, accentColor, statusColors)

    const html = document.documentElement
    Object.entries(cssVars).forEach(([key, value]) => {
      html.style.setProperty(key, value)
    })

    this.terminalTheme = {
      light: buildTerminalTheme('light', accentColor),
      dark: buildTerminalTheme('dark', accentColor),
    }
    this.antdTokens = buildAntdTokens(palette, accentColor, statusColors)
  }

  private notifyListeners() {
    const payload = {
      theme: this.theme,
      themeConfig: this.getThemeCenterConfig(),
    }
    this.listeners.forEach((listener) => listener(payload))
  }

  subscribe(listener: ThemeListener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getTheme(): ThemeName {
    return this.theme
  }

  getThemeCenterConfig(): ThemeCenterConfig {
    return { ...this.themeCenterConfig }
  }

  getThemePresetOptions(): ThemePresetOption[] {
    return Object.values(THEME_PRESETS).map((preset) => ({
      label: preset.name,
      value: preset.id,
      description: preset.description,
      accent: preset.accent,
    }))
  }

  getAntdTokens(): AntdThemeTokens {
    return { ...this.antdTokens }
  }

  getTerminalConfig(): TerminalConfig {
    return { ...this.terminalConfig }
  }

  getThemeConfig(themeName?: ThemeName): ThemeConfig {
    return this.terminalTheme[themeName || this.theme]
  }

  toggleTheme(themeName: ThemeName): ThemeName {
    this.updateThemeCenterConfig({ mode: themeName })
    return this.theme
  }

  updateThemeCenterConfig(config: Partial<ThemeCenterConfig>) {
    const nextPresetId = config.presetId && THEME_PRESETS[config.presetId]
      ? config.presetId
      : this.themeCenterConfig.presetId
    const accentFallback = THEME_PRESETS[nextPresetId].accent

    this.themeCenterConfig = {
      ...this.themeCenterConfig,
      ...config,
      presetId: nextPresetId,
      accentColor: clampHexColor(config.accentColor ?? this.themeCenterConfig.accentColor, accentFallback),
      statusSaturation: config.statusSaturation === 'normal'
        ? 'normal'
        : config.statusSaturation === 'soft'
          ? 'soft'
          : this.themeCenterConfig.statusSaturation,
      mode: config.mode === 'dark' || config.mode === 'light' || config.mode === 'system'
        ? config.mode
        : this.themeCenterConfig.mode,
    }

    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(this.themeCenterConfig))
    localStorage.setItem(LEGACY_THEME_STORAGE_KEY, this.resolveThemeName(this.themeCenterConfig.mode))

    this.theme = this.resolveThemeName(this.themeCenterConfig.mode)
    this.applyTheme(this.theme)
    this.notifyListeners()

    return {
      theme: this.theme,
      themeConfig: this.getThemeCenterConfig(),
    }
  }

  applyTheme(themeName: ThemeName): void {
    const html = document.documentElement

    this.applyCssVars(themeName)

    html.setAttribute('data-theme', themeName)
    html.classList.toggle('dark', themeName === 'dark')
    html.classList.toggle('light', themeName === 'light')
    html.style.colorScheme = themeName

    this.applyBodyTheme(themeName)
  }

  private applyBodyTheme(themeName: ThemeName): void {
    const body = document.body
    if (!body) {
      this.pendingBodyTheme = themeName

      if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', this.flushPendingBodyTheme, { once: true })
      }
      return
    }

    body.setAttribute('data-theme', themeName)

    const isDark = themeName === 'dark'
    body.classList.toggle('ant-dark', isDark)
    body.classList.toggle('ant-light', !isDark)

    if (this.pendingBodyTheme === themeName) {
      this.pendingBodyTheme = null
    }
  }

  private flushPendingBodyTheme = (): void => {
    if (!this.pendingBodyTheme) return
    this.applyBodyTheme(this.pendingBodyTheme)
  }

  updateTerminalConfig(config: Partial<TerminalConfig>): TerminalConfig {
    this.terminalConfig = { ...this.terminalConfig, ...config }

    localStorage.setItem('termlink_fontSize', String(this.terminalConfig.fontSize))
    localStorage.setItem('termlink_fontFamily', this.terminalConfig.fontFamily)
    localStorage.setItem('termlink_cursorBlink', String(this.terminalConfig.cursorBlink))
    localStorage.setItem('termlink_cursorStyle', this.terminalConfig.cursorStyle)
    localStorage.setItem('termlink_density', this.terminalConfig.density)
    localStorage.setItem(HOST_CENTER_VIEW_MODE_STORAGE_KEY, this.terminalConfig.hostCenterViewMode)

    return { ...this.terminalConfig }
  }
}

export default new ThemeService()
