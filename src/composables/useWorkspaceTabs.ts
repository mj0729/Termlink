import { computed, ref, watch } from 'vue'
import type { ConnectionTab } from '../types/app'

type OpenTabOptions = {
  markFresh?: boolean
}

export function useWorkspaceTabs(createHostCenterTab: () => ConnectionTab) {
  const tabs = ref<ConnectionTab[]>([createHostCenterTab()])
  const activeId = ref(tabs.value[0]?.id || '')
  const freshTabId = ref('')
  const activatingWorkspaceId = ref('')
  const workspaceFileDrawerState = ref<Record<string, boolean>>({})

  let freshTabTimer: number | null = null
  let workspaceMotionFrame: number | null = null
  let workspaceMotionTimer: number | null = null

  const currentTab = computed(() => {
    if (!activeId.value) return null
    return tabs.value.find((tab) => tab.id === activeId.value) || null
  })

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

  function openTabWithMotion(tab: ConnectionTab, options: OpenTabOptions = {}) {
    tabs.value.push(tab)
    activeId.value = tab.id

    if (options.markFresh !== false) {
      markFreshTab(tab.id)
    }
  }

  function activateTab(id: string) {
    activeId.value = id
  }

  function findTabById(id: string) {
    return tabs.value.find((item) => item.id === id) || null
  }

  function patchSshTab(id: string, patch: Partial<ConnectionTab>) {
    const tab = findTabById(id)
    if (tab?.type === 'ssh') {
      Object.assign(tab, patch)
    }
  }

  function updateSshTabState(id: string, state: ConnectionTab['sshState']) {
    const tab = findTabById(id)
    if (tab?.type === 'ssh') {
      tab.sshState = state
    }
  }

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
    setWorkspaceFileDrawerState(tabId, !getWorkspaceFileDrawerState(tabId))
  }

  function removeTabState(id: string) {
    if (workspaceFileDrawerState.value[id] === undefined) {
      return
    }

    const nextDrawerState = { ...workspaceFileDrawerState.value }
    delete nextDrawerState[id]
    workspaceFileDrawerState.value = nextDrawerState
  }

  function openHostCenter() {
    const existingTab = tabs.value.find((tab) => tab.type === 'hosts')
    if (existingTab) {
      activeId.value = existingTab.id
      return
    }

    openTabWithMotion(createHostCenterTab())
  }

  watch(activeId, (nextId, prevId) => {
    if (!nextId || nextId === prevId) return
    triggerWorkspaceMotion(nextId)
  })

  function cleanupWorkspaceTabState() {
    clearFreshTabMotion()
    if (workspaceMotionFrame) {
      window.cancelAnimationFrame(workspaceMotionFrame)
      workspaceMotionFrame = null
    }
    if (workspaceMotionTimer) {
      window.clearTimeout(workspaceMotionTimer)
      workspaceMotionTimer = null
    }
  }

  return {
    tabs,
    activeId,
    currentTab,
    freshTabId,
    activatingWorkspaceId,
    workspaceFileDrawerState,
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
  }
}
