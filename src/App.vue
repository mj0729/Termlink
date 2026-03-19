<template>
  <a-config-provider :theme="antdvThemeConfig">
    <a-app>
      <div class="app-shell min-h-screen bg-[var(--bg-color)] text-[var(--text-color)]">
        <section class="workspace-shell flex h-full w-full">
          <div class="workspace-frame flex h-full w-full flex-col overflow-hidden">
        <div class="main-container flex min-h-0 flex-1 overflow-hidden">
          <div class="content-container flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--workspace-center-bg)]">
            <TabManager 
              :tabs="tabs" 
              :active-id="activeId" 
              @change="activeId = $event"
              @close="closeTab"
              @open-connection-center="openConnectionCenter"
            />
            
            <div
              class="terminals-container relative flex-1 overflow-hidden bg-[var(--workspace-terminal-bg)]"
              :class="{
                'terminals-container--ssh': isSshWorkspaceLayout
              }"
            >
              <template v-for="tab in tabs" :key="tab.id">
                <div
                  class="workspace-view"
                  :class="`workspace-view--${tab.type}`"
                  v-show="activeId === tab.id"
                >
                  <SshWorkspace
                    v-if="tab.type === 'ssh'" 
                    :id="tab.id" 
                    :active="activeId === tab.id" 
                    :theme="theme"
                    :config="terminalConfig"
                    :auto-password="tab.autoPassword"
                    :connection-id="tab.id"
                    :profile="tab.profile"
                    @close="closeTab(tab.id)"
                    @reconnect="reconnectSsh(tab)"
                    @open-file-preview="openFilePreview"
                    @start-download="handleStartDownload"
                    @start-upload="handleStartUpload"
                  />
                  
                  <Terminal 
                    v-else-if="tab.type === 'local'" 
                    :id="tab.id" 
                    :active="activeId === tab.id" 
                    :theme="theme"
                    :config="terminalConfig"
                    :type="'local'"
                    @close="closeTab(tab.id)"
                  />
                  
                  <FileEditor
                    v-else-if="tab.type === 'file'"
                    :id="tab.id"
                    :active="activeId === tab.id"
                    :file-info="tab.fileInfo"
                    :connection-id="tab.connectionId"
                    :theme="theme"
                    @close="closeTab(tab.id)"
                  />

                  <ConnectionHub
                    v-else-if="tab.type === 'connections'"
                    :profiles="profiles"
                    :groups="groups"
                    :active-profile-id="getActiveProfileId()"
                    :theme="theme"
                    :view-mode="terminalConfig.connectionHubViewMode"
                    @launch-profile="launchSavedProfile"
                    @edit-profile="editProfile"
                    @delete-profile="deleteProfile"
                    @create-group="createGroup"
                    @rename-group="renameGroup"
                    @delete-group="deleteGroup"
                    @new-ssh="newSsh"
                  />
                </div>
              </template>

            </div>
          </div>
          
          <RightPanel 
            ref="rightPanelRef"
            :collapsed="rightPanelCollapsed" 
            @toggle="rightPanelCollapsed = !rightPanelCollapsed"
            @tab-change="rightPanelTab = $event"
            :connection-id="getActiveTab()?.type === 'ssh' ? getActiveTab()?.id : ''"
            :ssh-profile="getActiveTab()?.type === 'ssh' ? getActiveTab()?.profile : null"
            :active-tab="rightPanelTab"
          />
        </div>
        
            <StatusBar
              :active-connection="getActiveConnection()"
              :tab-count="tabs.length"
              :right-panel-tab="rightPanelTab"
              :right-panel-collapsed="rightPanelCollapsed"
              @select-right-panel-tab="handleRightPanelTabSelect"
              @show-settings="showSettings = true"
            />
          </div>
        </section>
        
        <SshModal 
          v-model:visible="showSshModal" 
          :edit-mode="sshEditMode"
          :edit-profile="editingProfile"
          :groups="groups"
          @submit="submitSsh" 
        />
        
        <!-- 设置模态框 -->
        <SettingsModal 
          v-model:visible="showSettings" 
          :terminal-config="terminalConfig"
          :theme="theme"
          :profiles="profiles"
          @save-config="updateTerminalConfig"
          @change-theme="toggleTheme"
          @refresh-profiles="refreshProfiles"
        />
      </div>
    </a-app>
  </a-config-provider>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, h, onMounted, onBeforeUnmount, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { theme as antdTheme } from 'antdv-next'
