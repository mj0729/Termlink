import { invoke } from '@tauri-apps/api/core'
import type {
  ConnectionTab,
  SshPortForward,
  SshConnectionPayload,
  SshProfile,
} from '../types/app'

type SshJumpAuthRequestPayload = {
  host: string
  port: number
  username: string
  password: string | null
  private_key_path: string | null
  passphrase: string | null
  strict_host_key_checking: boolean
}

type SshPortForwardPayload = {
  id: string
  type: 'local'
  local_port: number
  remote_host: string
  remote_port: number
  label: string | null
}

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
  proxy_jump: SshJumpAuthRequestPayload | null
  port_forwards: SshPortForwardPayload[]
}

export type HostKeyVerification = {
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

export type SshHostKeyDecision = 'trust-and-save' | 'trust-once' | 'reject'

export type SshConnectionInteractions = {
  requestPassword?: (
    profile: Pick<SshProfile, 'host' | 'port' | 'username'>,
    options: { title: string },
  ) => Promise<string | null>
  confirmHostKey?: (verification: HostKeyVerification) => Promise<SshHostKeyDecision>
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

  async requestPassword(
    profile: Pick<SshProfile, 'host' | 'port' | 'username'>,
    interactions?: SshConnectionInteractions,
    title = '输入 SSH 密码',
  ): Promise<string | null> {
    if (!interactions?.requestPassword) {
      return null
    }

    return interactions.requestPassword(profile, { title })
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
    proxyJump: SshJumpAuthRequestPayload | null = null,
    portForwards: SshPortForwardPayload[] = [],
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
      proxy_jump: proxyJump,
      port_forwards: portForwards,
    }
  }

  normalizePortForwards(portForwards: SshPortForward[] | undefined): SshPortForwardPayload[] {
    return (portForwards || [])
      .filter((item) => item.type === 'local' && item.localPort && item.remoteHost && item.remotePort)
      .map((item) => ({
        id: item.id,
        type: 'local',
        local_port: Number(item.localPort),
        remote_host: item.remoteHost,
        remote_port: Number(item.remotePort),
        label: item.label || null,
      }))
  }

  async resolveProxyJumpAuth(profile: SshProfile): Promise<SshJumpAuthRequestPayload | null> {
    if (!profile.proxy_jump_host || !profile.proxy_jump_username) {
      return null
    }

    let password: string | null = null
    if (profile.proxy_jump_id) {
      try {
        password = await invoke<string | null>('get_ssh_password', { id: profile.proxy_jump_id })
      } catch (error) {
        console.warn('获取跳板机密码失败:', error)
      }
    }

    return {
      host: profile.proxy_jump_host,
      port: profile.proxy_jump_port || 22,
      username: profile.proxy_jump_username,
      password,
      private_key_path: profile.proxy_jump_private_key || null,
      passphrase: null,
      strict_host_key_checking: true,
    }
  }

  async startConnection(
    auth: SshAuthRequestPayload,
    interactions?: SshConnectionInteractions,
  ): Promise<void> {
    try {
      await invoke('start_ssh_terminal', {
        auth,
        ...this.defaultTerminalSize,
      })
    } catch (error) {
      if (!this.isHostKeyConfirmationError(error)) {
        throw error
      }

      const resolvedAuth = await this.resolveHostKeyTrust(auth, interactions)
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
    interactions?: SshConnectionInteractions,
    verification?: HostKeyVerification,
  ): Promise<SshAuthRequestPayload> {
    const resolvedVerification = verification ?? await invoke<HostKeyVerification>('preview_ssh_host_key', {
      request: auth,
    })

    if (!resolvedVerification.requires_user_confirmation) {
      return auth
    }

    if (!interactions?.confirmHostKey) {
      throw new Error('缺少主机密钥确认处理器')
    }

    const action = await interactions.confirmHostKey(resolvedVerification)

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
    interactions?: SshConnectionInteractions,
  ): Promise<string | null> {
    let password = profile.private_key ? null : initialPassword

    if (!profile.private_key && !password) {
      password = await this.requestPassword(profile, interactions, '输入 SSH 密码后继续连接')
    }

    if (!profile.private_key && !password) {
      throw this.createCancelledError()
    }

    const proxyJump = await this.resolveProxyJumpAuth(profile)
    const portForwards = this.normalizePortForwards(profile.port_forwards)

    try {
      await this.startConnection(
        this.buildAuthRequest(connectionId, profile, password, profileId, proxyJump, portForwards),
        interactions,
      )
      await this.persistPasswordIfNeeded(profile, password)
      return password
    } catch (error) {
      if (!this.isAuthenticationError(error) || profile.private_key) {
        throw error
      }

      const retryPassword = await this.requestPassword(profile, interactions, '认证失败，请重新输入 SSH 密码')
      if (!retryPassword) {
        throw this.createCancelledError()
      }

      await this.startConnection(
        this.buildAuthRequest(connectionId, profile, retryPassword, profileId, proxyJump, portForwards),
        interactions,
      )
      await this.persistPasswordIfNeeded(profile, retryPassword)
      return retryPassword
    }
  }

  async launchProfile(profile: SshProfile, interactions?: SshConnectionInteractions): Promise<ConnectionTab> {
    const id = `ssh-${Date.now()}`
    const title = this.getConnectionTabTitle(profile)

    try {
      const resolvedPassword = await this.openSavedProfile(id, profile, interactions)
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

  async openSavedProfile(
    connectionId: string,
    profile: SshProfile,
    interactions?: SshConnectionInteractions,
  ): Promise<string | null> {
    const password = await this.resolvePasswordForProfile(profile)
    return this.connectProfile(connectionId, profile, password, profile.id, interactions)
  }

  async createSshConnection(
    sshData: SshConnectionPayload,
    interactions?: SshConnectionInteractions,
  ): Promise<ConnectionTab> {
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
      proxy_jump_id: sshData.proxyJumpId || null,
      proxy_jump_name: sshData.proxyJumpName || null,
      proxy_jump_host: sshData.proxyJumpHost || null,
      proxy_jump_port: sshData.proxyJumpPort ? Number(sshData.proxyJumpPort) : null,
      proxy_jump_username: sshData.proxyJumpUsername || null,
      proxy_jump_private_key: sshData.proxyJumpPrivateKey || null,
      ssh_config_source: sshData.sshConfigSource || null,
      ssh_config_host: sshData.sshConfigHost || null,
      port_forwards: sshData.portForwards || [],
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
        interactions,
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
        proxy_jump_id: profileData.proxyJumpId || null,
        proxy_jump_name: profileData.proxyJumpName || null,
        proxy_jump_host: profileData.proxyJumpHost || null,
        proxy_jump_port: profileData.proxyJumpPort ? Number(profileData.proxyJumpPort) : null,
        proxy_jump_username: profileData.proxyJumpUsername || null,
        proxy_jump_private_key: profileData.proxyJumpPrivateKey || null,
        ssh_config_source: profileData.sshConfigSource || null,
        ssh_config_host: profileData.sshConfigHost || null,
        port_forwards: profileData.portForwards || [],
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

  async reconnect(
    id: string,
    profile: SshProfile,
    interactions?: SshConnectionInteractions,
  ): Promise<void> {
    try {
      try {
        await invoke('disconnect_ssh_connection', { connectionId: id })
      } catch (e) {
        if (!String(e).includes('SSH连接不存在') && !String(e).includes('未找到')) {
          console.error('关闭旧SSH连接失败:', e)
        }
      }

      const password = await this.resolvePasswordForProfile(profile)
      await this.connectProfile(id, profile, password, profile.id, interactions)
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
