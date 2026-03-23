<template>
  <a-modal
    :open="visible"
    :title="editMode ? '编辑主机' : '新建主机'"
    width="500px"
    wrap-class-name="ssh-modal"
    :classes="modalClasses"
    :styles="modalStyles"
    :close-icon="closeIconNode"
    @cancel="handleCancel"
    :confirmLoading="loading"
  >
    <a-form layout="vertical" :model="form" ref="formRef">
      <a-form-item label="主机名称" name="name">
        <a-input v-model:value="form.name" placeholder="给主机起个名字" />
      </a-form-item>
      
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="分组" name="group">
            <a-select
              v-model:value="form.group"
              :options="groupOptions"
              placeholder="选择分组"
              show-search
              option-filter-prop="label"
              allow-clear
            />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="标签" name="tags">
            <a-select
              v-model:value="form.tags"
              mode="multiple"
              :options="tagOptions"
              placeholder="选择标签颜色"
              option-filter-prop="label"
              max-tag-count="responsive"
              allow-clear
            >
              <template #optionRender="{ option }">
                <span class="ssh-tag-option">
                  <span
                    class="ssh-tag-option__dot"
                    :style="{ backgroundColor: option.data.color }"
                  ></span>
                  <span>{{ option.data.label }}</span>
                </span>
              </template>
              <template #tagRender="{ label, value, closable, onClose }">
                <span
                  class="ssh-tag-chip"
                  :style="getTagChipStyle(String(value))"
                  @mousedown.stop
                >
                  <span
                    class="ssh-tag-chip__dot"
                    :style="{ backgroundColor: getTagColor(String(value)) }"
                  ></span>
                  <span>{{ label }}</span>
                  <button
                    v-if="closable"
                    type="button"
                    class="ssh-tag-chip__close"
                    @click="onClose"
                  >
                    ×
                  </button>
                </span>
              </template>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>
      
      <a-form-item label="主机地址" name="host" :rules="[{ required: true, message: '请输入主机地址' }]">
        <a-input v-model:value="form.host" placeholder="192.168.1.100 或 example.com" />
      </a-form-item>
      
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="端口" name="port">
            <a-input-number 
              v-model:value="form.port" 
              :min="1" 
              :max="65535" 
              style="width: 100%" 
              placeholder="22"
            />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="用户名" name="username">
            <a-input v-model:value="form.username" placeholder="用户名" />
          </a-form-item>
        </a-col>
      </a-row>
      
      <a-form-item label="认证方式">
        <a-radio-group v-model:value="form.usePrivateKey">
          <a-radio :value="false">密码认证</a-radio>
          <a-radio :value="true">私钥认证</a-radio>
        </a-radio-group>
      </a-form-item>
      
      <a-form-item v-if="!form.usePrivateKey" label="密码" name="password">
        <a-input-password v-model:value="form.password" placeholder="密码" />
      </a-form-item>
      
      <a-form-item v-if="form.usePrivateKey" label="私钥文件" name="privateKey">
        <a-space-compact block>
          <a-input 
            v-model:value="form.privateKey" 
            placeholder="私钥文件路径" 
          />
          <a-button class="ssh-modal__button" @click="selectPrivateKey" style="width: 80px">浏览</a-button>
        </a-space-compact>
      </a-form-item>

      <a-form-item v-if="form.usePrivateKey" label="私钥密码短语" name="privateKeyPassphrase">
        <a-input-password
          v-model:value="form.privateKeyPassphrase"
          placeholder="如私钥已加密，可先填写密码短语"
        />
      </a-form-item>

      <a-divider>高级 SSH</a-divider>

      <a-form-item label="堡垒机 / ProxyJump">
        <a-select
          v-model:value="form.proxyJumpId"
          :options="proxyJumpOptions"
          placeholder="不使用堡垒机"
          allow-clear
          show-search
          option-filter-prop="label"
          @change="handleProxyJumpChange"
        />
        <div style="margin-top: 6px; color: var(--muted-color); font-size: 12px;">
          选择已保存主机作为跳板机。建立连接时会先经过该主机。
        </div>
      </a-form-item>

      <a-form-item label="本地端口转发">
        <div class="ssh-forward-list">
          <div
            v-for="(forward, index) in form.portForwards"
            :key="forward.id"
            class="ssh-forward-item"
          >
            <a-input-number
              v-model:value="forward.localPort"
              :min="1"
              :max="65535"
              placeholder="本地端口"
            />
            <span class="ssh-forward-arrow">→</span>
            <a-input
              v-model:value="forward.remoteHost"
              placeholder="目标主机"
            />
            <a-input-number
              v-model:value="forward.remotePort"
              :min="1"
              :max="65535"
              placeholder="目标端口"
            />
            <a-button class="ssh-modal__button ssh-modal__button--danger" danger @click="removePortForward(index)">删除</a-button>
          </div>
        </div>
        <a-button type="dashed" block class="ssh-modal__button ssh-modal__button--dashed" @click="addPortForward">
          新增本地端口转发
        </a-button>
      </a-form-item>

      <a-divider>工作流模板</a-divider>

      <a-form-item label="环境变量模板">
        <div class="ssh-template-list">
          <div
            v-for="(envItem, index) in form.envTemplates"
            :key="envItem.id"
            class="ssh-template-item ssh-template-item--card ssh-template-item--env"
          >
            <div class="ssh-template-item__header">
              <div class="ssh-template-item__eyebrow">环境变量</div>
              <a-button
                type="text"
                size="small"
                class="ssh-modal__icon-action ssh-modal__icon-action--danger"
                @click="removeEnvTemplate(index)"
              >
                <DeleteOutlined />
              </a-button>
            </div>
            <div class="ssh-template-item__main">
              <div class="ssh-template-item__row">
                <a-input
                  v-model:value="envItem.key"
                  placeholder="变量名，例如 APP_ENV"
                />
                <a-input
                  v-model:value="envItem.value"
                  placeholder="变量值"
                />
              </div>
            </div>
          </div>
        </div>
        <a-button type="dashed" block class="ssh-modal__button ssh-modal__button--dashed" @click="addEnvTemplate">
          新增环境变量
        </a-button>
      </a-form-item>

      <a-form-item label="连接后启动任务">
        <div class="ssh-template-list">
          <div
            v-for="(task, index) in form.startupTasks"
            :key="task.id"
            class="ssh-template-item ssh-template-item--card ssh-template-item--command"
          >
            <div class="ssh-template-item__header">
              <div class="ssh-template-item__eyebrow">启动任务</div>
              <div class="ssh-template-item__tools ssh-template-item__tools--compact">
                <span class="ssh-template-item__status" :class="{ 'is-inactive': !task.enabled }">
                  {{ task.enabled ? '已启用' : '已关闭' }}
                </span>
                <a-switch v-model:checked="task.enabled" size="small" />
                <a-button
                  type="text"
                  size="small"
                  class="ssh-modal__icon-action"
                  @click="moveStartupTask(index, -1)"
                  :disabled="index === 0"
                >
                  上
                </a-button>
                <a-button
                  type="text"
                  size="small"
                  class="ssh-modal__icon-action"
                  @click="moveStartupTask(index, 1)"
                  :disabled="index === form.startupTasks.length - 1"
                >
                  下
                </a-button>
                <a-button
                  type="text"
                  size="small"
                  class="ssh-modal__icon-action ssh-modal__icon-action--danger"
                  @click="removeStartupTask(index)"
                >
                  <DeleteOutlined />
                </a-button>
              </div>
            </div>
            <div class="ssh-template-item__main">
              <a-input
                v-model:value="task.name"
                placeholder="任务名称，例如 初始化工作目录"
              />
              <a-input
                v-model:value="task.command"
                placeholder="连接后自动执行的命令"
              />
            </div>
          </div>
        </div>
        <div class="ssh-template-hint">
          按当前顺序执行，关闭的任务会跳过；执行结果和失败退出码会直接显示在终端中。
        </div>
        <a-button type="dashed" block class="ssh-modal__button ssh-modal__button--dashed" @click="addStartupTask">
          新增启动任务
        </a-button>
      </a-form-item>

      <a-form-item label="常用命令片段">
        <div class="ssh-template-list">
          <div
            v-for="(snippet, index) in form.commandSnippets"
            :key="snippet.id"
            class="ssh-template-item ssh-template-item--card ssh-template-item--snippet"
          >
            <div class="ssh-template-item__header">
              <div class="ssh-template-item__eyebrow">命令片段</div>
              <a-button
                type="text"
                size="small"
                class="ssh-modal__icon-action ssh-modal__icon-action--danger"
                @click="removeCommandSnippet(index)"
              >
                <DeleteOutlined />
              </a-button>
            </div>
            <div class="ssh-template-item__main ssh-template-item__main--snippet">
              <div class="ssh-template-item__row">
                <a-input
                  v-model:value="snippet.name"
                  placeholder="片段名称，例如 查看日志"
                />
                <a-input
                  v-model:value="snippet.group"
                  placeholder="分组，例如 排障 / 部署"
                />
              </div>
              <a-input
                v-model:value="snippet.command"
                placeholder="可在工作区一键发送的命令"
              />
            </div>
          </div>
        </div>
        <div class="ssh-template-hint">
          可按主机内分组整理片段，工作区支持按名称、分组和命令内容即时搜索。
        </div>
        <a-button type="dashed" block class="ssh-modal__button ssh-modal__button--dashed" @click="addCommandSnippet">
          新增命令片段
        </a-button>
      </a-form-item>

      <a-form-item v-if="form.sshConfigSource || form.sshConfigHost" label="SSH Config 来源">
        <div class="ssh-config-meta">
          <span v-if="form.sshConfigHost">Host {{ form.sshConfigHost }}</span>
          <span v-if="form.sshConfigSource">来自 {{ form.sshConfigSource }}</span>
        </div>
      </a-form-item>
      
    <a-form-item>
        <a-checkbox v-model:checked="form.savePassword">
          保存主机配置
        </a-checkbox>
        <div v-if="form.savePassword" style="margin-top: 8px; color: var(--muted-color); font-size: 12px;">
          配置将保存在本地，密码会被安全加密存储
        </div>
      </a-form-item>
    </a-form>
    <template #footer>
      <div class="ssh-modal__footer">
        <a-button class="ssh-modal__action ssh-modal__action--ghost" @click="handleCancel">
          取消
        </a-button>
        <a-button
          type="primary"
          class="ssh-modal__action ssh-modal__action--primary ssh-modal__primary-button"
          :loading="loading"
          @click="handleSubmit"
        >
          确定
        </a-button>
      </div>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { CloseOutlined, DeleteOutlined } from '@antdv-next/icons'
