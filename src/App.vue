<template>
  <div class="app-shell min-h-screen bg-[var(--bg-color)] text-[var(--text-color)]">
    <section class="workspace-shell flex h-full w-full p-3 md:p-4">
      <div class="workspace-frame flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-[var(--workspace-frame-border)] bg-[var(--workspace-frame-bg)] shadow-[var(--shadow-soft)] backdrop-blur-[22px]">
    <TopMenu 
      @new-local="newLocal" 
      @new-ssh="newSsh" 
      @toggle-theme="toggleTheme"
      @show-settings="showSettings = true"
      @show-file-manager="showFileManager"
      :theme="theme"
      :active-connection="getActiveConnection()"
      :tab-count="tabs.length"
    />
    
    <div class="main-container flex min-h-0 flex-1 overflow-hidden">
      <Sidebar 
        :collapsed="leftPanelCollapsed" 
        @toggle="leftPanelCollapsed = !leftPanelCollapsed"
        :profiles="profiles"
        @launch-profile="launchSavedProfile"
        :active-tab="getActiveTab()"
        @open-file-preview="openFilePreview"
        @refresh-profiles="refreshProfiles"
        @start-download="handleStartDownload"
        @edit-profile="editProfile"
      />
      
      <div class="content-container flex min-w-0 flex-1 flex-col overflow-hidden border-x border-[var(--border-subtle)] bg-[var(--workspace-center-bg)]">
        <TabManager 
          :tabs="tabs" 
          :active-id="activeId" 
          @change="activeId = $event"
          @close="closeTab"
        />
        
        <div class="terminals-container relative flex-1 overflow-hidden bg-[var(--workspace-terminal-bg)]">
          <template v-for="tab in tabs" :key="tab.id">
            <Terminal 
              v-if="tab.type === 'ssh'" 
              :id="tab.id" 
              :active="activeId === tab.id" 
              :theme="theme"
              :config="terminalConfig"
              :auto-password="tab.autoPassword"
              :type="'ssh'"
              @close="closeTab(tab.id)"
              @reconnect="reconnectSsh(tab)"
              v-show="activeId === tab.id"
            />
            
            <Terminal 
              v-else-if="tab.type === 'local'" 
              :id="tab.id" 
              :active="activeId === tab.id" 
              :theme="theme"
              :config="terminalConfig"
              :type="'local'"
              @close="closeTab(tab.id)"
              v-show="activeId === tab.id"
            />
            
            <FileEditor
              v-else-if="tab.type === 'file'"
              :id="tab.id"
              :active="activeId === tab.id"
              :file-info="tab.fileInfo"
              :connection-id="tab.connectionId"
              :theme="theme"
              @close="closeTab(tab.id)"
              v-show="activeId === tab.id"
            />
          </template>

          <div
            v-if="tabs.length === 0"
            class="workspace-empty flex flex-col justify-center gap-4 border border-dashed border-[var(--workspace-empty-border)] bg-[var(--workspace-empty-bg)] p-10"
          >
            <div class="workspace-empty__badge inline-flex w-fit rounded-full bg-[var(--primary-soft)] px-3 py-2 text-[var(--primary-color)]">
              FinalShell Pro Layout
            </div>
            <h2>从左侧选择连接，或直接创建一个新会话</h2>
            <p>资源管理、终端工作区和系统监控已经对齐到更接近 FinalShell 的三栏工作台布局。</p>
          </div>
        </div>
      </div>
      
      <RightPanel 
        ref="rightPanelRef"
        :collapsed="rightPanelCollapsed" 
        @toggle="rightPanelCollapsed = !rightPanelCollapsed"
        :connection-id="getActiveTab()?.type === 'ssh' ? getActiveTab()?.id : ''"
        :ssh-profile="getActiveTab()?.type === 'ssh' ? getActiveTab()?.profile : null"
      />
    </div>
    
        <StatusBar
          :active-connection="getActiveConnection()"
          :tab-count="tabs.length"
          :theme="theme"
        />
      </div>
    </section>
    
    <SshModal 
      v-model:visible="showSshModal" 
      :edit-mode="sshEditMode"
      :edit-profile="editingProfile"
      @submit="submitSsh" 
    />
    
    <!-- 设置模态框 -->
    <SettingsModal 
      v-model:visible="showSettings" 
      :terminal-config="terminalConfig"
      @update-config="updateTerminalConfig"
    />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onMounted, onBeforeUnmount, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { message } from 'antdv-next'
import type {
  ConnectionTab,
  DownloadRequest,
  SftpConnectedDetail,
  SftpFileEntry,
  SshConnectionPayload,
  SshProfile,
  TerminalConfig,
  ThemeName,
} from './types/app'

// 导入组件
import TopMenu from './components/TopMenu.vue'
import TabManager from './components/TabManager.vue'
import Sidebar from './components/Sidebar.vue'
import Terminal from './components/Terminal.vue'
import SshModal from './components/SshModal.vue'
import SettingsModal from './components/SettingsModal.vue'
import RightPanel from './components/RightPanel.vue'
import StatusBar from './components/StatusBar.vue'
const FileEditor = defineAsyncComponent(() => import('./components/FileEditor.vue'))

