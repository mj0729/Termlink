<template>
  <a-modal
    :open="visible"
    title="程序配置"
    width="980px"
    wrap-class-name="settings-modal"
    :classes="modalClasses"
    :styles="modalStyles"
    :close-icon="closeIconNode"
    @cancel="handleCancel"
  >
    <div class="settings-layout">
      <aside class="settings-sidebar">
        <div class="settings-sidebar__intro">
          <div class="settings-sidebar__eyebrow">Preferences</div>
          <div class="settings-sidebar__title">程序配置</div>
        </div>

        <nav class="settings-nav" aria-label="设置分类">
          <button
            v-for="section in settingsSections"
            :key="section.key"
            type="button"
            class="settings-nav__item"
            :class="{ 'is-active': activeSection === section.key }"
            @click="activeSection = section.key"
          >
            <span class="settings-nav__accent" />
            <span class="settings-nav__label">{{ section.label }}</span>
          </button>
        </nav>
      </aside>

      <section class="settings-content">
        <header class="settings-content__header">
          <div class="settings-content__eyebrow">{{ currentSection.eyebrow }}</div>
          <h2 class="settings-content__title">{{ currentSection.label }}</h2>
        </header>

        <a-form layout="vertical" class="settings-form">
          <template v-if="activeSection === 'general'">
            <section class="settings-group">
              <div class="settings-group__header">
                <h3>工作区体验</h3>
              </div>

              <a-form-item label="界面密度">
                <a-segmented
                  block
                  :options="densityOptions"
                  v-model:value="config.density"
                />
                <div class="settings-hint">
                  紧凑模式会优先给终端和文件区更多有效显示空间，适合 SSH、日志和文件巡检。
                </div>
              </a-form-item>

              <a-form-item label="主机中心视图">
                <a-segmented
                  block
                  :options="hostCenterViewOptions"
                  v-model:value="config.hostCenterViewMode"
                />
                <div class="settings-hint">
                  控制主机中心默认使用列表还是卡片视图。
                </div>
              </a-form-item>
            </section>
          </template>

          <template v-else-if="activeSection === 'terminal'">
            <section class="settings-group">
              <div class="settings-group__header">
                <h3>终端显示</h3>
              </div>

              <a-row :gutter="16">
                <a-col :xs="24" :sm="12">
                  <a-form-item label="字体大小">
                    <a-input-number
                      v-model:value="config.fontSize"
                      :min="8"
                      :max="32"
                      class="settings-field--full"
                    />
                  </a-form-item>
                </a-col>
                <a-col :xs="24" :sm="12">
                  <a-form-item label="字体族">
                    <a-select
                      v-model:value="config.fontFamily"
                      :options="fontFamilyOptions"
                      class="settings-field--full"
                    />
                  </a-form-item>
                </a-col>
              </a-row>

              <a-row :gutter="16">
                <a-col :xs="24" :sm="12">
                  <a-form-item label="光标闪烁">
                    <div class="settings-toggle-row">
                      <span class="settings-toggle-row__label">启用</span>
                      <a-switch v-model:checked="config.cursorBlink" />
                    </div>
                  </a-form-item>
                </a-col>
                <a-col :xs="24" :sm="12">
                  <a-form-item label="光标样式">
                    <a-select
                      v-model:value="config.cursorStyle"
                      :options="cursorStyleOptions"
                      class="settings-field--full"
                    />
                  </a-form-item>
                </a-col>
              </a-row>
            </section>
          </template>

          <template v-else-if="activeSection === 'appearance'">
            <section class="settings-group">
              <div class="settings-group__header">
                <h3>主题与状态色</h3>
              </div>

              <a-form-item label="主题模式">
                <a-segmented
                  block
                  :options="themeModeOptions"
                  v-model:value="themeConfig.mode"
                />
                <div class="settings-hint">
                  系统模式会跟随 macOS / Windows 当前配色方案，适合长期使用。
                </div>
              </a-form-item>

              <a-row :gutter="16">
                <a-col :xs="24" :sm="14">
                  <a-form-item label="主题预设">
                    <a-select
                      v-model:value="themeConfig.presetId"
                      :options="themePresetOptions"
                      class="settings-field--full"
                      @change="handlePresetChange"
                    />
                    <div class="settings-hint">
                      {{ currentPresetDescription }}
                    </div>
                  </a-form-item>
                </a-col>
                <a-col :xs="24" :sm="10">
                  <a-form-item label="状态色强度">
                    <a-segmented
                      block
                      :options="statusSaturationOptions"
                      v-model:value="themeConfig.statusSaturation"
                    />
                  </a-form-item>
                </a-col>
              </a-row>

              <a-form-item label="强调色">
                <div class="theme-accent-row">
                  <label class="theme-accent-swatch" aria-label="强调色选择器">
                    <input
                      class="theme-accent-native"
                      type="color"
                      :value="themeConfig.accentColor"
                      @input="handleAccentPickerInput"
                    />
                  </label>
                  <a-input
                    :value="themeConfig.accentColor"
                    placeholder="#111111"
                    @update:value="handleAccentTextInput"
                  />
                  <a-button class="settings-modal__button" @click="resetAccentColor">
                    跟随预设
                  </a-button>
                </div>
                <div class="settings-hint">
                  强调色会统一驱动按钮、焦点态、进度高亮和 antdv-next 的主色 token。
                </div>
              </a-form-item>

              <div class="theme-summary-grid">
                <div class="theme-summary-card">
                  <div class="theme-summary-card__label">当前主题方案</div>
                  <div class="theme-summary-card__value">{{ currentPresetLabel }}</div>
                  <div class="theme-summary-card__meta">
                    {{ currentModeLabel }} · {{ currentSaturationLabel }}
                  </div>
                </div>
                <div class="theme-summary-card">
                  <div class="theme-summary-card__label">状态语义</div>
                  <div class="theme-status-row">
                    <span class="theme-status-pill theme-status-pill--connected">成功</span>
                    <span class="theme-status-pill theme-status-pill--connecting">连接中</span>
                    <span class="theme-status-pill theme-status-pill--disconnected">断开</span>
                  </div>
                  <div class="theme-summary-card__meta">
                    三种状态颜色统一来自同一份主题配置。
                  </div>
                </div>
              </div>
            </section>
          </template>

          <template v-else-if="activeSection === 'storage'">
            <section class="settings-group">
              <div class="settings-group__header">
                <h3>配置文件与数据目录</h3>
              </div>

              <a-form-item label="配置文件位置">
                <a-space-compact block class="settings-storage-path">
                  <a-input
                    :value="profilesDir"
                    readonly
                    placeholder="获取中..."
                  />
                  <a-button class="settings-modal__button settings-modal__button--fixed" @click="openProfilesDir">
                    打开
                  </a-button>
                  <a-button
                    class="settings-modal__button settings-modal__button--icon settings-modal__button--compact"
                    @click="getProfilesDirectory"
                    title="刷新"
                  >
                    <ReloadOutlined />
                  </a-button>
                </a-space-compact>
                <div class="settings-hint">
                  SSH 主机配置和密码存储在此目录中。
                </div>
              </a-form-item>
            </section>

            <section class="settings-group">
              <div class="settings-group__header">
                <h3>导入与导出</h3>
              </div>

              <a-form-item label="主机导入导出">
                <div class="storage-actions">
                  <a-button class="settings-modal__button" @click="exportConnections(false)">导出主机配置</a-button>
                  <a-button
                    type="primary"
                    class="settings-modal__button settings-modal__primary-button"
                    @click="exportConnections(true)"
                  >
                    导出主机和密码
                  </a-button>
                  <a-button class="settings-modal__button" @click="triggerImport">导入主机包</a-button>
                  <a-button class="settings-modal__button" @click="importFromSshConfig">导入 ~/.ssh/config</a-button>
                </div>
                <div class="settings-hint">
                  导出文件格式为 `.tlink`。包含密码的导出包会额外要求设置导出密码。
                </div>
              </a-form-item>
            </section>
          </template>
        </a-form>
      </section>
    </div>

    <input
      ref="importInputRef"
      type="file"
      accept=".tlink,.json"
      style="display: none"
      @change="handleImportFile"
    />
    <template #footer>
      <div class="settings-modal__footer">
        <a-button class="settings-modal__action settings-modal__action--ghost" @click="handleCancel">
          取消
        </a-button>
        <a-button
          type="primary"
          class="settings-modal__action settings-modal__action--primary settings-modal__primary-button"
          @click="handleSave"
        >
          确定
        </a-button>
      </div>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from 'vue'
