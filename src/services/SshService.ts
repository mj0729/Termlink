import { invoke } from '@tauri-apps/api/core'
import { Button } from 'antdv-next'
import { h } from 'vue'
import type {
  ConnectionTab,
  SshConnectionPayload,
  SshProfile,
} from '../types/app'

type SshAuthRequestPayload = {
  connection_id: string
  profile_id: string | null
  host: string
  port: number
  username: string
  password: string | null
  private_key_path: string | null
  passphrase: string | null
  strict_host_key_checking: boolean
}

type HostKeyVerification = {
  state: 'trusted' | 'unknown' | 'changed' | 'revoked'
  presented: {
    host: string
    port: number
    algorithm: string
    fingerprint_sha256: string
    public_key_base64: string
  }
  stored?: {
    fingerprint_sha256: string
  } | null
  requires_user_confirmation: boolean
}

export type SshTerminalChunk = {
  seq: number
  data: string
}

export type SshTerminalSnapshot = {
  chunks: SshTerminalChunk[]
  latest_seq: number
}

class SshService {
  private readonly cancelledMessage = '已取消连接'

  private readonly defaultTerminalSize = {
    cols: 80,
    rows: 24,
  }

  async promptForPassword(
    profile: Pick<SshProfile, 'host' | 'port' | 'username'>,
    title = '输入 SSH 密码',
  ): Promise<string | null> {
    let password = ''

    return new Promise((resolve) => {
      Modal.confirm({
        title,
        content: h('div', { style: 'display: grid; gap: 10px;' }, [
          h(
            'div',
            { style: 'white-space: pre-line; line-height: 1.6;' },
            `目标：${profile.username}@${profile.host}:${profile.port}`,
          ),
          h('input', {
            type: 'password',
            autofocus: true,
            placeholder: '请输入密码',
            style: 'width: 100%; padding: 8px 12px; border: 1px solid #d9d9d9; border-radius: 8px;',
            onInput: (event: Event) => {
              password = (event.target as HTMLInputElement).value
            },
          }),
        ]),
        okText: '连接',
        cancelText: '取消',
        onOk: async () => resolve(password || null),
        onCancel: async () => resolve(null),
      })
    })
  }

  async resolvePasswordForProfile(profile: SshProfile): Promise<string | null> {
    if (profile.private_key) {
      return null
    }

    if (profile.save_password) {
      try {
        const savedPassword = await invoke<string | null>('get_ssh_password', { id: profile.id })
        if (savedPassword) {
          return savedPassword
        }
      } catch (e) {
        console.error('获取SSH密码失败:', e)
      }
    }

    return null
  }

  buildAuthRequest(
    connectionId: string,
    profile: Pick<SshProfile, 'host' | 'port' | 'username' | 'private_key'>,
    password: string | null = null,
    profileId: string | null = null,
  ): SshAuthRequestPayload {
    return {
      connection_id: connectionId,
      profile_id: profileId,
      host: profile.host,
      port: profile.port || 22,
      username: profile.username,
      password,
      private_key_path: profile.private_key || null,
      passphrase: null,
      strict_host_key_checking: true,
    }
  }

  async startConnection(auth: SshAuthRequestPayload): Promise<void> {
    try {
      await invoke('start_ssh_terminal', {
        auth,
        ...this.defaultTerminalSize,
      })
    } catch (error) {
      if (!this.isHostKeyConfirmationError(error)) {
        throw error
      }

      const resolvedAuth = await this.resolveHostKeyTrust(auth)
      await invoke('start_ssh_terminal', {
        auth: resolvedAuth,
        ...this.defaultTerminalSize,
      })
    }
  }

  isHostKeyConfirmationError(error: unknown): boolean {
    const text = String(error).toLowerCase()
    return text.includes('主机密钥需要确认') || text.includes('host key')
  }

  isAuthenticationError(error: unknown): boolean {
    const text = String(error).toLowerCase()
    return text.includes('认证') || text.includes('authentication') || text.includes('password')
  }

  isUserCancelledError(error: unknown): boolean {
    return String(error).includes(this.cancelledMessage)
  }

  createCancelledError(): Error {
    return new Error(this.cancelledMessage)
  }

