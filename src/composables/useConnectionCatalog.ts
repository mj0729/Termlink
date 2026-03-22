import { nextTick, ref } from 'vue'
import { Modal, message } from 'antdv-next'
import { invoke } from '@tauri-apps/api/core'
import SshService from '../services/SshService'
import type { SshProfile } from '../types/app'

export function useConnectionCatalog() {
  const profiles = ref<SshProfile[]>([])
  const groups = ref<string[]>([])
  const showSshModal = ref(false)
  const sshEditMode = ref(false)
  const editingProfile = ref<SshProfile | null>(null)

  const groupPromptVisible = ref(false)
  const groupPromptTitle = ref('新增分组')
  const groupPromptPlaceholder = ref('请输入分组名称')
  const groupPromptValue = ref('')
  const groupPromptInputRef = ref<{ focus?: () => void } | null>(null)
  let groupPromptResolver: ((value: string | null) => void) | null = null

  async function refreshProfiles() {
    profiles.value = await SshService.getProfiles()
  }

  async function refreshGroups() {
    groups.value = await SshService.getGroups()
  }

  async function refreshConnectionData() {
    await Promise.all([refreshProfiles(), refreshGroups()])
  }

  function closeSshModal() {
    showSshModal.value = false
  }

  function newSsh() {
    sshEditMode.value = false
    editingProfile.value = null
    showSshModal.value = true
  }

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
      },
    })
  }

  function promptGroupName(title: string, initialValue = '', placeholder = '请输入分组名称') {
    groupPromptTitle.value = title
    groupPromptPlaceholder.value = placeholder
    groupPromptValue.value = initialValue
    groupPromptVisible.value = true

    nextTick(() => {
      groupPromptInputRef.value?.focus?.()
    })

    return new Promise<string | null>((resolve) => {
      groupPromptResolver = resolve
    })
  }

  function closeGroupPrompt(result: string | null) {
    groupPromptVisible.value = false
    groupPromptResolver?.(result)
    groupPromptResolver = null
  }

  function handleGroupPromptCancel() {
    closeGroupPrompt(null)
  }

  function handleGroupPromptConfirm() {
    const value = groupPromptValue.value.trim()
    if (!value) {
      message.warning('请输入分组名称')
      nextTick(() => {
        groupPromptInputRef.value?.focus?.()
      })
      return
    }

    closeGroupPrompt(value)
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
      },
    })
  }

  return {
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
    refreshGroups,
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
  }
}