import { CloseOutlined, ReloadOutlined } from '@antdv-next/icons'
import { invoke } from '@tauri-apps/api/core'
import ImportExportService from '../services/ImportExportService'
import { createImportedSshProfile } from '../utils/sshConfigImport.js'
import type {
  ImportPreview,
  ParsedSshConfigHost,
  SelectOption,
  SshProfile,
  TerminalConfig,
  ThemeCenterConfig,
  ThemeMode,
  ThemeName,
  ThemePresetOption,
  ThemeStatusSaturation,
} from '../types/app'

type SettingsSectionKey = 'general' | 'terminal' | 'appearance' | 'storage'

type SettingsSection = {
  key: SettingsSectionKey
  label: string
  eyebrow: string
}

const DEFAULT_THEME_CONFIG: ThemeCenterConfig = {
  mode: 'light',
  presetId: 'minimal-black',
  accentColor: '#111111',
  statusSaturation: 'soft',
}

function normalizeAccentColor(value: string | undefined, fallback: string) {
  const normalized = value?.trim() || ''
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized
  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    return `#${normalized.slice(1).split('').map((segment) => segment + segment).join('')}`
  }
  return fallback
}

const props = withDefaults(defineProps<{
  visible?: boolean
  terminalConfig?: TerminalConfig
  themeConfig?: ThemeCenterConfig
  themePresetOptions?: ThemePresetOption[]
  theme?: ThemeName
  profiles?: SshProfile[]
}>(), {
  visible: false,
  terminalConfig: () => ({
    fontSize: 13,
    fontFamily: 'Consolas, monospace',
    cursorBlink: true,
    cursorStyle: 'block',
    density: 'compact',
    hostCenterViewMode: 'grid',
  }),
  themeConfig: () => ({
    mode: 'light',
    presetId: 'minimal-black',
    accentColor: '#111111',
    statusSaturation: 'soft',
  }),
  themePresetOptions: () => [],
  theme: 'dark',
  profiles: () => []
})