import type {
  ConnectionTab,
  DownloadRequest,
  MonitorTab,
  SftpFileEntry,
  SshConnectionPayload,
  SshProfile,
  TerminalConfig,
  ThemeName,
  UploadRequest,
} from './types/app'

// 导入组件
import TabManager from './components/TabManager.vue'
import Terminal from './components/Terminal.vue'
import SshModal from './components/SshModal.vue'
import SettingsModal from './components/SettingsModal.vue'
import RightPanel from './components/RightPanel.vue'
import StatusBar from './components/StatusBar.vue'
import ConnectionHub from './components/ConnectionHub.vue'
import SshWorkspace from './components/SshWorkspace.vue'
const FileEditor = defineAsyncComponent(() => import('./components/FileEditor.vue'))

// 导入服务
import SshService from './services/SshService'
import ThemeService from './services/ThemeService'

// 响应式数据
const tabs = ref<ConnectionTab[]>([createConnectionCenterTab()])
const activeId = ref(tabs.value[0]?.id || '')
const showSshModal = ref(false)
const showSettings = ref(false)
const rightPanelRef = ref<{
  addDownload: (fileName: string, remotePath: string, savePath: string, connectionId: string) => void
  addUpload: (upload: UploadRequest) => void
} | null>(null)
const rightPanelCollapsed = ref(true)
const rightPanelTab = ref<MonitorTab>('monitor')
const sshEditMode = ref(false)
const editingProfile = ref<SshProfile | null>(null)

// 主题和设置
const theme = ref<ThemeName>(ThemeService.getTheme())
const terminalConfig = ref<TerminalConfig>(ThemeService.getTerminalConfig())
const antdThemeConfig = computed(() => ({
  algorithm: theme.value === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: theme.value === 'dark' ? '#71a7ff' : '#2f7cff',
    borderRadius: 12,
    colorBgBase: theme.value === 'dark' ? '#0b1220' : '#edf4fd',
    colorBgLayout: theme.value === 'dark' ? '#0b1220' : '#edf4fd',
    colorBgContainer: theme.value === 'dark' ? '#121b29' : '#f8fbff',
    colorBgElevated: theme.value === 'dark' ? '#101a2b' : '#f8fbff',
    colorText: theme.value === 'dark' ? '#e7eefb' : '#192435',
    colorTextSecondary: theme.value === 'dark' ? '#94a4bb' : '#6f7f95',
    colorBorder: theme.value === 'dark' ? '#24344d' : '#d6e2f1',
  },
  components: {
    Button: {
      algorithm: true,
    },
    Input: {
      algorithm: true,
    },
    Select: {
      algorithm: true,
    },
    Modal: {
      algorithm: true,
    },
    Segmented: {
      algorithm: true,
    },
    Tabs: {
      algorithm: true,
    },
    Tag: {
      algorithm: true,
    },
  },
}))

// 已保存的连接配置
const profiles = ref<SshProfile[]>([])
const groups = ref<string[]>([])
const isSshWorkspaceLayout = computed(() => getActiveTab()?.type === 'ssh')

function isUserCancelledConnection(error: unknown) {
  return String(error).includes('已取消连接')
}

function createConnectionCenterTab(): ConnectionTab {
  return {
    id: `connections-${Date.now()}`,
    title: '连接中心',
    type: 'connections'
  }
}

// 切换主题
function toggleTheme(next: ThemeName) {
  theme.value = ThemeService.toggleTheme(next)
}

// 更新终端配置
function updateTerminalConfig(config: Partial<TerminalConfig>) {
  terminalConfig.value = ThemeService.updateTerminalConfig(config)
}

// 刷新连接配置
async function refreshProfiles() {
  profiles.value = await SshService.getProfiles()
}

async function refreshGroups() {
  groups.value = await SshService.getGroups()
}

async function refreshConnectionData() {
  await Promise.all([refreshProfiles(), refreshGroups()])
}

// 获取活动连接信息
function getActiveConnection() {
  if (!activeId.value) return ''
  const activeTab = tabs.value.find(t => t.id === activeId.value)
  return activeTab?.type === 'connections' ? '' : activeTab ? activeTab.title : ''
}

function getActiveProfileId() {
  const activeTab = getActiveTab()
  return activeTab?.type === 'ssh' ? activeTab.profile?.id || '' : ''
}

// 获取活动标签页
function getActiveTab() {
  if (!activeId.value) return null
  return tabs.value.find(t => t.id === activeId.value) || null
}

