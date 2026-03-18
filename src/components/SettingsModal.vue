<template>
  <a-modal
    :open="visible"
    title="程序配置"
    width="600px"
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
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { ReloadOutlined } from '@antdv-next/icons'
import { invoke } from '@tauri-apps/api/core'
import { message } from 'antdv-next'
import type { SelectOption, TerminalConfig, ThemeName } from '../types/app'

const props = withDefaults(defineProps<{
  visible?: boolean
  terminalConfig?: TerminalConfig
  theme?: ThemeName
}>(), {
  visible: false,
  terminalConfig: () => ({
    fontSize: 14,
    fontFamily: 'Consolas, monospace',
    cursorBlink: true,
    cursorStyle: 'block'
  }),
  theme: 'dark'
})

const emit = defineEmits(['update:visible', 'saveConfig', 'changeTheme'])

const config = ref<TerminalConfig>({ ...props.terminalConfig })
const currentTheme = ref<ThemeName>(props.theme)
const profilesDir = ref('')
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
      // 在Windows上使用explorer打开目录
      await invoke('start_pty', { 
        id: `explorer-${Date.now()}`, 
        cols: 1, 
        rows: 1, 
        program: 'explorer', 
        args: [profilesDir.value] 
      })
    } catch (error) {
      console.error('打开目录失败:', error)
      message.error('打开目录失败')
    }
  }
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
</style>