import type {
  CommandSnippet,
  EnvTemplate,
  SelectOption,
  SshModalForm,
  SshPortForward,
  SshProfile,
  StartupTask,
} from '../types/app'
import { PROFILE_TAG_PRESETS } from '../constants/profileTags'
import { normalizeCommandSnippets } from '../utils/commandSnippets'

const props = withDefaults(defineProps<{
  visible?: boolean
  editMode?: boolean
  editProfile?: SshProfile | null
  groups?: string[]
  profiles?: SshProfile[]
}>(), {
  visible: false,
  editMode: false,
  editProfile: null,
  groups: () => [],
  profiles: () => []
})

const emit = defineEmits(['update:visible', 'submit'])

const formRef = ref()
const loading = ref(false)
const SSH_MODAL_FIXED_HEIGHT = 'min(760px, calc(100vh - 24px))'
const closeIconNode = computed(() => h(CloseOutlined, { class: 'modal-close-icon' }))
const modalClasses = {
  container: 'ssh-modal__container',
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
    height: SSH_MODAL_FIXED_HEIGHT,
    minHeight: SSH_MODAL_FIXED_HEIGHT,
    maxHeight: SSH_MODAL_FIXED_HEIGHT,
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
    overflowY: 'auto',
    padding: '18px 24px 16px',
  },
  footer: {
    background: 'color-mix(in srgb, var(--overlay-header-bg) 88%, transparent)',
    borderTop: '1px solid var(--overlay-divider-color)',
    flex: 'none',
    padding: '14px 24px 18px',
  },
}

