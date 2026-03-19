<template>
  <a-modal
    :open="visible"
    title="程序配置"
    width="640px"
    @ok="handleSave"
    @cancel="handleCancel"
  >
    <a-form layout="vertical">
      <a-divider>终端设置</a-divider>
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="字体大小">
            <a-input-number 
              v-model:value="config.fontSize" 
              :min="8" 
              :max="32" 
              style="width: 100%" 
            />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="字体族">
            <a-select
              v-model:value="config.fontFamily"
              :options="fontFamilyOptions"
              style="width: 100%"
            />
          </a-form-item>
        </a-col>
      </a-row>
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="光标闪烁">
            <a-switch v-model:checked="config.cursorBlink" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="光标样式">
            <a-select
              v-model:value="config.cursorStyle"
              :options="cursorStyleOptions"
              style="width: 100%"
            />
          </a-form-item>
        </a-col>
      </a-row>
      <a-form-item label="界面密度">
        <a-segmented
          block
          :options="densityOptions"
          v-model:value="config.density"
        />
        <div style="margin-top: 6px; color: var(--muted-color); font-size: 12px;">
          紧凑模式会优先给终端和文件区更多有效显示空间，适合 SSH、日志和文件巡检。
        </div>
      </a-form-item>
      
      <a-divider>主题设置</a-divider>
      <a-form-item label="主题">
        <a-segmented 
          :options="[{label:'深色',value:'dark'},{label:'浅色',value:'light'}]" 
          v-model:value="currentTheme" 
          @change="handleThemeChange" 
        />
      </a-form-item>
      
      <a-divider>存储设置</a-divider>
      <a-form-item label="配置文件位置">
        <a-space-compact block>
          <a-input 
            :value="profilesDir" 
            readonly 
            placeholder="获取中..."
          />
          <a-button @click="openProfilesDir" style="width: 60px">打开</a-button>
          <a-button @click="getProfilesDirectory" style="width: 40px" title="刷新">
            <ReloadOutlined />
          </a-button>
        </a-space-compact>
        <div style="margin-top: 4px; color: var(--muted-color); font-size: 12px;">
          SSH连接配置和密码存储在此目录中
        </div>
      </a-form-item>

      <a-form-item label="连接导入导出">
        <div class="storage-actions">
          <a-button @click="exportConnections(false)">导出连接配置</a-button>
          <a-button type="primary" @click="exportConnections(true)">导出连接和密码</a-button>
          <a-button @click="triggerImport">导入连接包</a-button>
        </div>
        <div style="margin-top: 4px; color: var(--muted-color); font-size: 12px;">
          导出文件格式为 .tlink。包含密码的导出包会额外要求设置导出密码。
        </div>
      </a-form-item>
    </a-form>
    <input
      ref="importInputRef"
      type="file"
      accept=".tlink,.json"
      style="display: none"
      @change="handleImportFile"
    />
  </a-modal>
</template>

<script setup lang="ts">
import { h, onMounted, ref, watch } from 'vue'
import { ReloadOutlined } from '@antdv-next/icons'
import { invoke } from '@tauri-apps/api/core'
import ImportExportService from '../services/ImportExportService'
import type { ImportPreview, SelectOption, SshProfile, TerminalConfig, ThemeName } from '../types/app'

const props = withDefaults(defineProps<{
  visible?: boolean
  terminalConfig?: TerminalConfig
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
  }),
  theme: 'dark',
  profiles: () => []
})

const emit = defineEmits(['update:visible', 'saveConfig', 'changeTheme', 'refreshProfiles'])

const config = ref<TerminalConfig>({ ...props.terminalConfig })
const currentTheme = ref<ThemeName>(props.theme)
const profilesDir = ref('')
const importInputRef = ref<HTMLInputElement | null>(null)
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

// 监听 props 变化，创建本地副本
watch(() => props.terminalConfig, (newConfig) => {
  config.value = { ...newConfig }
}, { deep: true, immediate: true })

watch(() => props.theme, (newTheme) => {
  currentTheme.value = newTheme
}, { immediate: true })

// 保存配置
function handleSave() {
  emit('saveConfig', { ...config.value })
  emit('update:visible', false)
}

// 取消
function handleCancel() {
  emit('update:visible', false)
  // 重置配置
  config.value = { ...props.terminalConfig }
  currentTheme.value = props.theme
}

// 主题变化
function handleThemeChange(value: ThemeName) {
  currentTheme.value = value
  emit('changeTheme', value)
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
      content: h('div', { style: 'display: grid; gap: 10px;' }, [
        h('div', { style: 'white-space: pre-line; line-height: 1.6;' }, description),
        h('input', {
          type: password ? 'password' : 'text',
          autofocus: true,
          placeholder,
          style: 'width: 100%; padding: 8px 12px; border: 1px solid #d9d9d9; border-radius: 8px;',
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
      message.warning('当前没有可导出的连接')
      return
    }

    let exportPassword: string | null = null
    if (includePasswords) {
      exportPassword = await promptText(
        '设置导出密码',
        '请输入导出密码',
        '导出连接和密码需要设置一个导出密码。导入该文件时需要再次输入。',
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
    const fileName = `termlink-connections-${Date.now()}.tlink`
    const savePath = await invoke<string | null>('select_download_location', { fileName })

    if (!savePath) {
      return
    }

    await ImportExportService.saveExportPackage(savePath, content)
    message.success(`导出成功: ${savePath}`)
  } catch (error) {
    console.error('导出连接失败:', error)
    message.error(`导出连接失败: ${error}`)
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
    ? `\n- 以及另外 ${preview.connections.length - 5} 条连接`
    : ''

  Modal.confirm({
    title: '确认导入连接',
    content: h(
      'div',
      { style: 'white-space: pre-line; line-height: 1.6;' },
      `将导入 ${preview.connectionCount} 条连接。\n冲突策略固定为“保留副本”。\n\n${summary}${remaining}`,
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
        console.error('导入连接失败:', error)
        message.error(`导入连接失败: ${error}`)
      }
    },
  })
}

// 组件挂载时获取配置目录
onMounted(() => {
  getProfilesDirectory()
})
</script>

<style scoped>
:deep(.ant-form-item-label > label) {
  color: var(--text-color);
}

:deep(.ant-input-number),
:deep(.ant-select) {
  background: var(--panel-bg);
  border-color: var(--border-color);
  color: var(--text-color);
}

:deep(.ant-input-number::placeholder),
:deep(.ant-select-selection-placeholder) {
  color: var(--muted-color) !important;
}

:deep(.ant-input-number:focus),
:deep(.ant-select:focus) {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

:deep(.ant-switch) {
  background: var(--border-color);
}

:deep(.ant-switch-checked) {
  background: var(--primary-color);
}

:deep(.ant-segmented) {
  background: var(--panel-bg);
}

:deep(.ant-segmented-item) {
  color: var(--text-color);
}

:deep(.ant-segmented-item-selected) {
  background: var(--primary-color);
  color: white;
}

.storage-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
