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
                  @open-host-center="openHostCenter"
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

                      <HostCenter
                        v-else-if="tab.type === 'hosts'"
                        :profiles="profiles"
                        :groups="groups"
                        :active-profile-id="getActiveProfileId()"
                        :theme="theme"
                        :view-mode="terminalConfig.hostCenterViewMode"
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
              :connection-state="activeConnectionState"
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
          :theme-config="themeCenterConfig"
          :theme-preset-options="themePresetOptions"
          :theme="theme"
          :profiles="profiles"
          @save-config="updateTerminalConfig"
          @save-theme-config="updateThemeCenterConfig"
          @refresh-profiles="refreshProfiles"
        />

        <a-modal
          v-model:open="groupPromptVisible"
          :title="groupPromptTitle"
          width="420px"
          wrap-class-name="group-prompt-modal"
          :classes="groupPromptModalClasses"
          :styles="groupPromptModalStyles"
          :close-icon="groupPromptCloseIconNode"
          :mask-closable="false"
          @cancel="handleGroupPromptCancel"
        >
          <div class="group-prompt-modal__body">
            <a-input
              ref="groupPromptInputRef"
              v-model:value="groupPromptValue"
              :placeholder="groupPromptPlaceholder"
              @press-enter="handleGroupPromptConfirm"
            />
          </div>
          <template #footer>
            <div class="group-prompt-modal__footer">
              <a-button class="group-prompt-modal__button" @click="handleGroupPromptCancel">
                取消
              </a-button>
              <a-button
                type="primary"
                class="group-prompt-modal__button group-prompt-modal__button--primary"
                @click="handleGroupPromptConfirm"
              >
                确定
              </a-button>
            </div>
          </template>
        </a-modal>
      </div>
    </a-app>
  </a-config-provider>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, h, onMounted, onBeforeUnmount, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { CloseOutlined } from '@antdv-next/icons'
import { theme as antdTheme } from 'antdv-next'
import type {
  ConnectionTab,
  SftpFileEntry,
  SshProfile,
  TabContextMenuAction,
  TerminalConfig,
  ThemeCenterConfig,
  ThemeName,
  ThemePresetOption,
  UploadRequest,
} from './types/app'

// 导入组件
import TabManager from './components/TabManager.vue'
import StatusBar from './components/StatusBar.vue'
const SshModal = defineAsyncComponent(() => import('./components/SshModal.vue'))
const SettingsModal = defineAsyncComponent(() => import('./components/SettingsModal.vue'))
const Terminal = defineAsyncComponent(() => import('./components/Terminal.vue'))
const RightPanel = defineAsyncComponent(() => import('./components/RightPanel.vue'))
const HostCenter = defineAsyncComponent(() => import('./components/HostCenter.vue'))
const SshWorkspace = defineAsyncComponent(() => import('./components/SshWorkspace.vue'))
const FileEditor = defineAsyncComponent(() => import('./components/FileEditor.vue'))
const RemoteFileWorkbench = defineAsyncComponent(() => import('./components/RemoteFileWorkbench.vue'))

// 导入服务
import SshService from './services/SshService'
import ThemeService from './services/ThemeService'
import { useWorkspaceTabs } from './composables/useWorkspaceTabs'
import { useSshConnectionFlow } from './composables/useSshConnectionFlow'
import { useHostCatalog } from './composables/useHostCatalog'
import { useWorkspaceChrome } from './composables/useWorkspaceChrome'

const launchParams = new URLSearchParams(window.location.search)
const appMode = launchParams.get('mode') || 'main'
const remoteFilesConnectionId = launchParams.get('connectionId') || ''
const remoteFilesTitle = launchParams.get('title') || '文件管理'
const remoteFilesInitialPath = launchParams.get('path') || '/'