const createInitialForm = (): SshModalForm => ({
  name: '',
  host: '',
  port: 22,
  username: '',
  password: '',
  privateKey: '',
  privateKeyPassphrase: '',
  usePrivateKey: false,
  savePassword: true,
  group: '',
  tags: [],
  proxyJumpId: null,
  proxyJumpName: null,
  proxyJumpHost: null,
  proxyJumpPort: null,
  proxyJumpUsername: null,
  proxyJumpPrivateKey: null,
  proxyJumpPrivateKeyPassphrase: null,
  sshConfigSource: null,
  sshConfigHost: null,
  portForwards: [],
  commandSnippets: [],
  startupTasks: [],
  envTemplates: [],
})

const form = ref<SshModalForm>(createInitialForm())

const groupOptions = computed<SelectOption[]>(() => {
  const values = new Set(props.groups)
  if (form.value.group?.trim()) {
    values.add(form.value.group.trim())
  }

  return Array.from(values).map((group) => ({
    value: group,
    label: group
  }))
})

const tagOptions = computed(() => {
  const values = new Map(PROFILE_TAG_PRESETS.map((preset) => [preset.value, preset]))

  form.value.tags.forEach((tag) => {
    if (!values.has(tag)) {
      values.set(tag, {
        value: tag,
        label: tag,
        color: '#94a3b8',
        background: 'rgba(148, 163, 184, 0.16)',
        border: 'rgba(148, 163, 184, 0.26)',
        text: '#475569',
        darkBackground: 'rgba(148, 163, 184, 0.16)',
        darkBorder: 'rgba(148, 163, 184, 0.28)',
        darkText: '#cbd5e1',
      })
    }
  })

  return Array.from(values.values())
})