const emit = defineEmits(['update:visible', 'saveConfig', 'saveThemeConfig', 'refreshProfiles'])

const config = ref<TerminalConfig>({ ...props.terminalConfig })
const themeConfig = ref<ThemeCenterConfig>({ ...props.themeConfig })
const profilesDir = ref('')
const importInputRef = ref<HTMLInputElement | null>(null)
const activeSection = ref<SettingsSectionKey>('general')
const closeIconNode = computed(() => h(CloseOutlined, { class: 'modal-close-icon' }))
const modalClasses = {
  container: 'settings-modal__container',
}
const modalStyles = {
  mask: {
    background: 'var(--overlay-mask-bg)',
    backdropFilter: 'blur(12px)',
  },
  container: {
    background: 'var(--overlay-panel-solid)',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-soft)',
    height: '680px',
    maxHeight: '680px',
    minHeight: '680px',
    display: 'flex',
    flexDirection: 'column',
    padding: '0',
    overflow: 'hidden',
    borderRadius: '20px',
  },
  header: {
    background: 'var(--overlay-header-bg)',
    borderBottom: '1px solid var(--overlay-divider-color)',
    marginBottom: '0',
    padding: '18px 24px 14px',
  },
  body: {
    background: 'var(--overlay-panel-solid)',
    color: 'var(--text-color)',
    flex: '1 1 auto',
    minHeight: '0',
    overflow: 'hidden',
    padding: '0',
  },
  footer: {
    background: 'color-mix(in srgb, var(--overlay-header-bg) 88%, transparent)',
    borderTop: '1px solid var(--overlay-divider-color)',
    flex: 'none',
    padding: '14px 24px 18px',
  },
}
const fontFamilyOptions: SelectOption[] = [
  { label: 'Consolas', value: 'Consolas' },
  { label: 'Monaco', value: 'Monaco' },
  { label: 'Menlo', value: 'Menlo' },
  { label: 'Courier New', value: 'Courier New' },
]
const cursorStyleOptions: SelectOption[] = [
  { label: '块状', value: 'block' },
  { label: '下划线', value: 'underline' },
  { label: '竖线', value: 'bar' },
]
const densityOptions: SelectOption[] = [
  { label: '舒适', value: 'comfortable' },
  { label: '平衡', value: 'balanced' },
  { label: '紧凑', value: 'compact' },
]
const themeModeOptions: SelectOption[] = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
  { label: '系统', value: 'system' },
]
const statusSaturationOptions: SelectOption[] = [
  { label: '柔和', value: 'soft' },
  { label: '标准', value: 'normal' },
]
const themePresetOptions = computed<SelectOption[]>(() => (
  props.themePresetOptions.map((option) => ({
    label: option.label,
    value: option.value,
  }))
))
const hostCenterViewOptions: SelectOption[] = [
  { label: '列表视图', value: 'list' },
  { label: '卡片视图', value: 'grid' },
]
const currentPreset = computed(() => (
  props.themePresetOptions.find((option) => option.value === themeConfig.value.presetId)
  || props.themePresetOptions[0]
  || null
))
const settingsSections: SettingsSection[] = [
  {
    key: 'general',
    label: '常规',
    eyebrow: 'General',
  },
  {
    key: 'terminal',
    label: '终端',
    eyebrow: 'Terminal',
  },
  {
    key: 'appearance',
    label: '外观',
    eyebrow: 'Appearance',
  },
  {
    key: 'storage',
    label: '存储与导入',
    eyebrow: 'Storage',
  },
]
const currentSection = computed(() => (
  settingsSections.find((section) => section.key === activeSection.value) || settingsSections[0]
))
const currentPresetDescription = computed(() => (
  currentPreset.value?.description || '预设会统一控制浅色 / 深色表面的层次和基调。'
))
const currentPresetLabel = computed(() => currentPreset.value?.label || '自定义主题')
const currentModeLabel = computed(() => {
  const labels: Record<ThemeMode, string> = {
    light: '固定浅色',
    dark: '固定深色',
    system: `跟随系统（当前 ${props.theme === 'dark' ? '深色' : '浅色'}）`,
  }
  return labels[themeConfig.value.mode]
})
const currentSaturationLabel = computed(() => {
  const labels: Record<ThemeStatusSaturation, string> = {
    soft: '状态色柔和',
    normal: '状态色标准',
  }
  return labels[themeConfig.value.statusSaturation]
})