  async resolveHostKeyTrust(
    auth: SshAuthRequestPayload,
    verification?: HostKeyVerification,
  ): Promise<SshAuthRequestPayload> {
    const resolvedVerification = verification ?? await invoke<HostKeyVerification>('preview_ssh_host_key', {
      request: auth,
    })

    if (!resolvedVerification.requires_user_confirmation) {
      return auth
    }

    const action = await this.promptHostKeyDecision(resolvedVerification)

    if (action === 'reject') {
      throw new Error('用户取消主机密钥确认')
    }

    if (action === 'trust-and-save') {
      await invoke('save_ssh_host_key_decision', {
        decision: {
          host: resolvedVerification.presented.host,
          port: resolvedVerification.presented.port,
          algorithm: resolvedVerification.presented.algorithm,
          fingerprint_sha256: resolvedVerification.presented.fingerprint_sha256,
          public_key_base64: resolvedVerification.presented.public_key_base64,
          action,
          profile_id: auth.profile_id,
        },
      })
    }

    return {
      ...auth,
      strict_host_key_checking: false,
    }
  }

  async promptHostKeyDecision(verification: HostKeyVerification): Promise<'trust-and-save' | 'trust-once' | 'reject'> {
    const stateLabelMap = {
      unknown: '首次连接',
      changed: '主机密钥已变化',
      revoked: '主机密钥已被撤销',
      trusted: '主机密钥已受信任',
    } as const

    const details = [
      `状态：${stateLabelMap[verification.state] || verification.state}`,
      `主机：${verification.presented.host}:${verification.presented.port}`,
      `算法：${verification.presented.algorithm}`,
      `指纹：${verification.presented.fingerprint_sha256}`,
    ]

    if (verification.stored?.fingerprint_sha256) {
      details.push(`已存储指纹：${verification.stored.fingerprint_sha256}`)
    }

    return new Promise<'trust-and-save' | 'trust-once' | 'reject'>((resolve) => {
      let settled = false
      let modal: { destroy: () => void } | null = null

      const finish = (decision: 'trust-and-save' | 'trust-once' | 'reject') => {
        if (settled) {
          return
        }
        settled = true
        modal?.destroy()
        resolve(decision)
      }

      modal = Modal.confirm({
        title: verification.state === 'changed' ? '主机密钥已变化' : '确认主机密钥',
        content: h(
          'div',
          { style: 'white-space: pre-line; line-height: 1.6;' },
          [
            verification.state === 'changed'
              ? '检测到主机密钥与已保存记录不一致。'
              : '这是该主机的首次连接。',
            '',
            ...details,
            '',
            '选择“仅本次信任”会继续连接，但不会保存到本地主机密钥记录。',
            '选择“信任并保存”会继续连接，并将当前主机密钥保存到本地记录。',
          ].join('\n'),
        ),
        okText: null,
        cancelText: null,
        footer: () => h(
          'div',
          { style: 'display: flex; justify-content: flex-end; gap: 8px; width: 100%;' },
          [
            h(
              Button,
              { onClick: () => finish('reject') },
              { default: () => '拒绝连接' },
            ),
            h(
              Button,
              { onClick: () => finish('trust-once') },
              { default: () => '仅本次信任' },
            ),
            h(
              Button,
              { type: 'primary', onClick: () => finish('trust-and-save') },
              { default: () => '信任并保存' },
            ),
          ],
        ),
        onCancel: async () => finish('reject'),
      })
    })
  }

  buildConnectionTab(
    id: string,
    title: string,
    profile: SshProfile,
    autoPassword: string | null,
    sshState: ConnectionTab['sshState'] = 'connected',
  ): ConnectionTab {
    return {
      id,
      title,
      type: 'ssh',
      profile,
      sshState,
      autoPassword,
    }
  }

  getConnectionTabTitle(profile: Pick<SshProfile, 'name' | 'username' | 'host'>): string {
    if (profile.name?.trim()) {
      return profile.name.trim()
    }

    return profile.username ? `${profile.username}@${profile.host}` : profile.host
  }

  async persistPasswordIfNeeded(profile: SshProfile, password: string | null): Promise<void> {
    if (!profile.save_password || profile.private_key || !password) {
      return
    }

    try {
      await invoke('save_ssh_profile', {
        profile,
        password,
      })
    } catch (error) {
      console.warn('回写SSH密码失败，下次可能仍需重新输入:', error)
    }
  }