const proxyJumpOptions = computed<SelectOption[]>(() => (
  props.profiles
    .filter((profile) => profile.id !== props.editProfile?.id)
    .map((profile) => ({
      value: profile.id,
      label: profile.name || `${profile.username}@${profile.host}:${profile.port}`,
    }))
))

// 重置表单
function resetForm() {
  if (props.editMode && props.editProfile) {
    // 编辑模式，填充现有数据
    form.value = {
      id: props.editProfile.id,
      name: props.editProfile.name || '',
      host: props.editProfile.host || '',
      port: props.editProfile.port || 22,
      username: props.editProfile.username || '',
      password: '', // 不显示密码
      privateKey: props.editProfile.private_key || '',
      privateKeyPassphrase: '',
      usePrivateKey: Boolean(props.editProfile.private_key),
      savePassword: true,
      group: props.editProfile.group || '',
      tags: props.editProfile.tags || [],
      proxyJumpId: props.editProfile.proxy_jump_id || null,
      proxyJumpName: props.editProfile.proxy_jump_name || null,
      proxyJumpHost: props.editProfile.proxy_jump_host || null,
      proxyJumpPort: props.editProfile.proxy_jump_port || null,
      proxyJumpUsername: props.editProfile.proxy_jump_username || null,
      proxyJumpPrivateKey: props.editProfile.proxy_jump_private_key || null,
      proxyJumpPrivateKeyPassphrase: props.editProfile.proxy_jump_private_key_passphrase || null,
      sshConfigSource: props.editProfile.ssh_config_source || null,
      sshConfigHost: props.editProfile.ssh_config_host || null,
      portForwards: props.editProfile.port_forwards?.map((item) => ({ ...item })) || [],
      commandSnippets: props.editProfile.command_snippets?.map((item) => ({ ...item })) || [],
      startupTasks: props.editProfile.startup_tasks?.map((item) => ({
        ...item,
        enabled: item.enabled !== false,
      })) || [],
      envTemplates: props.editProfile.env_templates?.map((item) => ({ ...item })) || [],
    }
  } else {
    // 新建模式
    form.value = createInitialForm()
  }
  formRef.value?.resetFields()
}

