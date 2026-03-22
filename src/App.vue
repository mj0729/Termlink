<template>
  <a-config-provider :theme="antdThemeConfig">
    <a-app>
      <div v-if="appMode === 'remote-files'" class="remote-files-window">
        <div class="remote-files-window__body">
          <RemoteFileWorkbench
            aggressive
            :connection-id="remoteFilesConnectionId"
            :active="true"
            :sync-path="remoteFilesInitialPath"
            :density="terminalConfig.density"
            :font-family="terminalConfig.fontFamily"
            :ssh-state="'connected'"
            :title="remoteFilesTitle"
            @open-file-preview="handleStandaloneFilePreview"
            @start-download="handleStartDownload"
            @start-upload="handleStartUpload"
          />
        </div>
      </div>

      <div
        v-else
        class="app-shell min-h-screen bg-[var(--bg-color)] text-[var(--text-color)]"
        @contextmenu.capture="handleAppContextMenu"
      >
        <section class="workspace-shell flex h-full w-full">
          <div class="workspace-frame flex h-full w-full flex-col overflow-hidden">
            <div class="main-container flex min-h-0 flex-1 overflow-hidden">
              <div class="content-container flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--workspace-center-bg)]">
                <TabManager 
                  :tabs="tabs" 
                  :active-id="activeId" 
                  :fresh-tab-id="freshTabId"
                  @change="activeId = $event"
                  @close="closeTab"
                  @menu-action="handleTabMenuAction"
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
                      :class="[
                        `workspace-view--${tab.type}`,
                        { 'is-activating': activatingWorkspaceId === tab.id },
                      ]"
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
                        :ssh-state="tab.sshState"
                        :files-drawer-open="getWorkspaceFileDrawerState(tab.id)"
                        :embedded-monitor-visible="activeId === tab.id && shouldEmbedMonitorInSsh"
                        :embedded-monitor-collapsed="embeddedMonitorCollapsed"
                        @close="handleSshTabExit(tab.id)"
                        @reconnect="reconnectSsh(tab)"
                        @open-file-preview="openFilePreview"
                        @start-download="handleStartDownload"
                        @start-upload="handleStartUpload"
                        @update:files-drawer-open="setWorkspaceFileDrawerState(tab.id, $event)"
                        @toggle-monitor="embeddedMonitorCollapsed = !embeddedMonitorCollapsed"
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
                :collapsed="effectiveRightPanelCollapsed" 
                @toggle="rightPanelCollapsed = !rightPanelCollapsed"
                @tab-change="rightPanelTab = $event"
                :connection-id="currentTab?.type === 'ssh' && currentTab?.sshState === 'connected' ? currentTab?.id : ''"
                :ssh-profile="currentTab?.type === 'ssh' ? currentTab?.profile : null"
                :active-tab="rightPanelTab"
              />
            </div>
            
            <StatusBar
              :active-connection="activeConnection"
              :active-connection-copy-text="activeConnectionCopyText"
              :tab-count="tabs.length"
              :right-panel-tab="rightPanelTab"
              :right-panel-collapsed="effectiveRightPanelCollapsed"
              :show-file-drawer-toggle="currentTab?.type === 'ssh'"
              :file-drawer-open="currentTab?.type === 'ssh' ? getWorkspaceFileDrawerState(currentTab.id) : false"
              @select-right-panel-tab="handleRightPanelTabSelect"
              @toggle-file-drawer="toggleCurrentWorkspaceFileDrawer"
              @show-settings="showSettings = true"
            />
          </div>
        </section>
        
        <SshModal 
          v-model:visible="showSshModal" 
          :edit-mode="sshEditMode"
          :edit-profile="editingProfile"
          :groups="groups"
          :profiles="profiles"
          @submit="submitSsh" 
        />
        
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
import { computed, defineAsyncComponent, h, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { theme as antdTheme } from 'antdv-next'
import type {
  ConnectionTab,
  DownloadRequest,
  MonitorTab,
  SftpFileEntry,
  SshConnectionPayload,
  SshProfile,
  TabContextMenuAction,
  TerminalConfig,
  ThemeName,
  UploadRequest,
} from './types/app'

// 导入组件
import TabManager from './components/TabManager.vue'
import StatusBar from './components/StatusBar.vue'
const SshModal = defineAsyncComponent(() => import('./components/SshModal.vue'))
const SettingsModal = defineAsyncComponent(() => import('./components/SettingsModal.vue'))
const Terminal = defineAsyncComponent(() => import('./components/Terminal.vue'))
const RightPanel = defineAsyncComponent(() => import('./components/RightPanel.vue'))
const ConnectionHub = defineAsyncComponent(() => import('./components/ConnectionHub.vue'))
const SshWorkspace = defineAsyncComponent(() => import('./components/SshWorkspace.vue'))
const FileEditor = defineAsyncComponent(() => import('./components/FileEditor.vue'))
const RemoteFileWorkbench = defineAsyncComponent(() => import('./components/RemoteFileWorkbench.vue'))

// 导入服务
import SshService from './services/SshService'
import ThemeService from './services/ThemeService'

const launchParams = new URLSearchParams(window.location.search)
const appMode = launchParams.get('mode') || 'main'
const remoteFilesConnectionId = launchParams.get('connectionId') || ''
const remoteFilesTitle = launchParams.get('title') || '文件管理'
const remoteFilesInitialPath = launchParams.get('path') || '/'

// 响应式数据
const tabs = ref<ConnectionTab[]>([createConnectionCenterTab()])
const activeId = ref(tabs.value[0]?.id || '')
const showSshModal = ref(false)
const showSettings = ref(false)
const freshTabId = ref('')
const activatingWorkspaceId = ref('')
const rightPanelRef = ref<{
  addDownload: (fileName: string, remotePath: string, savePath: string, connectionId: string) => void
  addUpload: (upload: UploadRequest) => void
} | null>(null)
const rightPanelCollapsed = ref(true)
const embeddedMonitorCollapsed = ref(false)
const rightPanelTab = ref<MonitorTab>('monitor')
const workspaceFileDrawerState = ref<Record<string, boolean>>({})
const sshEditMode = ref(false)
const editingProfile = ref<SshProfile | null>(null)
const manualDisconnectingIds = new Set<string>()
const closingTabIds = new Set<string>()
let freshTabTimer: number | null = null
let workspaceMotionFrame: number | null = null
let workspaceMotionTimer: number | null = null

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

// 缓存当前活动标签页，避免模板中多次 find()
const currentTab = computed(() => {
  if (!activeId.value) return null
  return tabs.value.find(t => t.id === activeId.value) || null
})

const isConnectionCenterLayout = computed(() => currentTab.value?.type === 'connections')
const isSshWorkspaceLayout = computed(() => currentTab.value?.type === 'ssh')
const shouldEmbedMonitorInSsh = computed(() => (
  isSshWorkspaceLayout.value
  && rightPanelTab.value === 'monitor'
))
const effectiveRightPanelCollapsed = computed(() => (
  shouldEmbedMonitorInSsh.value || isConnectionCenterLayout.value
    ? true
    : rightPanelCollapsed.value
))

function setWorkspaceFileDrawerState(tabId: string, open: boolean) {
  workspaceFileDrawerState.value = {
    ...workspaceFileDrawerState.value,
    [tabId]: open,
  }
}

function getWorkspaceFileDrawerState(tabId: string) {
  return workspaceFileDrawerState.value[tabId] ?? true
}

function toggleCurrentWorkspaceFileDrawer() {
  if (currentTab.value?.type !== 'ssh') return
  const tabId = currentTab.value.id
  const nextOpen = !getWorkspaceFileDrawerState(tabId)
  setWorkspaceFileDrawerState(tabId, nextOpen)
}

function handleStandaloneFilePreview() {
  message.info('独立文件窗口暂不提供文件预览，请在主工作区内打开文件。')
}

watch(isSshWorkspaceLayout, (nextIsSsh, previousIsSsh) => {
  if (nextIsSsh && !previousIsSsh && rightPanelTab.value === 'monitor') {
    embeddedMonitorCollapsed.value = false
  }
})

watch(activeId, (nextId, prevId) => {
  if (!nextId || nextId === prevId) return
  triggerWorkspaceMotion(nextId)
})

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

function isNativeContextMenuAllowed(target: EventTarget | null) {
  const element = target as HTMLElement | null
  if (!element) return false

  return Boolean(
    element.closest('input, textarea, select, [contenteditable="true"], .monaco-editor, .monaco-diff-editor')
  )
}

function handleAppContextMenu(event: MouseEvent) {
  if (isNativeContextMenuAllowed(event.target)) {
    return
  }

  event.preventDefault()
}

function clearFreshTabMotion() {
  if (freshTabTimer) {
    window.clearTimeout(freshTabTimer)
    freshTabTimer = null
  }
  freshTabId.value = ''
}

function markFreshTab(id: string) {
  clearFreshTabMotion()
  freshTabId.value = id
  freshTabTimer = window.setTimeout(() => {
    if (freshTabId.value === id) {
      freshTabId.value = ''
    }
    freshTabTimer = null
  }, 360)
}

function triggerWorkspaceMotion(id: string) {
  if (workspaceMotionFrame) {
    window.cancelAnimationFrame(workspaceMotionFrame)
    workspaceMotionFrame = null
  }
  if (workspaceMotionTimer) {
    window.clearTimeout(workspaceMotionTimer)
    workspaceMotionTimer = null
  }

  activatingWorkspaceId.value = ''
  workspaceMotionFrame = window.requestAnimationFrame(() => {
    activatingWorkspaceId.value = id
    workspaceMotionTimer = window.setTimeout(() => {
      if (activatingWorkspaceId.value === id) {
        activatingWorkspaceId.value = ''
      }
      workspaceMotionTimer = null
    }, 260)
    workspaceMotionFrame = null
  })
}

function openTabWithMotion(tab: ConnectionTab, options: { markFresh?: boolean } = {}) {
  tabs.value.push(tab)
  activeId.value = tab.id

  if (options.markFresh !== false) {
    markFreshTab(tab.id)
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

// 获取活动连接信息（computed 缓存）
const activeConnection = computed(() => {
  const tab = currentTab.value
  if (!tab || tab.type === 'connections') return ''
  if (tab.type === 'ssh') {
    const username = tab.profile?.username
    const host = tab.profile?.host
    if (username && host) return `${username}@${host}`
    return host || ''
  }
  return tab.title
})

const activeConnectionCopyText = computed(() => {
  const tab = currentTab.value
  if (tab?.type !== 'ssh') return ''
  return tab.profile?.host || ''
})

function getActiveProfileId() {
  return currentTab.value?.type === 'ssh' ? currentTab.value.profile?.id || '' : ''
}

// 获取活动标签页（兼容旧调用）
function getActiveTab() {
  return currentTab.value
}

// 启动已保存的连接
async function launchSavedProfile(p: SshProfile) {
  try {
    const existingTab = tabs.value.find(tab => tab.type === 'ssh' && tab.profile?.id === p.id)
    if (existingTab) {
      activeId.value = existingTab.id
      if (existingTab.sshState === 'disconnected') {
        await reconnectSsh(existingTab, { silent: true })
      }
      return
    }

    const tabInfo = SshService.createPendingProfileTab(p)
    openTabWithMotion(tabInfo)
    const autoPassword = await SshService.openSavedProfile(tabInfo.id, p)
    const currentSshTab = findTabById(tabInfo.id)
    if (!currentSshTab) {
      await SshService.closeConnection(tabInfo.id)
      return
    }

    patchSshTab(tabInfo.id, {
      autoPassword,
      sshState: 'connected',
    })
  } catch (error) {
    if (isUserCancelledConnection(error)) {
      const pendingTab = tabs.value.find((tab) => tab.type === 'ssh' && tab.profile?.id === p.id)
      if (pendingTab?.sshState === 'connecting') {
        await removePendingSshTab(pendingTab.id)
      }
      return
    }

    const failedTab = tabs.value.find((tab) => tab.type === 'ssh' && tab.profile?.id === p.id)
    if (failedTab) {
      patchSshTab(failedTab.id, { sshState: 'disconnected' })
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
  if (appMode === 'remote-files') {
    message.info('独立文件窗口暂不展示传输队列，请在主窗口查看下载进度。')
  }
  rightPanelTab.value = 'download'
  rightPanelCollapsed.value = false
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
  if (appMode === 'remote-files') {
    message.info('独立文件窗口暂不展示传输队列，请在主窗口查看上传进度。')
  }
  rightPanelTab.value = 'download'
  rightPanelCollapsed.value = false
  rightPanelRef.value?.addUpload(uploadInfo)
}

function handleRightPanelTabSelect(tab: MonitorTab) {
  if (tab === 'monitor' && isSshWorkspaceLayout.value) {
    if (rightPanelTab.value === 'monitor') {
      embeddedMonitorCollapsed.value = !embeddedMonitorCollapsed.value
      return
    }

    rightPanelTab.value = tab
    embeddedMonitorCollapsed.value = false
    return
  }

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
      openTabWithMotion(tabInfo)
      
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
  openTabWithMotion({ id, title: '本地终端', type: 'local' })
  
  await invoke('start_pty', { id, cols: 120, rows: 30 })
}

function findTabById(id: string) {
  return tabs.value.find((item) => item.id === id) || null
}

function updateSshTabState(id: string, state: ConnectionTab['sshState']) {
  const tab = tabs.value.find((item) => item.id === id)
  if (tab?.type === 'ssh') {
    tab.sshState = state
  }
}

function patchSshTab(id: string, patch: Partial<ConnectionTab>) {
  const tab = tabs.value.find((item) => item.id === id)
  if (tab?.type === 'ssh') {
    Object.assign(tab, patch)
  }
}

async function removePendingSshTab(id: string) {
  await closeTab(id, { skipDisconnect: true })
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
  openTabWithMotion(tab)
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
  
  openTabWithMotion({
    id,
    title,
    type: 'file',
    fileInfo,
    connectionId
  })
}

// 关闭标签页
async function closeTab(id: string, options: { skipDisconnect?: boolean } = {}) {
  const index = tabs.value.findIndex(t => t.id === id)
  if (index === -1) return
  
  const tab = tabs.value[index]
  
  // 清理资源
  if (tab.type === 'ssh' && !options.skipDisconnect && tab.sshState !== 'disconnected') {
    closingTabIds.add(id)
    await SshService.closeConnection(id)
  } else if (tab.type === 'local') {
    await invoke('close_pty', { id })
  }
  
  // 移除标签页
  tabs.value.splice(index, 1)
  manualDisconnectingIds.delete(id)
  closingTabIds.delete(id)
  if (workspaceFileDrawerState.value[id] !== undefined) {
    const nextDrawerState = { ...workspaceFileDrawerState.value }
    delete nextDrawerState[id]
    workspaceFileDrawerState.value = nextDrawerState
  }

  if (tabs.value.length === 0) {
    const tab = createConnectionCenterTab()
    openTabWithMotion(tab)
    return
  }
  
  // 如果关闭的是当前活动标签页，切换到前一个标签页
  if (activeId.value === id) {
    activeId.value = tabs.value[index - 1]?.id || tabs.value[0]?.id || ''
  }
}

// 重新连接SSH
async function reconnectSsh(tab: ConnectionTab | null, options: { silent?: boolean } = {}) {
  if (tab?.type === 'ssh' && tab.profile) {
    if (tab.sshState === 'connected') {
      return true
    }
    if (tab.sshState === 'connecting') {
      return false
    }
    try {
      updateSshTabState(tab.id, 'connecting')
      await SshService.reconnect(tab.id, tab.profile)
      updateSshTabState(tab.id, 'connected')
      return true
    } catch (error) {
      if (isUserCancelledConnection(error)) {
        updateSshTabState(tab.id, 'disconnected')
        return false
      }

      updateSshTabState(tab.id, 'disconnected')
      if (!options.silent) {
        message.error({
          content: String(error),
          duration: 8,
          style: {
            marginTop: '50px',
            maxWidth: '400px'
          }
        })
      }
      return false
    }
  }

  return false
}

function handleSshTabExit(id: string) {
  if (closingTabIds.has(id)) return

  if (manualDisconnectingIds.has(id)) {
    updateSshTabState(id, 'disconnected')
    manualDisconnectingIds.delete(id)
    return
  }

  closeTab(id, { skipDisconnect: true })
}

async function disconnectSshTab(id: string) {
  const tab = tabs.value.find((item) => item.id === id)
  if (tab?.type !== 'ssh' || tab.sshState === 'disconnected') return

  manualDisconnectingIds.add(id)
  try {
    await SshService.closeConnection(id)
    updateSshTabState(id, 'disconnected')
  } finally {
    manualDisconnectingIds.delete(id)
  }
}

async function reconnectAllSshTabs() {
  const candidates = tabs.value.filter((tab) => (
    tab.type === 'ssh' && tab.sshState === 'disconnected' && tab.profile
  ))

  if (!candidates.length) return

  let successCount = 0
  let failedCount = 0

  for (const tab of candidates) {
    const success = await reconnectSsh(tab, { silent: true })
    if (success) {
      successCount += 1
    } else {
      failedCount += 1
    }
  }

  if (successCount && !failedCount) {
    message.success(`已连接 ${successCount} 个 SSH 标签`)
    return
  }

  if (successCount || failedCount) {
    message.warning(`批量连接完成：成功 ${successCount} 个，失败 ${failedCount} 个`)
  }
}

async function closeOtherTabs(id: string) {
  const ids = tabs.value
    .filter((tab) => tab.id !== id)
    .map((tab) => tab.id)

  for (const tabId of ids) {
    await closeTab(tabId)
  }
}

async function closeAllTabs() {
  const ids = tabs.value.map((tab) => tab.id)
  for (const tabId of ids) {
    await closeTab(tabId)
  }
}

async function handleTabMenuAction(payload: { action: TabContextMenuAction, tabId: string }) {
  const tab = tabs.value.find((item) => item.id === payload.tabId)
  if (!tab) return

  switch (payload.action) {
    case 'connect':
      await reconnectSsh(tab)
      break
    case 'connectAll':
      await reconnectAllSshTabs()
      break
    case 'disconnect':
      await disconnectSshTab(payload.tabId)
      break
    case 'close':
      await closeTab(payload.tabId)
      break
    case 'closeOthers':
      await closeOtherTabs(payload.tabId)
      break
    case 'closeAll':
      await closeAllTabs()
      break
  }
}

// 生命周期钩子
onMounted(async () => {
  // 加载已保存的SSH配置
  try {
    await refreshConnectionData()
  } catch (error) {
    console.error('初始化连接数据失败:', error)
    message.error({
      content: `初始化连接数据失败：${String(error)}`,
      duration: 8,
      style: {
        marginTop: '50px',
        maxWidth: '460px'
      }
    })
  }
})

onBeforeUnmount(() => {
  clearFreshTabMotion()
  if (workspaceMotionFrame) {
    window.cancelAnimationFrame(workspaceMotionFrame)
  }
  if (workspaceMotionTimer) {
    window.clearTimeout(workspaceMotionTimer)
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

.remote-files-window {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgba(77, 136, 255, 0.1), transparent 16%),
    linear-gradient(180deg, var(--bg-color) 0%, var(--surface-0) 100%);
}

.remote-files-window__body {
  display: flex;
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
  gap: 6px;
  padding: 0;
  overflow: hidden;
}

.remote-files-window__body > * {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
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
  transform-origin: 50% 18%;
  will-change: transform, opacity, filter;
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

.workspace-view.is-activating {
  animation: workspace-view-reveal 240ms cubic-bezier(0.2, 0.82, 0.2, 1);
}

.workspace-view.is-activating::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.12), transparent 28%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 42%);
  opacity: 0;
  animation: workspace-view-glow 240ms cubic-bezier(0.18, 0.82, 0.22, 1);
}

@keyframes workspace-view-reveal {
  0% {
    opacity: 0;
    transform: translate3d(0, 14px, 0) scale(0.992);
    filter: saturate(0.94);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: saturate(1);
  }
}

@keyframes workspace-view-glow {
  0% {
    opacity: 0;
  }
  38% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
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