  async connectProfile(
    connectionId: string,
    profile: SshProfile,
    initialPassword: string | null,
    profileId: string | null,
  ): Promise<string | null> {
    let password = profile.private_key ? null : initialPassword

    if (!profile.private_key && !password) {
      password = await this.promptForPassword(profile, '输入 SSH 密码后继续连接')
    }

    if (!profile.private_key && !password) {
      throw this.createCancelledError()
    }

    try {
      await this.startConnection(
        this.buildAuthRequest(connectionId, profile, password, profileId),
      )
      await this.persistPasswordIfNeeded(profile, password)
      return password
    } catch (error) {
      if (!this.isAuthenticationError(error) || profile.private_key) {
        throw error
      }

      const retryPassword = await this.promptForPassword(profile, '认证失败，请重新输入 SSH 密码')
      if (!retryPassword) {
        throw this.createCancelledError()
      }

      await this.startConnection(
        this.buildAuthRequest(connectionId, profile, retryPassword, profileId),
      )
      await this.persistPasswordIfNeeded(profile, retryPassword)
      return retryPassword
    }
  }

  async launchProfile(profile: SshProfile): Promise<ConnectionTab> {
    const id = `ssh-${Date.now()}`
    const title = this.getConnectionTabTitle(profile)

    try {
      const resolvedPassword = await this.openSavedProfile(id, profile)
      return this.buildConnectionTab(id, title, profile, resolvedPassword)
    } catch (error) {
      if (this.isUserCancelledError(error)) {
        throw error
      }
      console.error('SSH连接失败:', error)
      throw this.formatSshError(error, profile)
    }
  }

  createPendingProfileTab(
    profile: SshProfile,
    connectionId = `ssh-${Date.now()}`,
  ): ConnectionTab {
    const title = this.getConnectionTabTitle(profile)
    return this.buildConnectionTab(connectionId, title, profile, null, 'connecting')
  }

  async openSavedProfile(connectionId: string, profile: SshProfile): Promise<string | null> {
    const password = await this.resolvePasswordForProfile(profile)
    return this.connectProfile(connectionId, profile, password, profile.id)
  }

  async createSshConnection(sshData: SshConnectionPayload): Promise<ConnectionTab> {
    const id = `ssh-${Date.now()}`
    const profile: SshProfile = {
      id,
      host: sshData.host,
      port: Number(sshData.port) || 22,
      username: sshData.username,
      save_password: sshData.savePassword,
      name: sshData.name,
      group: sshData.group,
      tags: sshData.tags || [],
      private_key: sshData.usePrivateKey ? sshData.privateKey : null,
    }
    const title = this.getConnectionTabTitle(profile)

    const initialPassword = sshData.usePrivateKey ? null : (sshData.password || null)

    if (sshData.savePassword) {
      try {
        await invoke('save_ssh_profile', {
          profile,
          password: sshData.password,
        })
      } catch (e) {
        console.error('保存SSH配置失败:', e)
      }
    }

    try {
      const resolvedPassword = await this.connectProfile(
        id,
        profile,
        initialPassword,
        sshData.id || null,
      )
      return this.buildConnectionTab(id, title, profile, resolvedPassword)
    } catch (error) {
      if (this.isUserCancelledError(error)) {
        throw error
      }
      console.error('SSH连接失败:', error)
      throw this.formatSshError(error, {
        host: sshData.host,
        port: Number(sshData.port) || 22,
        username: sshData.username,
      })
    }
  }

  async getProfiles(): Promise<SshProfile[]> {
    try {
      return await invoke<SshProfile[]>('list_ssh_profiles')
    } catch (e) {
      console.error('获取SSH配置列表失败:', e)
      return []
    }
  }

  async getGroups(): Promise<string[]> {
    try {
      return await invoke<string[]>('list_ssh_groups')
    } catch (e) {
      console.error('获取SSH分组列表失败:', e)
      return []
    }
  }

  async createGroup(groupName: string): Promise<string[]> {
    return invoke<string[]>('create_ssh_group', { groupName })
  }

  async renameGroup(oldName: string, newName: string): Promise<string[]> {
    return invoke<string[]>('rename_ssh_group', { oldName, newName })
  }

  async deleteGroup(groupName: string): Promise<string[]> {
    return invoke<string[]>('delete_ssh_group', { groupName })
  }