// 启动已保存的连接
async function launchSavedProfile(p: SshProfile) {
  try {
    const existingTab = tabs.value.find(tab => tab.type === 'ssh' && tab.profile?.id === p.id)
    if (existingTab) {
      activeId.value = existingTab.id
      return
    }

    const tabInfo = await SshService.launchProfile(p)
    tabs.value.push(tabInfo)
    activeId.value = tabInfo.id
  } catch (error) {
    if (isUserCancelledConnection(error)) {
      return
    }
    console.error('启动SSH连接失败:', error)
    message.error({
      content: String(error),
      duration: 8, // 显示8秒，给用户足够时间阅读
      style: {
        marginTop: '50px',
        maxWidth: '400px'
      }
    })
  }
}

// 处理开始下载
function handleStartDownload(downloadInfo: DownloadRequest) {
  if (rightPanelRef.value) {
    rightPanelRef.value.addDownload(
      downloadInfo.fileName,
      downloadInfo.remotePath,
      downloadInfo.savePath,
      downloadInfo.connectionId
    )
  }
}

function handleStartUpload(uploadInfo: UploadRequest) {
  rightPanelRef.value?.addUpload(uploadInfo)
}

function handleRightPanelTabSelect(tab: MonitorTab) {
  if (rightPanelTab.value === tab) {
    rightPanelCollapsed.value = !rightPanelCollapsed.value
    return
  }

  rightPanelTab.value = tab
  rightPanelCollapsed.value = false
}

// 提交 SSH 连接
async function submitSsh(sshData: SshConnectionPayload) {
  try {
    if (sshData.isEdit) {
      // 编辑模式：更新现有配置
      await SshService.updateProfile(sshData as SshConnectionPayload & { id: string })
      await refreshConnectionData()
      showSshModal.value = false
    } else {
      // 新建模式：创建新连接
      const tabInfo = await SshService.createSshConnection(sshData)
      tabs.value.push(tabInfo)
      activeId.value = tabInfo.id
      
      // 刷新配置列表
      if (sshData.savePassword) {
        await refreshConnectionData()
      }
      
      showSshModal.value = false
    }
  } catch (error) {
    if (isUserCancelledConnection(error)) {
      showSshModal.value = false
      return
    }
    console.error('SSH连接操作失败:', error)
    message.error({
      content: String(error),
      duration: 8, // 显示8秒，给用户足够时间阅读
      style: {
        marginTop: '50px',
        maxWidth: '400px'
      }
    })
  }
}

// 新建本地会话
async function newLocal() {
  const id = `local-${Date.now()}`
  tabs.value.push({ id, title: '本地终端', type: 'local' })
  activeId.value = id
  
  await invoke('start_pty', { id, cols: 120, rows: 30 })
}

// 新建 SSH 会话
async function newSsh() {
  sshEditMode.value = false
  editingProfile.value = null
  showSshModal.value = true
}

function openConnectionCenter() {
  const existingTab = tabs.value.find(tab => tab.type === 'connections')
  if (existingTab) {
    activeId.value = existingTab.id
    return
  }

  const tab = createConnectionCenterTab()
  tabs.value.push(tab)
  activeId.value = tab.id
}

// 编辑 SSH 配置文件
function editProfile(profile: SshProfile) {
  sshEditMode.value = true
  editingProfile.value = profile
  showSshModal.value = true
}

async function deleteProfile(profile: SshProfile) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除连接 "${profile.username ? `${profile.username}@${profile.host}` : profile.host}" 吗？此操作无法撤销。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await invoke('delete_ssh_profile', { profileId: profile.id })
        await refreshConnectionData()
        message.success('连接已删除')
      } catch (error) {
        console.error('删除连接失败:', error)
        message.error('删除连接失败')
      }
    }
  })
}

function promptGroupName(title: string, initialValue = '', placeholder = '请输入分组名称') {
  let nextValue = initialValue

  return new Promise<string | null>((resolve) => {
    Modal.confirm({
      title,
      content: h('input', {
        autofocus: true,
        value: initialValue,
        placeholder,
        style: 'width: 100%; padding: 8px 12px; border: 1px solid #d9d9d9; border-radius: 8px;',
        onInput: (event: Event) => {
          nextValue = (event.target as HTMLInputElement).value
        },
      }),
      okText: '确定',
      cancelText: '取消',
      async onOk() {
        const value = nextValue.trim()
        if (!value) {
          message.warning('请输入分组名称')
          return Promise.reject()
        }
        resolve(value)
      },
      onCancel() {
        resolve(null)
      }
    })
  })
}