// 监听 props 变化，创建本地副本
watch(() => props.terminalConfig, (newConfig) => {
  config.value = { ...newConfig }
}, { deep: true, immediate: true })

watch(() => props.themeConfig, (newConfig) => {
  const fallbackAccent = props.themePresetOptions.find((option) => option.value === newConfig?.presetId)?.accent
    || DEFAULT_THEME_CONFIG.accentColor

  themeConfig.value = {
    ...DEFAULT_THEME_CONFIG,
    ...newConfig,
    accentColor: normalizeAccentColor(newConfig?.accentColor, fallbackAccent),
  }
}, { deep: true, immediate: true })

watch(() => props.visible, (visible) => {
  if (visible) {
    activeSection.value = 'general'
  }
})

// 保存配置
function handleSave() {
  emit('saveConfig', { ...config.value })
  emit('saveThemeConfig', { ...themeConfig.value })
  emit('update:visible', false)
}

// 取消
function handleCancel() {
  emit('update:visible', false)
  // 重置配置
  config.value = { ...props.terminalConfig }
  themeConfig.value = {
    ...DEFAULT_THEME_CONFIG,
    ...props.themeConfig,
  }
}

function handlePresetChange(value: ThemePresetOption['value']) {
  const nextPreset = props.themePresetOptions.find((option) => option.value === value)
  if (!nextPreset) return

  themeConfig.value = {
    ...themeConfig.value,
    presetId: value,
    accentColor: nextPreset.accent || themeConfig.value.accentColor,
  }
}