// 响应式数据
const showSettings = ref(false)
const rightPanelRef = ref<{
  addDownload: (fileName: string, remotePath: string, savePath: string, connectionId: string) => void
  addUpload: (upload: UploadRequest) => void
} | null>(null)
const groupPromptCloseIconNode = computed(() => h(CloseOutlined, { class: 'modal-close-icon' }))
const groupPromptModalClasses = {
  container: 'group-prompt-modal__container',
}
const groupPromptModalStyles = {
  mask: {
    background: 'var(--overlay-mask-bg)',
    backdropFilter: 'blur(12px)',
  },
  container: {
    background: 'var(--overlay-panel-solid)',
    border: '1px solid var(--border-color)',
    boxShadow: 'none',
    padding: '0',
    overflow: 'hidden',
    borderRadius: '14px',
  },
  content: {
    background: 'var(--overlay-panel-solid)',
    padding: '0',
  },
  header: {
    background: 'var(--overlay-panel-solid)',
    borderBottom: '1px solid var(--overlay-divider-color)',
    marginBottom: '0',
    padding: '18px 20px 14px',
  },
  body: {
    background: 'var(--overlay-panel-solid)',
    color: 'var(--text-color)',
    padding: '16px 20px 10px',
  },
  footer: {
    background: 'var(--overlay-panel-solid)',
    borderTop: '1px solid var(--overlay-divider-color)',
    padding: '12px 20px 18px',
  },
}
let unsubscribeThemeService: (() => void) | null = null

// 主题和设置
const theme = ref<ThemeName>(ThemeService.getTheme())
const themeCenterConfig = ref<ThemeCenterConfig>(ThemeService.getThemeCenterConfig())
const terminalConfig = ref<TerminalConfig>(ThemeService.getTerminalConfig())
const themePresetOptions = ref<ThemePresetOption[]>(ThemeService.getThemePresetOptions())
const antdThemeConfig = computed(() => {
  themeCenterConfig.value

  return {
    algorithm: theme.value === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: ThemeService.getAntdTokens(),
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
  }
})

const {
  profiles,
  groups,
  showSshModal,
  sshEditMode,
  editingProfile,
  groupPromptVisible,
  groupPromptTitle,
  groupPromptPlaceholder,
  groupPromptValue,
  groupPromptInputRef,
  refreshProfiles,
  refreshConnectionData,
  closeSshModal,
  newSsh,
  editProfile,
  deleteProfile,
  handleGroupPromptCancel,
  handleGroupPromptConfirm,
  createGroup,
  renameGroup,
  deleteGroup,
} = useHostCatalog()

const {
  tabs,
  activeId,
  currentTab,
  freshTabId,
  activatingWorkspaceId,
  openTabWithMotion,
  activateTab,
  findTabById,
  patchSshTab,
  updateSshTabState,
  setWorkspaceFileDrawerState,
  getWorkspaceFileDrawerState,
  toggleCurrentWorkspaceFileDrawer,
  removeTabState,
  openHostCenter,
  cleanupWorkspaceTabState,
} = useWorkspaceTabs(createHostCenterTab)

function handleStandaloneFilePreview() {
  message.info('独立文件窗口暂不提供文件预览，请在主工作区内打开文件。')
}

function createHostCenterTab(): ConnectionTab {
  return {
    id: `hosts-${Date.now()}`,
    title: '主机中心',
    type: 'hosts'
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

function showLongError(content: string, maxWidth = '400px') {
  message.error({
    content,
    duration: 8,
    style: {
      marginTop: '50px',
      maxWidth,
    },
  })
}

// 更新终端配置
function updateTerminalConfig(config: Partial<TerminalConfig>) {
  terminalConfig.value = ThemeService.updateTerminalConfig(config)
}

function updateThemeCenterConfig(config: Partial<ThemeCenterConfig>) {
  const result = ThemeService.updateThemeCenterConfig(config)
  theme.value = result.theme
  themeCenterConfig.value = result.themeConfig
}

const {
  rightPanelCollapsed,
  embeddedMonitorCollapsed,
  rightPanelTab,
  isSshWorkspaceLayout,
  shouldEmbedMonitorInSsh,
  effectiveRightPanelCollapsed,
  activeConnection,
  activeConnectionCopyText,
  activeConnectionState,
  handleStartDownload,
  handleStartUpload,
  handleRightPanelTabSelect,
} = useWorkspaceChrome({
  currentTab,
  appMode,
  rightPanelRef,
})

function getActiveProfileId() {
  return currentTab.value?.type === 'ssh' ? currentTab.value.profile?.id || '' : ''
}

// 获取活动标签页（兼容旧调用）
const {
  isClosingSshTab,
  markClosingSshTab,
  clearTrackedSshTab,
  launchSavedProfile,
  submitSsh,
  reconnectSsh,
  handleSshTabExit,
  disconnectSshTab,
  reconnectAllSshTabs,
} = useSshConnectionFlow({
  tabs,
  activateTab,
  openTabWithMotion,
  findTabById,
  patchSshTab,
  updateSshTabState,
  closeTab: (id, options = {}) => closeTab(id, options),
  refreshConnectionData,
  showLongError,
  closeSshModal,
})

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
    markClosingSshTab(id)
    await SshService.closeConnection(id)
  } else if (tab.type === 'local') {
    await invoke('close_pty', { id })
  }
  
  // 移除标签页
  tabs.value.splice(index, 1)
  clearTrackedSshTab(id)
  removeTabState(id)

  if (tabs.value.length === 0) {
    const tab = createHostCenterTab()
    openTabWithMotion(tab)
    return
  }
  
  // 如果关闭的是当前活动标签页，切换到前一个标签页
  if (activeId.value === id) {
    activateTab(tabs.value[index - 1]?.id || tabs.value[0]?.id || '')
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
    unsubscribeThemeService = ThemeService.subscribe((payload) => {
      theme.value = payload.theme
      themeCenterConfig.value = payload.themeConfig
    })
    await refreshConnectionData()
  } catch (error) {
    console.error('初始化连接数据失败:', error)
    showLongError(`初始化连接数据失败：${String(error)}`, '460px')
  }
})