function createEmptyPortForward(): SshPortForward {
  return {
    id: `forward-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type: 'local',
    localPort: 8080,
    remoteHost: '127.0.0.1',
    remotePort: 80,
    label: '',
  }
}

function createEmptyCommandSnippet(): CommandSnippet {
  return {
    id: `snippet-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: '',
    command: '',
    group: '',
  }
}

function createEmptyStartupTask(): StartupTask {
  return {
    id: `startup-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: '',
    command: '',
    enabled: true,
  }
}

function createEmptyEnvTemplate(): EnvTemplate {
  return {
    id: `env-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    key: '',
    value: '',
  }
}

function normalizeNamedCommands<T extends { id: string; name: string; command: string }>(items: T[]) {
  return items
    .map((item) => ({
      ...item,
      name: item.name.trim(),
      command: item.command.trim(),
    }))
    .filter((item) => item.name && item.command)
}

function normalizeStartupTasks(items: StartupTask[]) {
  return normalizeNamedCommands(items)
    .map((item) => ({
      ...item,
      enabled: item.enabled !== false,
    }))
}

function normalizeEnvTemplates(items: EnvTemplate[]) {
  return items
    .map((item) => ({
      ...item,
      key: item.key.trim(),
      value: item.value.trim(),
    }))
    .filter((item) => item.key)
}

function getTagColor(tag: string) {
  return tagOptions.value.find((option) => option.value === tag)?.color || '#94a3b8'
}

function getTagChipStyle(tag: string) {
  const option = tagOptions.value.find((item) => item.value === tag)
  if (!option) {
    return {}
  }

  return {
    backgroundColor: option.background,
    borderColor: option.border,
    color: option.text,
  }
}

// 提交表单
async function handleSubmit() {
  try {
    await formRef.value.validate()
    loading.value = true
    
    const submitData: SshModalForm = { ...form.value }
    if (submitData.proxyJumpId) {
      const proxyProfile = props.profiles.find((item) => item.id === submitData.proxyJumpId)
      if (proxyProfile) {
        submitData.proxyJumpName = proxyProfile.name || `${proxyProfile.username}@${proxyProfile.host}:${proxyProfile.port}`
        submitData.proxyJumpHost = proxyProfile.host
        submitData.proxyJumpPort = proxyProfile.port
        submitData.proxyJumpUsername = proxyProfile.username
        submitData.proxyJumpPrivateKey = proxyProfile.private_key || null
        submitData.proxyJumpPrivateKeyPassphrase = proxyProfile.private_key_passphrase || null
      }
    } else {
      submitData.proxyJumpName = null
      submitData.proxyJumpHost = null
      submitData.proxyJumpPort = null
      submitData.proxyJumpUsername = null
      submitData.proxyJumpPrivateKey = null
      submitData.proxyJumpPrivateKeyPassphrase = null
    }
    if (props.editMode) {
      submitData.isEdit = true
    }
    submitData.commandSnippets = normalizeCommandSnippets(submitData.commandSnippets)
    submitData.startupTasks = normalizeStartupTasks(submitData.startupTasks)
    submitData.envTemplates = normalizeEnvTemplates(submitData.envTemplates)
    
    emit('submit', submitData)
    
    // 延迟关闭，让父组件处理
    setTimeout(() => {
      handleCancel()
    }, 100)
  } catch (error) {
    console.error('表单验证失败:', error)
  } finally {
    loading.value = false
  }
}