async function createGroup() {
  const groupName = await promptGroupName('新增分组')
  if (!groupName) {
    return
  }

  try {
    groups.value = await SshService.createGroup(groupName)
    message.success('分组已创建')
  } catch (error) {
    console.error('创建分组失败:', error)
    message.error(String(error))
  }
}

async function renameGroup(groupName: string) {
  const nextName = await promptGroupName('编辑分组', groupName, '请输入新的分组名称')
  if (!nextName) {
    return
  }

  try {
    groups.value = await SshService.renameGroup(groupName, nextName)
    await refreshProfiles()
    message.success('分组已更新')
  } catch (error) {
    console.error('编辑分组失败:', error)
    message.error(String(error))
  }
}

async function deleteGroup(groupName: string) {
  Modal.confirm({
    title: '确认删除分组',
    content: `删除分组 "${groupName}" 后，原有连接会被移出该分组。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        groups.value = await SshService.deleteGroup(groupName)
        await refreshProfiles()
        message.success('分组已删除')
      } catch (error) {
        console.error('删除分组失败:', error)
        message.error(String(error))
      }
    }
  })
}

// 打开文件预览
async function openFilePreview(fileInfo: SftpFileEntry) {
  const id = `file-${Date.now()}`
  const title = `📄 ${fileInfo.name}`
  
  // 获取当前活动SSH标签页的连接ID
  const activeTab = tabs.value.find(t => t.id === activeId.value)
  const connectionId = activeTab?.id
  
  tabs.value.push({ 
    id, 
    title, 
    type: 'file',
    fileInfo,
    connectionId
  })
  activeId.value = id
}

// 关闭标签页
async function closeTab(id) {
  const index = tabs.value.findIndex(t => t.id === id)
  if (index === -1) return
  
  const tab = tabs.value[index]
  
  // 清理资源
  if (tab.type === 'ssh') {
    await SshService.closeConnection(id);
  } else if (tab.type === 'local') {
    await invoke('close_pty', { id });
  }
  
  // 移除标签页
  tabs.value.splice(index, 1)

  if (tabs.value.length === 0) {
    const tab = createConnectionCenterTab()
    tabs.value.push(tab)
    activeId.value = tab.id
    return
  }
  
  // 如果关闭的是当前活动标签页，切换到前一个标签页
  if (activeId.value === id) {
    activeId.value = tabs.value[index - 1]?.id || tabs.value[0]?.id || ''
  }
}

// 重新连接SSH
async function reconnectSsh(tab: ConnectionTab | null) {
  if (tab && tab.profile) {
    await SshService.reconnect(tab.id, tab.profile)
  }
}

// 生命周期钩子
onMounted(async () => {
  // 加载已保存的SSH配置
  await refreshConnectionData()
})

onBeforeUnmount(() => {
  // 关闭所有连接
  tabs.value.forEach(async tab => {
    if (tab.type === 'ssh') {
      await SshService.closeConnection(tab.id)
    } else if (tab.type === 'local') {
      await invoke('close_pty', { id: tab.id })
    }
  })
})
</script>

<style>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

.workspace-shell {
  flex: 1;
  background:
    radial-gradient(circle at top left, rgba(77, 136, 255, 0.12), transparent 18%),
    radial-gradient(circle at top right, rgba(54, 189, 255, 0.08), transparent 22%),
    radial-gradient(circle at bottom left, rgba(45, 125, 255, 0.05), transparent 26%),
    linear-gradient(180deg, var(--bg-color) 0%, var(--surface-0) 100%);
  overflow: hidden;
}

.workspace-frame {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--workspace-frame-bg);
}

.main-container {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
  gap: 6px;
  padding: 0;
}

.content-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  min-width: 0;
  background: transparent;
  border-radius: 0;
  backdrop-filter: none;
}

.terminals-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: var(--workspace-terminal-bg);
  border-radius: 0;
  padding: 0;
}

.terminals-container--ssh {
  background: transparent;
  border-radius: 0;
}

.workspace-view {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: 0;
  background: var(--workspace-view-bg);
  box-shadow:
    inset 0 0 0 1px var(--workspace-view-border),
    var(--workspace-view-shadow);
}

.workspace-view--ssh,
.workspace-view--connections,
.workspace-view--file {
  backdrop-filter: blur(10px);
}

.workspace-view--local {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
    rgba(255, 255, 255, 0.04);
}

.workspace-view > * {
  width: 100%;
  height: 100%;
}

@media (max-width: 1280px) {
  .workspace-shell {
    padding: 0;
  }
}

@media (max-width: 960px) {
  .main-container {
    gap: 4px;
    padding-inline: 0;
  }
}
</style>