function handleAccentColorChange(value: string) {
  themeConfig.value = {
    ...themeConfig.value,
    accentColor: normalizeAccentColor(value, themeConfig.value.accentColor),
  }
}

function handleAccentPickerInput(event: Event) {
  handleAccentColorChange((event.target as HTMLInputElement).value)
}

function handleAccentTextInput(value: string) {
  handleAccentColorChange(value)
}

function resetAccentColor() {
  if (!currentPreset.value?.accent) return
  themeConfig.value = {
    ...themeConfig.value,
    accentColor: currentPreset.value.accent,
  }
}

// 获取配置文件目录
async function getProfilesDirectory() {
  try {
    const dir = await invoke<string>('get_profiles_dir')
    profilesDir.value = dir
  } catch (error) {
    console.error('获取配置目录失败:', error)
    message.error('获取配置目录失败')
  }
}

// 打开配置文件目录
async function openProfilesDir() {
  if (!profilesDir.value) {
    await getProfilesDirectory()
  }
  
  if (profilesDir.value) {
    try {
      await invoke('open_file_explorer', { path: profilesDir.value })
    } catch (error) {
      console.error('打开目录失败:', error)
      message.error('打开目录失败')
    }
  }
}

async function promptText(
  title: string,
  placeholder: string,
  description: string,
  password = false,
) {
  let value = ''

  return new Promise<string | null>((resolve) => {
    Modal.confirm({
      title,
      content: h('div', { class: 'termlink-confirm-stack' }, [
        h('div', { style: 'white-space: pre-line; line-height: 1.6;' }, description),
        h('input', {
          class: 'termlink-confirm-input',
          type: password ? 'password' : 'text',
          autofocus: true,
          placeholder,
          onInput: (event: Event) => {
            value = (event.target as HTMLInputElement).value
          },
        }),
      ]),
      okText: '确定',
      cancelText: '取消',
      onOk: async () => resolve(value.trim() || null),
      onCancel: async () => resolve(null),
    })
  })
}

async function exportConnections(includePasswords: boolean) {
  try {
    if (!props.profiles.length) {
      message.warning('当前没有可导出的主机')
      return
    }

    let exportPassword: string | null = null
    if (includePasswords) {
      exportPassword = await promptText(
        '设置导出密码',
        '请输入导出密码',
        '导出主机和密码需要设置一个导出密码。导入该文件时需要再次输入。',
        true,
      )

      if (!exportPassword) {
        return
      }
    }

    const content = await ImportExportService.buildExportPackage(
      includePasswords,
      exportPassword || undefined,
    )
    const fileName = `termlink-hosts-${Date.now()}.tlink`
    const savePath = await invoke<string | null>('select_download_location', { fileName })

    if (!savePath) {
      return
    }

    await ImportExportService.saveExportPackage(savePath, content)
    message.success(`导出成功: ${savePath}`)
  } catch (error) {
    console.error('导出主机失败:', error)
    message.error(`导出主机失败: ${error}`)
  }
}

function triggerImport() {
  importInputRef.value?.click()
}

async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  if (!file) {
    return
  }

  try {
    const content = await file.text()
    const preview = await ImportExportService.previewImport(content)
    await confirmImport(preview, content)
  } catch (error) {
    console.error('读取导入文件失败:', error)
    message.error(`读取导入文件失败: ${error}`)
  }
}