// 取消
function handleCancel() {
  emit('update:visible', false)
  resetForm()
}

function handleProxyJumpChange(proxyJumpId: string | null) {
  if (!proxyJumpId) {
    form.value.proxyJumpId = null
    form.value.proxyJumpName = null
    form.value.proxyJumpHost = null
    form.value.proxyJumpPort = null
    form.value.proxyJumpUsername = null
    form.value.proxyJumpPrivateKey = null
    form.value.proxyJumpPrivateKeyPassphrase = null
    return
  }

  const proxyProfile = props.profiles.find((item) => item.id === proxyJumpId)
  if (!proxyProfile) {
    return
  }

  form.value.proxyJumpId = proxyProfile.id
  form.value.proxyJumpName = proxyProfile.name || `${proxyProfile.username}@${proxyProfile.host}:${proxyProfile.port}`
  form.value.proxyJumpHost = proxyProfile.host
  form.value.proxyJumpPort = proxyProfile.port
  form.value.proxyJumpUsername = proxyProfile.username
  form.value.proxyJumpPrivateKey = proxyProfile.private_key || null
  form.value.proxyJumpPrivateKeyPassphrase = proxyProfile.private_key_passphrase || null
}

function addPortForward() {
  form.value.portForwards.push(createEmptyPortForward())
}

function removePortForward(index: number) {
  form.value.portForwards.splice(index, 1)
}

function addCommandSnippet() {
  form.value.commandSnippets.push(createEmptyCommandSnippet())
}

function removeCommandSnippet(index: number) {
  form.value.commandSnippets.splice(index, 1)
}

function addStartupTask() {
  form.value.startupTasks.push(createEmptyStartupTask())
}

function removeStartupTask(index: number) {
  form.value.startupTasks.splice(index, 1)
}

function moveStartupTask(index: number, offset: number) {
  const nextIndex = index + offset
  if (nextIndex < 0 || nextIndex >= form.value.startupTasks.length) {
    return
  }

  const [task] = form.value.startupTasks.splice(index, 1)
  form.value.startupTasks.splice(nextIndex, 0, task)
}

function addEnvTemplate() {
  form.value.envTemplates.push(createEmptyEnvTemplate())
}

function removeEnvTemplate(index: number) {
  form.value.envTemplates.splice(index, 1)
}

// 选择私钥文件
async function selectPrivateKey() {
  try {
    const selected = await invoke<string | null>('select_local_file', {
      title: '选择 SSH 私钥文件',
      defaultPath: form.value.privateKey || null,
    })
    if (selected) {
      form.value.privateKey = selected
    }
  } catch (error) {
    console.error('选择文件失败:', error)
  }
}

// 监听 visible 变化，重置表单
watch(() => props.visible, (visible) => {
  if (visible) {
    resetForm() // 重置表单（包括编辑模式的数据填充）
  } else {
    resetForm()
  }
})

// 监听编辑配置文件变化
watch(() => props.editProfile, () => {
  if (props.visible && props.editMode) {
    resetForm()
  }
})
</script>

<style scoped>
:deep(.ssh-modal .ant-modal-content) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  display: flex;
  flex-direction: column;
  padding: 0 !important;
  overflow: hidden;
  border-radius: 20px;
}

:deep(.ssh-modal__container) {
  background: var(--overlay-panel-solid) !important;
  border-radius: 20px;
}

:deep(.ssh-modal .ant-modal-header) {
  border-bottom: 1px solid var(--overlay-divider-color);
  margin-bottom: 0 !important;
  padding: 18px 24px 14px !important;
}

:deep(.ssh-modal .ant-modal-body) {
  flex: 1 1 auto;
  background: var(--overlay-panel-solid);
  min-height: 0;
  overflow-y: auto;
  padding: 18px 24px 16px !important;
}