  async updateProfile(profileData: SshConnectionPayload & { id: string }): Promise<void> {
    try {
      const profile: SshProfile = {
        id: profileData.id,
        name: profileData.name,
        host: profileData.host,
        port: Number(profileData.port) || 22,
        username: profileData.username,
        save_password: profileData.savePassword,
        group: profileData.group,
        tags: profileData.tags || [],
        private_key: profileData.usePrivateKey ? profileData.privateKey : null,
      }

      await invoke('save_ssh_profile', {
        profile,
        password: profileData.password || null,
      })
    } catch (e) {
      console.error('更新SSH配置失败:', e)
      throw e
    }
  }

  async closeConnection(id: string): Promise<void> {
    try {
      await invoke('disconnect_ssh_connection', { connectionId: id })
    } catch (e) {
      if (String(e).includes('SSH连接不存在') || String(e).includes('未找到')) {
        console.log('SSH连接不存在或已关闭:', id)
      } else {
        console.error('关闭SSH连接失败:', e)
      }
    }
  }

  async reconnect(id: string, profile: SshProfile): Promise<void> {
    try {
      try {
        await invoke('disconnect_ssh_connection', { connectionId: id })
      } catch (e) {
        if (!String(e).includes('SSH连接不存在') && !String(e).includes('未找到')) {
          console.error('关闭旧SSH连接失败:', e)
        }
      }

      const password = await this.resolvePasswordForProfile(profile)
      await this.connectProfile(id, profile, password, profile.id)
    } catch (e) {
      if (this.isUserCancelledError(e)) {
        throw e
      }
      console.error('重新连接SSH失败:', e)
      throw new Error(this.formatSshError(e, profile))
    }
  }

  async writeTerminal(id: string, data: string): Promise<void> {
    try {
      await invoke('write_ssh_terminal', { id, data })
    } catch (e) {
      console.error('向SSH终端写入数据失败:', e)
    }
  }

  async resizeTerminal(id: string, cols: number, rows: number): Promise<void> {
    try {
      await invoke('resize_ssh_terminal', { id, cols, rows })
    } catch (e) {
      console.error('调整SSH终端大小失败:', e)
    }
  }

  async readTerminalSnapshot(id: string, fromSeq = 0): Promise<SshTerminalSnapshot> {
    return invoke<SshTerminalSnapshot>('read_ssh_terminal_snapshot', { id, fromSeq })
  }

  async executeCommand(id: string, command: string): Promise<string> {
    return invoke<string>('execute_ssh_command', { connectionId: id, command })
  }

  formatSshError(
    error: unknown,
    profile: Pick<SshProfile, 'host' | 'port' | 'username'>
  ): string {
    const errorStr = String(error).toLowerCase()
    const hostInfo = `${profile.username}@${profile.host}:${profile.port}`

    if (errorStr.includes('connection refused') || errorStr.includes('拒绝连接')) {
      return `连接被拒绝 (${hostInfo})\n请检查：\n1. 主机地址和端口是否正确\n2. SSH服务是否运行\n3. 防火墙设置`
    }

    if (errorStr.includes('timeout') || errorStr.includes('超时')) {
      return `连接超时 (${hostInfo})\n请检查：\n1. 网络连接是否正常\n2. 主机地址是否可达\n3. 端口是否正确`
    }

    if (errorStr.includes('authentication') || errorStr.includes('认证') || errorStr.includes('密码') || errorStr.includes('password')) {
      return `认证失败 (${hostInfo})\n请检查：\n1. 用户名是否正确\n2. 密码是否正确\n3. 私钥文件是否有效`
    }

    if (errorStr.includes('host key') || errorStr.includes('主机密钥')) {
      return `主机密钥验证失败 (${hostInfo})\n请检查：\n1. 主机密钥是否已更改\n2. 是否为第一次连接此主机`
    }

    if (errorStr.includes('network') || errorStr.includes('网络')) {
      return `网络错误 (${hostInfo})\n请检查网络连接是否正常`
    }

    if (errorStr.includes('permission') || errorStr.includes('权限')) {
      return `权限被拒绝 (${hostInfo})\n请检查用户是否有SSH登录权限`
    }

    return `SSH连接失败 (${hostInfo})\n错误详情: ${String(error)}`
  }
}

export default new SshService()