async function confirmImport(preview: ImportPreview, content: string) {
  let exportPassword: string | null = null

  if (preview.includesPasswords) {
    exportPassword = await promptText(
      '输入导入密码',
      '请输入导入密码',
      '这个导入包包含已保存密码。请输入导出该文件时设置的密码。',
      true,
    )

    if (!exportPassword) {
      return
    }
  }

  const summary = preview.connections
    .slice(0, 5)
    .map((item) => `- ${item.name} (${item.username}@${item.host})`)
    .join('\n')
  const remaining = preview.connections.length > 5
    ? `\n- 以及另外 ${preview.connections.length - 5} 台主机`
    : ''

  Modal.confirm({
    title: '确认导入主机',
    content: h(
      'div',
      { style: 'white-space: pre-line; line-height: 1.6;' },
      `将导入 ${preview.connectionCount} 台主机。\n冲突策略固定为“保留副本”。\n\n${summary}${remaining}`,
    ),
    okText: '导入',
    cancelText: '取消',
    onOk: async () => {
      try {
        const result = await ImportExportService.importPackage(
          content,
          exportPassword || undefined,
          'duplicate',
        )
        emit('refreshProfiles')
        message.success(
          `导入完成：新增 ${result.importedCount}，跳过 ${result.skippedCount}，覆盖 ${result.overwrittenCount}`,
        )
      } catch (error) {
        console.error('导入主机失败:', error)
        message.error(`导入主机失败: ${error}`)
      }
    },
  })
}

async function importFromSshConfig() {
  try {
    const entries = await invoke<ParsedSshConfigHost[]>('parse_default_ssh_config')
    if (!entries.length) {
      message.warning('未找到 ~/.ssh/config')
      return
    }

    const summary = entries
      .slice(0, 6)
      .map((item) => `- ${item.alias} (${item.username || '未设置用户'}@${item.host}:${item.port})`)
      .join('\n')
    const remaining = entries.length > 6 ? `\n- 以及另外 ${entries.length - 6} 条` : ''

    Modal.confirm({
      title: '导入 ~/.ssh/config',
      content: h(
        'div',
        { style: 'white-space: pre-line; line-height: 1.6;' },
        `检测到 ${entries.length} 条可导入 Host 记录。\n将以“SSH Config”分组导入，并保留 ProxyJump / LocalForward 关系。\n\n${summary}${remaining}`,
      ),
      okText: '导入',
      cancelText: '取消',
      onOk: async () => {
        const aliasToId = new Map<string, string>()
        const existingAliasMap = new Map<string, SshProfile>()
        props.profiles.forEach((profile) => {
          if (profile.ssh_config_host) {
            existingAliasMap.set(profile.ssh_config_host, profile)
          }
        })

        const profilesToImport = entries.map((entry) => {
          const profile = createImportedSshProfile(entry, aliasToId, existingAliasMap, entries)
          aliasToId.set(entry.alias, profile.id)
          return profile
        })

        for (const profile of profilesToImport) {
          await invoke('save_ssh_profile', {
            profile,
            password: null,
          })
        }

        emit('refreshProfiles')
        message.success(`已从 ~/.ssh/config 导入 ${profilesToImport.length} 台主机`)
      },
    })
  } catch (error) {
    console.error('导入 SSH config 失败:', error)
    message.error(`导入 SSH config 失败: ${error}`)
  }
}

// 组件挂载时获取配置目录
onMounted(() => {
  getProfilesDirectory()
})
</script>

<style scoped>
:deep(.settings-modal .ant-modal-content) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  overflow: hidden;
  border-radius: 20px;
}

:deep(.settings-modal__container) {
  background: var(--overlay-panel-solid) !important;
  border-radius: 20px;
}

:deep(.settings-modal .ant-modal-body) {
  flex: 1 1 auto;
  background: var(--overlay-panel-solid);
  min-height: 0;
  padding: 0 !important;
  overflow: hidden;
}

:deep(.settings-modal .ant-modal-header) {
  border-bottom: 1px solid var(--overlay-divider-color);
  margin-bottom: 0 !important;
  padding: 18px 24px 14px !important;
}

:deep(.settings-modal .ant-modal-footer) {
  border-top: 1px solid var(--overlay-divider-color);
  padding: 14px 24px 18px !important;
  background: var(--overlay-panel-solid) !important;
}