:deep(.ssh-modal .ant-modal-footer) {
  border-top: 1px solid var(--overlay-divider-color);
  padding: 14px 24px 18px !important;
  background: var(--overlay-panel-solid) !important;
}

:deep(.ssh-modal .ant-modal-close) {
  color: rgba(255, 255, 255, 0.88);
}

:deep(.ssh-modal .modal-close-icon),
:deep(.ssh-modal .modal-close-icon svg) {
  color: rgba(255, 255, 255, 0.88) !important;
}

:deep(.ssh-modal .ant-modal-close:hover) {
  color: var(--text-color);
  background: var(--hover-bg);
}

:deep(.ant-form-item-label > label) {
  color: var(--text-color) !important;
  font-weight: 600;
}

:deep(.ant-input),
:deep(.ant-input-number),
:deep(.ant-input-password),
:deep(.ant-select),
:deep(.ant-select-selector) {
  background: var(--surface-1);
  border-color: var(--border-color);
  color: var(--text-color);
}

:deep(.ant-input::placeholder),
:deep(.ant-input-number::placeholder),
:deep(.ant-input-password::placeholder),
:deep(.ant-select-selection-placeholder) {
  color: var(--muted-color) !important;
}

:deep(.ant-input-number .ant-input-number-input),
:deep(.ant-select-selection-item),
:deep(.ant-input-password input) {
  color: var(--text-color) !important;
}

:deep(.ant-input:focus),
:deep(.ant-input-affix-wrapper-focused),
:deep(.ant-input-number-focused),
:deep(.ant-select-focused .ant-select-selector) {
  border-color: var(--primary-color) !important;
  box-shadow: 0 0 0 4px var(--primary-soft) !important;
}

:deep(.ant-radio-wrapper) {
  color: var(--text-color);
}

:deep(.ant-checkbox-wrapper) {
  color: var(--text-color);
}

:deep(.ant-radio-inner) {
  background: transparent;
  border-color: var(--border-color);
}

:deep(.ant-radio-checked .ant-radio-inner) {
  border-color: var(--primary-color);
  background: var(--primary-color);
}

:deep(.ant-checkbox-inner) {
  background: transparent;
  border-color: var(--border-color);
}

:deep(.ant-checkbox-checked .ant-checkbox-inner) {
  background: var(--primary-color);
  border-color: var(--primary-color);
}

.ssh-tag-option {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.ssh-tag-option__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

:deep(.ant-select-selection-overflow) {
  gap: 4px;
}

:deep(.ant-select-selection-item) {
  background: transparent !important;
  border: none !important;
  padding-inline: 0 !important;
}

.ssh-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  padding: 0 8px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.ssh-tag-chip__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ssh-tag-chip__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
}

.ssh-forward-list {
  display: grid;
  gap: 10px;
  margin-bottom: 10px;
}

.ssh-template-list {
  display: grid;
  gap: 10px;
  margin-bottom: 10px;
}

.ssh-forward-item {
  display: grid;
  grid-template-columns: 128px 24px minmax(0, 1fr) 128px auto;
  gap: 10px;
  align-items: center;
}

.ssh-template-item {
  display: grid;
  gap: 10px;
  align-items: center;
}

.ssh-template-item--card {
  grid-template-columns: 1fr;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface-1) 82%, transparent);
}

.ssh-forward-arrow {
  color: var(--muted-color);
  text-align: center;
}

.ssh-config-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--muted-color);
  font-size: 12px;
}

.ssh-config-meta span {
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--hover-bg);
}

:deep(.ant-select-selection-item) {
  font-weight: 600;
}

.ssh-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

:global(.ssh-modal__button) {
  border-radius: 10px !important;
  border-color: var(--border-color) !important;
  background: var(--surface-1) !important;
  color: var(--text-color) !important;
  box-shadow: none !important;
}

:global(.ssh-modal__button:hover) {
  border-color: var(--strong-border) !important;
  background: var(--surface-2) !important;
  color: var(--text-color) !important;
}