onBeforeUnmount(() => {
  unsubscribeThemeService?.()
  unsubscribeThemeService = null
  cleanupWorkspaceTabState()

  void Promise.all(tabs.value.map(async (tab) => {
    if (tab.type === 'ssh') {
      if (!isClosingSshTab(tab.id)) {
        await SshService.closeConnection(tab.id)
      }
    } else if (tab.type === 'local') {
      await invoke('close_pty', { id: tab.id })
    }
  }))
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
.workspace-view--hosts,
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

.workspace-shell {
  padding: 0;
  background: var(--bg-color);
}

.workspace-frame {
  background: var(--workspace-frame-bg);
  border: none;
  box-shadow: none;
}

.main-container {
  gap: 0;
}

.content-container,
.terminals-container,
.workspace-view {
  background: var(--workspace-view-bg);
}

.workspace-view {
  box-shadow: none;
  border-top: 1px solid var(--workspace-view-border);
}

.workspace-view--ssh,
.workspace-view--hosts,
.workspace-view--file {
  backdrop-filter: none;
}

.workspace-view--local {
  background: var(--workspace-view-bg);
}

.workspace-view.is-activating {
  animation: none;
}

.workspace-view.is-activating::after {
  display: none;
}

.group-prompt-modal .ant-modal-content {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  overflow: hidden !important;
  border-radius: 14px !important;
}

.group-prompt-modal__container {
  background: var(--overlay-panel-solid) !important;
  border-radius: 14px !important;
}

.group-prompt-modal .ant-modal-title {
  color: var(--text-color) !important;
  font-weight: 700;
}

.group-prompt-modal .ant-modal-close {
  color: var(--text-color) !important;
}

.group-prompt-modal .ant-modal-close:hover {
  background: var(--hover-bg) !important;
}

.group-prompt-modal .modal-close-icon,
.group-prompt-modal .modal-close-icon svg {
  color: var(--text-color) !important;
}

.group-prompt-modal__body .ant-input {
  height: 42px;
  border-radius: 10px !important;
  border-color: var(--border-color) !important;
  background: var(--surface-1) !important;
  color: var(--text-color) !important;
  box-shadow: none !important;
}

.group-prompt-modal__body .ant-input::placeholder {
  color: var(--muted-color) !important;
}

.group-prompt-modal__body .ant-input:focus,
.group-prompt-modal__body .ant-input-focused {
  border-color: var(--strong-border) !important;
  box-shadow: 0 0 0 3px var(--primary-soft) !important;
}

.group-prompt-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.group-prompt-modal__button {
  min-width: 78px;
  border-radius: 10px !important;
  border-color: var(--border-color) !important;
  background: var(--surface-2) !important;
  color: var(--text-color) !important;
  box-shadow: none !important;
  font-weight: 700;
}

.group-prompt-modal__button:hover {
  border-color: var(--strong-border) !important;
  background: var(--hover-bg) !important;
  color: var(--text-color) !important;
}

.group-prompt-modal .ant-btn.group-prompt-modal__button--primary,
.group-prompt-modal .ant-btn-primary.group-prompt-modal__button--primary {
  background: var(--text-color) !important;
  border-color: var(--text-color) !important;
  color: var(--bg-color) !important;
}

.group-prompt-modal .ant-btn.group-prompt-modal__button--primary:hover,
.group-prompt-modal .ant-btn-primary.group-prompt-modal__button--primary:hover {
  background: var(--strong-border) !important;
  border-color: var(--strong-border) !important;
  color: var(--bg-color) !important;
}
</style>