// 导入服务
import SshService from './services/SshService'
import ThemeService from './services/ThemeService'

// 响应式数据
const tabs = ref<ConnectionTab[]>([])
const activeId = ref('')
const leftPanelCollapsed = ref(false)
const showSshModal = ref(false)
const showSettings = ref(false)
const rightPanelRef = ref<{
  addDownload: (fileName: string, remotePath: string, savePath: string, connectionId: string) => void
} | null>(null)
const rightPanelCollapsed = ref(true)
const sshEditMode = ref(false)
const editingProfile = ref<SshProfile | null>(null)

// 主题和设置
const theme = ref<ThemeName>(ThemeService.getTheme())
const terminalConfig = ref<TerminalConfig>(ThemeService.getTerminalConfig())

// 已保存的连接配置
const profiles = ref<SshProfile[]>([])
let sftpConnectedHandler: ((event: Event) => void) | null = null

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

// 获取活动连接信息
function getActiveConnection() {
  if (!activeId.value) return ''
  const activeTab = tabs.value.find(t => t.id === activeId.value)
  return activeTab ? activeTab.title : ''
}

// 获取活动标签页
function getActiveTab() {
  if (!activeId.value) return null
  return tabs.value.find(t => t.id === activeId.value) || null
}

// 启动已保存的连接
async function launchSavedProfile(p: SshProfile) {
  try {
    const tabInfo = await SshService.launchProfile(p)
    tabs.value.push(tabInfo)
    activeId.value = tabInfo.id
  } catch (error) {
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

// 提交 SSH 连接
async function submitSsh(sshData: SshConnectionPayload) {
  try {
    if (sshData.isEdit) {
      // 编辑模式：更新现有配置
      await SshService.updateProfile(sshData as SshConnectionPayload & { id: string })
      await refreshProfiles()
      showSshModal.value = false
    } else {
      // 新建模式：创建新连接
      const tabInfo = await SshService.createSshConnection(sshData)
      tabs.value.push(tabInfo)
      activeId.value = tabInfo.id
      
      // 刷新配置列表
      if (sshData.savePassword) {
        await refreshProfiles()
      }
      
      showSshModal.value = false
    }
  } catch (error) {
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

// 编辑 SSH 配置文件
function editProfile(profile: SshProfile) {
  sshEditMode.value = true
  editingProfile.value = profile
  showSshModal.value = true
}

// 通知侧边栏显示文件管理器
function showFileManager() {
  // 直接通知侧边栏展开文件管理区域，不需要额外处理
}

// 打开文件预览
async function openFilePreview(fileInfo: SftpFileEntry) {
  const id = `file-${Date.now()}`
  const title = `📄 ${fileInfo.name}`
  
  // 获取当前活动SSH标签页的连接ID
  const activeTab = tabs.value.find(t => t.id === activeId.value)
  const connectionId = activeTab?.sftpConnectionId || activeTab?.id
  
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
  await refreshProfiles()
  
  // 监听SFTP连接事件
  sftpConnectedHandler = (event: Event) => {
    const { sshId, sftpId } = (event as CustomEvent<SftpConnectedDetail>).detail
    const tab = tabs.value.find(t => t.id === sshId)
    if (tab) {
      tab.sftpConnectionId = sftpId
      console.log(`SSH标签页 ${sshId} 的SFTP连接已建立: ${sftpId}`)
    }
  }

  window.addEventListener('sftp-connected', sftpConnectedHandler)
})

onBeforeUnmount(() => {
  if (sftpConnectedHandler) {
    window.removeEventListener('sftp-connected', sftpConnectedHandler)
  }

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
  padding: 14px 18px 18px;
  background:
    radial-gradient(circle at top left, rgba(77, 136, 255, 0.18), transparent 22%),
    radial-gradient(circle at top right, rgba(54, 189, 255, 0.12), transparent 24%),
    linear-gradient(180deg, var(--bg-color) 0%, var(--surface-0) 100%);
  overflow: hidden;
}

.workspace-frame {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: 28px;
  overflow: hidden;
  background: var(--workspace-frame-bg);
  border: 1px solid var(--workspace-frame-border);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(22px);
}

.main-container {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.content-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  min-width: 0;
  background: var(--workspace-center-bg);
  border-inline: 1px solid var(--border-subtle);
}

.terminals-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: var(--workspace-terminal-bg);
}

.terminals-container > * {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.workspace-empty {
  position: absolute;
  inset: 26px 28px 28px;
  border-radius: 24px;
  border: 1px dashed var(--workspace-empty-border);
  background:
    var(--workspace-empty-bg),
    linear-gradient(180deg, rgba(45, 125, 255, 0.04), rgba(45, 125, 255, 0));
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 42px;
  color: var(--text-color);
}

.workspace-empty__badge {
  align-self: flex-start;
  padding: 7px 12px;
  border-radius: 999px;
  background: var(--primary-soft);
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.workspace-empty h2 {
  margin: 18px 0 10px;
  font-size: 28px;
  line-height: 1.2;
}

.workspace-empty p {
  max-width: 620px;
  color: var(--muted-color);
  font-size: 15px;
  line-height: 1.8;
}

@media (max-width: 1280px) {
  .workspace-shell {
    padding: 12px;
  }
}
</style>