:global(.ssh-modal__button--dashed) {
  border-style: dashed !important;
  background: transparent !important;
}

:global(.ssh-modal__button--dashed:hover) {
  background: var(--surface-2) !important;
}

:global(.ssh-modal__button--danger) {
  border-color: color-mix(in srgb, var(--connection-disconnected) 36%, var(--border-color)) !important;
  background: var(--connection-disconnected-soft) !important;
  color: var(--connection-disconnected) !important;
}

:global(.ssh-modal__button--danger:hover) {
  border-color: var(--connection-disconnected) !important;
  background: color-mix(in srgb, var(--connection-disconnected-soft) 76%, var(--surface-1)) !important;
  color: var(--connection-disconnected) !important;
}

:global(.ssh-modal__action) {
  min-width: 78px;
  border-radius: 12px !important;
  font-weight: 700;
}

:global(.ssh-modal__action--ghost) {
  background: var(--surface-2) !important;
  border-color: var(--border-color) !important;
  color: var(--text-color) !important;
}

:global(.ssh-modal__action--ghost:hover) {
  background: var(--hover-bg) !important;
  border-color: var(--strong-border) !important;
}

.ssh-template-item__main {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.ssh-template-item__main--snippet {
  gap: 12px;
}

.ssh-template-item__row {
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr);
}

.ssh-template-item__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ssh-template-item__eyebrow {
  color: var(--muted-color);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.ssh-template-item__tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ssh-template-item__tools--compact {
  gap: 6px;
}

.ssh-template-item__status {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--connection-connected-soft) 88%, transparent);
  color: var(--connection-connected);
  font-size: 11px;
  font-weight: 600;
}

.ssh-template-item__status.is-inactive {
  background: color-mix(in srgb, var(--surface-2) 88%, transparent);
  color: var(--muted-color);
}

.ssh-template-hint {
  margin: 8px 0 10px;
  color: var(--muted-color);
  font-size: 12px;
  line-height: 1.5;
}

:global(.ssh-modal__icon-action) {
  width: 30px !important;
  min-width: 30px !important;
  height: 30px !important;
  padding: 0 !important;
  border-radius: 9px !important;
  color: var(--muted-color) !important;
  font-size: 12px !important;
  border: 1px solid transparent !important;
}

:global(.ssh-modal__icon-action:hover) {
  background: var(--surface-2) !important;
  color: var(--text-color) !important;
  border-color: var(--border-color) !important;
}

:global(.ssh-modal__icon-action:disabled) {
  opacity: 0.42 !important;
  background: transparent !important;
  border-color: transparent !important;
}

:global(.ssh-modal__icon-action--danger:hover) {
  background: var(--connection-disconnected-soft) !important;
  color: var(--connection-disconnected) !important;
}

@media (max-width: 720px) {
  .ssh-forward-item {
    grid-template-columns: 1fr;
  }

  .ssh-template-item__row {
    grid-template-columns: 1fr;
  }

  .ssh-template-item--command,
  .ssh-template-item--env {
    grid-template-columns: 1fr;
  }

  .ssh-forward-arrow {
    display: none;
  }
}

:deep(.ssh-modal .ant-modal-content),
:deep(.ssh-modal__container) {
  border-radius: 14px !important;
}

:deep(.ssh-modal__action) {
  border-radius: 10px !important;
}

:global(.ssh-modal .ant-btn.ssh-modal__primary-button),
:global(.ssh-modal .ant-btn-primary.ssh-modal__primary-button) {
  background: var(--text-color) !important;
  border-color: var(--text-color) !important;
  color: var(--bg-color) !important;
}

:global(.ssh-modal .ant-btn.ssh-modal__primary-button:hover),
:global(.ssh-modal .ant-btn-primary.ssh-modal__primary-button:hover) {
  background: var(--strong-border) !important;
  border-color: var(--strong-border) !important;
  color: var(--bg-color) !important;
}
</style>