:deep(.settings-modal .ant-modal-close) {
  color: rgba(255, 255, 255, 0.88);
}

:deep(.settings-modal .modal-close-icon),
:deep(.settings-modal .modal-close-icon svg) {
  color: rgba(255, 255, 255, 0.88) !important;
}

:deep(.settings-modal .ant-modal-close:hover) {
  color: var(--text-color);
  background: var(--hover-bg);
}

:deep(.ant-form-item) {
  margin-bottom: 14px;
}

:deep(.ant-form-item-label > label) {
  color: var(--text-color) !important;
  font-weight: 600;
}

:deep(.ant-input-number),
:deep(.ant-input),
:deep(.ant-select .ant-select-selector) {
  background: var(--surface-1);
  border-color: var(--border-color);
  color: var(--text-color);
}

:deep(.ant-input-number::placeholder),
:deep(.ant-select-selection-placeholder) {
  color: var(--muted-color) !important;
}

:deep(.ant-input-number .ant-input-number-input) {
  color: var(--text-color) !important;
}

:deep(.ant-input-number-focused),
:deep(.ant-select-focused .ant-select-selector) {
  border-color: var(--primary-color) !important;
  box-shadow: 0 0 0 4px var(--primary-soft) !important;
}

:deep(.ant-switch) {
  background: color-mix(in srgb, var(--muted-color) 30%, transparent);
}

:deep(.ant-switch-checked) {
  background: var(--primary-color);
}

:deep(.ant-segmented) {
  background: var(--surface-2);
  border: 1px solid var(--border-color);
}

:deep(.ant-segmented-item) {
  color: var(--muted-color);
}

:deep(.ant-segmented-item-selected) {
  background: var(--surface-1);
  color: var(--text-color);
  box-shadow: var(--shadow-card);
}

.settings-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  height: 100%;
  min-height: 0;
}

.settings-sidebar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 14px;
  border-right: 1px solid var(--overlay-divider-color);
  background: color-mix(in srgb, var(--surface-1) 88%, transparent);
}

.settings-sidebar__intro {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-sidebar__eyebrow,
.settings-content__eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-color);
}

.settings-sidebar__title {
  font-size: 15px;
  font-weight: 800;
  line-height: 1.2;
  color: var(--text-color);
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-nav__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--text-color);
  cursor: pointer;
  text-align: left;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease;
}

.settings-nav__item:hover {
  background: color-mix(in srgb, var(--surface-2) 74%, transparent);
  border-color: color-mix(in srgb, var(--border-color) 78%, transparent);
}

.settings-nav__item.is-active {
  background: var(--surface-1);
  border-color: color-mix(in srgb, var(--text-color) 14%, var(--border-color));
}

.settings-nav__accent {
  display: inline-flex;
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-color) 16%, transparent);
}

.settings-nav__item.is-active .settings-nav__accent {
  background: var(--text-color);
}

.settings-nav__label {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-color);
}

.settings-content {
  display: flex;
  min-height: 0;
  flex-direction: column;
  min-width: 0;
  padding: 18px 20px 16px;
  overflow-y: auto;
}

.settings-content__header {
  margin-bottom: 10px;
}

.settings-content__title {
  margin: 4px 0 0;
  color: var(--text-color);
  font-size: 18px;
  font-weight: 800;
  line-height: 1.2;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.settings-group {
  padding: 14px 16px 16px;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: var(--surface-1);
}

.settings-group + .settings-group {
  margin-top: 0;
}

.settings-group__header {
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--border-color) 80%, transparent);
}

.settings-group__header h3 {
  margin: 0;
  color: var(--text-color);
  font-size: 14px;
  font-weight: 800;
}

.settings-field--full {
  width: 100%;
}

.settings-toggle-row {
  display: flex;
  min-height: 36px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 10px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--surface-1);
}

.settings-toggle-row__label {
  color: var(--text-color);
  font-size: 12px;
  font-weight: 600;
}

.settings-hint {
  margin-top: 4px;
  color: var(--muted-color);
  font-size: 11px;
  line-height: 1.5;
}

.theme-accent-row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.theme-accent-swatch {
  display: inline-flex;
  width: 40px;
  height: 36px;
  padding: 5px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--surface-1);
  cursor: pointer;
}

.theme-accent-native {
  width: 100%;
  height: 100%;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.theme-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 2px;
}

.theme-summary-card {
  min-height: 86px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--surface-1);
}

.theme-summary-card__label {
  color: var(--muted-color);
  font-size: 12px;
  font-weight: 600;
}

.theme-summary-card__value {
  margin-top: 8px;
  color: var(--text-color);
  font-size: 14px;
  font-weight: 700;
}

.theme-summary-card__meta {
  margin-top: 6px;
  color: var(--muted-color);
  font-size: 11px;
  line-height: 1.5;
}

.theme-status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.theme-status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 11px;
  font-weight: 700;
}

.theme-status-pill--connected {
  background: var(--connection-connected-soft);
  color: var(--connection-connected);
  border-color: color-mix(in srgb, var(--connection-connected) 20%, transparent);
}

.theme-status-pill--connecting {
  background: var(--connection-connecting-soft);
  color: var(--connection-connecting);
  border-color: color-mix(in srgb, var(--connection-connecting) 20%, transparent);
}

.theme-status-pill--disconnected {
  background: var(--connection-disconnected-soft);
  color: var(--connection-disconnected);
  border-color: color-mix(in srgb, var(--connection-disconnected) 20%, transparent);
}

.storage-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.settings-storage-path {
  width: 100%;
}

.settings-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

:global(.settings-modal__button) {
  border-radius: 10px !important;
  border-color: var(--border-color) !important;
  background: var(--surface-1) !important;
  color: var(--text-color) !important;
  box-shadow: none !important;
}

:global(.settings-modal__button:hover) {
  border-color: var(--strong-border) !important;
  background: var(--surface-2) !important;
  color: var(--text-color) !important;
}

:global(.settings-modal__button--icon) {
  padding-inline: 0 !important;
}

:global(.settings-modal__button--fixed) {
  width: 64px !important;
}

:global(.settings-modal__button--compact) {
  width: 40px !important;
}

:global(.settings-modal__action) {
  min-width: 80px;
  border-radius: 10px !important;
  font-weight: 700;
}

:global(.settings-modal__action--ghost) {
  background: var(--surface-2) !important;
  border-color: var(--border-color) !important;
  color: var(--text-color) !important;
}

:global(.settings-modal__action--ghost:hover) {
  background: var(--hover-bg) !important;
  border-color: var(--strong-border) !important;
}

:global(.settings-modal .ant-btn.settings-modal__primary-button),
:global(.settings-modal .ant-btn-primary.settings-modal__primary-button) {
  background: var(--text-color) !important;
  border-color: var(--text-color) !important;
  color: var(--bg-color) !important;
}

:global(.settings-modal .ant-btn.settings-modal__primary-button:hover),
:global(.settings-modal .ant-btn-primary.settings-modal__primary-button:hover) {
  background: var(--strong-border) !important;
  border-color: var(--strong-border) !important;
  color: var(--bg-color) !important;
}

:deep(.settings-modal .ant-modal-content),
:deep(.settings-modal__container) {
  border-radius: 14px !important;
}

:deep(.settings-modal__action) {
  border-radius: 10px !important;
}

@media (max-width: 720px) {
  .settings-layout {
    grid-template-columns: 1fr;
  }

  .settings-sidebar {
    gap: 10px;
    padding: 14px 16px 12px;
    border-right: 0;
    border-bottom: 1px solid var(--overlay-divider-color);
  }

  .settings-nav {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .settings-content {
    padding: 14px 16px;
  }

  .theme-accent-row {
    grid-template-columns: 40px minmax(0, 1fr);
  }

  .theme-summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .settings-nav {
    grid-template-columns: 1fr;
  }

  .settings-content__title {
    font-size: 17px;
  }

  .settings-group {
    padding: 12px;
  }
}
</style>
