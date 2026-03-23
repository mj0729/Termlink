import { invoke } from '@tauri-apps/api/core';
import { normalizeCommandSnippets } from '../utils/commandSnippets.js';
class SshService {
    cancelledMessage = '已取消连接';
    defaultTerminalSize = {
        cols: 80,
        rows: 24,
    };
    async requestPassword(profile, interactions, title = '输入 SSH 密码') {
        if (!interactions?.requestPassword) {
            return null;
        }
        return interactions.requestPassword(profile, { title });
    }
    async requestPassphrase(profile, interactions, title = '输入私钥密码短语', privateKeyPath) {
        if (!interactions?.requestPassphrase) {
            return null;
        }
        return interactions.requestPassphrase(profile, { title, privateKeyPath });
    }
    async resolvePasswordForProfile(profile) {
        if (profile.private_key) {
            return null;
        }
        if (profile.save_password) {
            try {
                const savedPassword = await invoke('get_ssh_password', { id: profile.id });
                if (savedPassword) {
                    return savedPassword;
                }
            }
            catch (e) {
                console.error('获取SSH密码失败:', e);
            }
        }
        return null;
    }
    buildAuthRequest(connectionId, profile, password = null, profileId = null, proxyJump = null, portForwards = [], passphrase = null) {
        return {
            connection_id: connectionId,
            profile_id: profileId,
            host: profile.host,
            port: profile.port || 22,
            username: profile.username,
            password,
            private_key_path: profile.private_key || null,
            passphrase,
            strict_host_key_checking: true,
            proxy_jump: proxyJump,
            port_forwards: portForwards,
        };
    }
    normalizePortForwards(portForwards) {
        return (portForwards || [])
            .filter((item) => item.type === 'local' && item.localPort && item.remoteHost && item.remotePort)
            .map((item) => ({
            id: item.id,
            type: 'local',
            local_port: Number(item.localPort),
            remote_host: item.remoteHost,
            remote_port: Number(item.remotePort),
            label: item.label || null,
        }));
    }
    normalizeNamedCommands(items) {
        return (items || [])
            .map((item) => ({
            ...item,
            name: item.name?.trim() || '',
            command: item.command?.trim() || '',
        }))
            .filter((item) => item.name && item.command);
    }
    normalizeCommandSnippets(items) {
        return normalizeCommandSnippets(items);
    }
    normalizeStartupTasks(items) {
        return this.normalizeNamedCommands(items)
            .map((item) => ({
            ...item,
            enabled: item.enabled !== false,
        }));
    }
    normalizeEnvTemplates(items) {
        return (items || [])
            .map((item) => ({
            ...item,
            key: item.key?.trim() || '',
            value: item.value ?? '',
        }))
            .filter((item) => item.key);
    }
    escapeShellValue(value) {
        return `'${value.replace(/'/g, `'\"'\"'`)}'`;
    }
    buildBootstrapNotice(message, leadingBlankLine = false) {
        const prefix = leadingBlankLine ? '\\n' : '';
        return `printf '${prefix}%s\\n' ${this.escapeShellValue(message)}`;
    }
    buildBootstrapCommands(profile) {
        const commands = [];
        const envTemplates = this.normalizeEnvTemplates(profile.env_templates)
            .filter((envItem) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(envItem.key));
        const enabledTasks = this.normalizeStartupTasks(profile.startup_tasks)
            .filter((task) => task.enabled);
        if (!envTemplates.length && !enabledTasks.length) {
            return commands;
        }
        commands.push(this.buildBootstrapNotice(`[Termlink] 工作流已加载：${envTemplates.length} 个环境变量，${enabledTasks.length} 个启动任务。`, true));
        for (const envItem of envTemplates) {
            commands.push(`export ${envItem.key}=${this.escapeShellValue(envItem.value)}`);
        }
        if (envTemplates.length) {
            commands.push(this.buildBootstrapNotice(`[Termlink] 已注入 ${envTemplates.length} 个主机级环境变量。`));
        }
        if (!enabledTasks.length) {
            commands.push(this.buildBootstrapNotice('[Termlink] 当前没有启用的启动任务。'));
            return commands;
        }
        commands.push('__termlink_bootstrap_failures=0');
        enabledTasks.forEach((task, index) => {
            commands.push(this.buildBootstrapNotice(`[Termlink] 启动任务 ${index + 1}/${enabledTasks.length}: ${task.name}`));
            commands.push(task.command);
            commands.push('__termlink_bootstrap_status=$?');
            commands.push('if [ "$__termlink_bootstrap_status" -ne 0 ]; then');
            commands.push('  __termlink_bootstrap_failures=$((__termlink_bootstrap_failures + 1))');
            commands.push(`  printf '%s\\n' ${this.escapeShellValue(`[Termlink] 启动任务失败: ${task.name}（退出码 `)}"$__termlink_bootstrap_status"${this.escapeShellValue('）')}`);
            commands.push('fi');
        });
        commands.push('if [ "$__termlink_bootstrap_failures" -eq 0 ]; then');
        commands.push(`  ${this.buildBootstrapNotice('[Termlink] 启动任务执行完成。')}`);
        commands.push('else');
        commands.push(`  ${this.buildBootstrapNotice('[Termlink] 启动任务执行结束，但存在失败项，请查看上方输出。')}`);
        commands.push('fi');
        commands.push('unset __termlink_bootstrap_failures');
        commands.push('unset __termlink_bootstrap_status');
        return commands;
    }
    async scheduleProfileBootstrap(connectionId, profile) {
        const commands = this.buildBootstrapCommands(profile);
        if (!commands.length)
            return;
        window.setTimeout(() => {
            this.writeTerminal(connectionId, `${commands.join('\n')}\n`).catch((error) => {
                console.warn('执行连接后启动任务失败:', error);
            });
        }, 180);
    }
    async insertCommandSnippet(connectionId, snippet) {
        const command = typeof snippet === 'string' ? snippet : snippet.command;
        const normalized = command.trim();
        if (!normalized)
            return;
        await this.writeTerminal(connectionId, normalized);
    }
    async sendCommandSnippet(connectionId, snippet) {
        const command = typeof snippet === 'string' ? snippet : snippet.command;
        const normalized = command.trim();
        if (!normalized)
            return;
        await this.writeTerminal(connectionId, `${normalized}\n`);
    }
    async resolveProxyJumpAuth(profile, interactions) {
        if (!profile.proxy_jump_host || !profile.proxy_jump_username) {
            return null;
        }
        let password = null;
        let passphrase = profile.proxy_jump_private_key_passphrase || null;
        if (profile.proxy_jump_id) {
            try {
                password = await invoke('get_ssh_password', { id: profile.proxy_jump_id });
            }
            catch (error) {
                console.warn('获取跳板机密码失败:', error);
            }
        }
        if (profile.proxy_jump_private_key && !passphrase) {
            passphrase = await this.requestPassphrase({
                host: profile.proxy_jump_host,
                port: profile.proxy_jump_port || 22,
                username: profile.proxy_jump_username,
            }, interactions, '跳板机私钥需要密码短语，请输入后继续连接', profile.proxy_jump_private_key);
            if (!passphrase) {
                throw this.createCancelledError();
            }
        }
        return {
            host: profile.proxy_jump_host,
            port: profile.proxy_jump_port || 22,
            username: profile.proxy_jump_username,
            password,
            private_key_path: profile.proxy_jump_private_key || null,
            passphrase,
            strict_host_key_checking: true,
        };
    }
    async startConnection(auth, interactions) {
        try {
            await invoke('start_ssh_terminal', {
                auth,
                ...this.defaultTerminalSize,
            });
        }
        catch (error) {
            if (!this.isHostKeyConfirmationError(error)) {
                throw error;
            }
            const resolvedAuth = await this.resolveHostKeyTrust(auth, interactions);
            await invoke('start_ssh_terminal', {
                auth: resolvedAuth,
                ...this.defaultTerminalSize,
            });
        }
    }
    isHostKeyConfirmationError(error) {
        const text = String(error).toLowerCase();
        return text.includes('主机密钥需要确认') || text.includes('host key');
    }
    isAuthenticationError(error) {
        const text = String(error).toLowerCase();
        return text.includes('认证') || text.includes('authentication') || text.includes('password');
    }
    isPrivateKeyPassphraseError(error) {
        const text = String(error).toLowerCase();
        return text.includes('密码短语')
            || text.includes('passphrase')
            || text.includes('解密私钥失败')
            || text.includes('可能需要密码短语');
    }
    isUserCancelledError(error) {
        return String(error).includes(this.cancelledMessage);
    }
    createCancelledError() {
        return new Error(this.cancelledMessage);
    }
    async resolveHostKeyTrust(auth, interactions, verification) {
        const resolvedVerification = verification ?? await invoke('preview_ssh_host_key', {
            request: auth,
        });
        if (!resolvedVerification.requires_user_confirmation) {
            return auth;
        }
        if (!interactions?.confirmHostKey) {
            throw new Error('缺少主机密钥确认处理器');
        }
        const action = await interactions.confirmHostKey(resolvedVerification);
        if (action === 'reject') {
            throw new Error('用户取消主机密钥确认');
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
            });
        }
        return {
            ...auth,
            strict_host_key_checking: false,
        };
    }
    buildConnectionTab(id, title, profile, autoPassword, sshState = 'connected') {
        return {
            id,
            title,
            type: 'ssh',
            profile,
            sshState,
            lastError: null,
            reconnectAttempt: 0,
            reconnectScheduledAt: null,
            autoPassword,
        };
    }
    getConnectionTabTitle(profile) {
        if (profile.name?.trim()) {
            return profile.name.trim();
        }
        return profile.username ? `${profile.username}@${profile.host}` : profile.host;
    }
    async persistPasswordIfNeeded(profile, password) {
        if (!profile.save_password || profile.private_key || !password) {
            return;
        }
        try {
            await invoke('save_ssh_profile', {
                profile,
                password,
            });
        }
        catch (error) {
            console.warn('回写SSH密码失败，下次可能仍需重新输入:', error);
        }
    }
    async connectProfile(connectionId, profile, initialPassword, profileId, interactions) {
        let password = profile.private_key ? null : initialPassword;
        let passphrase = profile.private_key_passphrase || null;
        if (!profile.private_key && !password) {
            password = await this.requestPassword(profile, interactions, '输入 SSH 密码后继续连接');
        }
        if (!profile.private_key && !password) {
            throw this.createCancelledError();
        }
        let proxyJump = await this.resolveProxyJumpAuth(profile, interactions);
        const portForwards = this.normalizePortForwards(profile.port_forwards);
        try {
            await this.startConnection(this.buildAuthRequest(connectionId, profile, password, profileId, proxyJump, portForwards, passphrase), interactions);
            this.scheduleProfileBootstrap(connectionId, profile);
            await this.persistPasswordIfNeeded(profile, password);
            return password;
        }
        catch (error) {
            if (profile.private_key && this.isPrivateKeyPassphraseError(error)) {
                passphrase = await this.requestPassphrase(profile, interactions, '私钥需要密码短语，请输入后继续连接', profile.private_key || null);
                if (!passphrase) {
                    throw this.createCancelledError();
                }
                await this.startConnection(this.buildAuthRequest(connectionId, profile, password, profileId, proxyJump, portForwards, passphrase), interactions);
                this.scheduleProfileBootstrap(connectionId, profile);
                return password;
            }
            if (!profile.private_key && proxyJump?.private_key_path && this.isPrivateKeyPassphraseError(error)) {
                const retryPassphrase = await this.requestPassphrase({
                    host: proxyJump.host,
                    port: proxyJump.port,
                    username: proxyJump.username,
                }, interactions, '跳板机私钥密码短语错误，请重新输入', proxyJump.private_key_path);
                if (!retryPassphrase) {
                    throw this.createCancelledError();
                }
                proxyJump = {
                    ...proxyJump,
                    passphrase: retryPassphrase,
                };
                await this.startConnection(this.buildAuthRequest(connectionId, profile, password, profileId, proxyJump, portForwards, passphrase), interactions);
                this.scheduleProfileBootstrap(connectionId, profile);
                return password;
            }
            if (!this.isAuthenticationError(error) || profile.private_key) {
                throw error;
            }
            const retryPassword = await this.requestPassword(profile, interactions, '认证失败，请重新输入 SSH 密码');
            if (!retryPassword) {
                throw this.createCancelledError();
            }
            await this.startConnection(this.buildAuthRequest(connectionId, profile, retryPassword, profileId, proxyJump, portForwards, passphrase), interactions);
            this.scheduleProfileBootstrap(connectionId, profile);
            await this.persistPasswordIfNeeded(profile, retryPassword);
            return retryPassword;
        }
    }
    async launchProfile(profile, interactions) {
        const id = `ssh-${Date.now()}`;
        const title = this.getConnectionTabTitle(profile);
        try {
            const resolvedPassword = await this.openSavedProfile(id, profile, interactions);
            return this.buildConnectionTab(id, title, profile, resolvedPassword);
        }
        catch (error) {
            if (this.isUserCancelledError(error)) {
                throw error;
            }
            console.error('SSH连接失败:', error);
            throw this.formatSshError(error, profile);
        }
    }
    createPendingProfileTab(profile, connectionId = `ssh-${Date.now()}`) {
        const title = this.getConnectionTabTitle(profile);
        return this.buildConnectionTab(connectionId, title, profile, null, 'connecting');
    }
    async openSavedProfile(connectionId, profile, interactions) {
        const password = await this.resolvePasswordForProfile(profile);
        return this.connectProfile(connectionId, profile, password, profile.id, interactions);
    }
    async createSshConnection(sshData, interactions) {
        const id = `ssh-${Date.now()}`;
        const profile = {
            id,
            host: sshData.host,
            port: Number(sshData.port) || 22,
            username: sshData.username,
            save_password: sshData.savePassword,
            name: sshData.name,
            group: sshData.group,
            tags: sshData.tags || [],
            private_key: sshData.usePrivateKey ? sshData.privateKey : null,
            private_key_passphrase: sshData.usePrivateKey ? (sshData.privateKeyPassphrase || null) : null,
            proxy_jump_id: sshData.proxyJumpId || null,
            proxy_jump_name: sshData.proxyJumpName || null,
            proxy_jump_host: sshData.proxyJumpHost || null,
            proxy_jump_port: sshData.proxyJumpPort ? Number(sshData.proxyJumpPort) : null,
            proxy_jump_username: sshData.proxyJumpUsername || null,
            proxy_jump_private_key: sshData.proxyJumpPrivateKey || null,
            proxy_jump_private_key_passphrase: sshData.proxyJumpPrivateKeyPassphrase || null,
            ssh_config_source: sshData.sshConfigSource || null,
            ssh_config_host: sshData.sshConfigHost || null,
            port_forwards: sshData.portForwards || [],
            command_snippets: this.normalizeCommandSnippets(sshData.commandSnippets),
            startup_tasks: this.normalizeStartupTasks(sshData.startupTasks),
            env_templates: this.normalizeEnvTemplates(sshData.envTemplates),
        };
        const title = this.getConnectionTabTitle(profile);
        const initialPassword = sshData.usePrivateKey ? null : (sshData.password || null);
        if (sshData.savePassword) {
            try {
                await invoke('save_ssh_profile', {
                    profile,
                    password: sshData.password,
                });
            }
            catch (e) {
                console.error('保存SSH配置失败:', e);
            }
        }
        try {
            const resolvedPassword = await this.connectProfile(id, profile, initialPassword, sshData.id || null, interactions);
            return this.buildConnectionTab(id, title, profile, resolvedPassword);
        }
        catch (error) {
            if (this.isUserCancelledError(error)) {
                throw error;
            }
            console.error('SSH连接失败:', error);
            throw this.formatSshError(error, {
                host: sshData.host,
                port: Number(sshData.port) || 22,
                username: sshData.username,
            });
        }
    }
    async getProfiles() {
        try {
            return await invoke('list_ssh_profiles');
        }
        catch (e) {
            console.error('获取SSH配置列表失败:', e);
            return [];
        }
    }
    async getGroups() {
        try {
            return await invoke('list_ssh_groups');
        }
        catch (e) {
            console.error('获取SSH分组列表失败:', e);
            return [];
        }
    }
    async createGroup(groupName) {
        return invoke('create_ssh_group', { groupName });
    }
    async renameGroup(oldName, newName) {
        return invoke('rename_ssh_group', { oldName, newName });
    }
    async deleteGroup(groupName) {
        return invoke('delete_ssh_group', { groupName });
    }
    async updateProfile(profileData) {
        try {
            const profile = {
                id: profileData.id,
                name: profileData.name,
                host: profileData.host,
                port: Number(profileData.port) || 22,
                username: profileData.username,
                save_password: profileData.savePassword,
                group: profileData.group,
                tags: profileData.tags || [],
                private_key: profileData.usePrivateKey ? profileData.privateKey : null,
                private_key_passphrase: profileData.usePrivateKey ? (profileData.privateKeyPassphrase || null) : null,
                proxy_jump_id: profileData.proxyJumpId || null,
                proxy_jump_name: profileData.proxyJumpName || null,
                proxy_jump_host: profileData.proxyJumpHost || null,
                proxy_jump_port: profileData.proxyJumpPort ? Number(profileData.proxyJumpPort) : null,
                proxy_jump_username: profileData.proxyJumpUsername || null,
                proxy_jump_private_key: profileData.proxyJumpPrivateKey || null,
                proxy_jump_private_key_passphrase: profileData.proxyJumpPrivateKeyPassphrase || null,
                ssh_config_source: profileData.sshConfigSource || null,
                ssh_config_host: profileData.sshConfigHost || null,
                port_forwards: profileData.portForwards || [],
                command_snippets: this.normalizeCommandSnippets(profileData.commandSnippets),
                startup_tasks: this.normalizeStartupTasks(profileData.startupTasks),
                env_templates: this.normalizeEnvTemplates(profileData.envTemplates),
            };
            await invoke('save_ssh_profile', {
                profile,
                password: profileData.password || null,
            });
        }
        catch (e) {
            console.error('更新SSH配置失败:', e);
            throw e;
        }
    }
    async closeConnection(id) {
        try {
            await invoke('disconnect_ssh_connection', { connectionId: id });
        }
        catch (e) {
            if (String(e).includes('SSH连接不存在') || String(e).includes('未找到')) {
                console.log('SSH连接不存在或已关闭:', id);
            }
            else {
                console.error('关闭SSH连接失败:', e);
            }
        }
    }
    async reconnect(id, profile, interactions) {
        try {
            try {
                await invoke('disconnect_ssh_connection', { connectionId: id });
            }
            catch (e) {
                if (!String(e).includes('SSH连接不存在') && !String(e).includes('未找到')) {
                    console.error('关闭旧SSH连接失败:', e);
                }
            }
            const password = await this.resolvePasswordForProfile(profile);
            await this.connectProfile(id, profile, password, profile.id, interactions);
        }
        catch (e) {
            if (this.isUserCancelledError(e)) {
                throw e;
            }
            console.error('重新连接SSH失败:', e);
            throw new Error(this.formatSshError(e, profile));
        }
    }
    async writeTerminal(id, data) {
        try {
            await invoke('write_ssh_terminal', { id, data });
        }
        catch (e) {
            console.error('向SSH终端写入数据失败:', e);
        }
    }
    async resizeTerminal(id, cols, rows) {
        try {
            await invoke('resize_ssh_terminal', { id, cols, rows });
        }
        catch (e) {
            console.error('调整SSH终端大小失败:', e);
        }
    }
    async readTerminalSnapshot(id, fromSeq = 0) {
        return invoke('read_ssh_terminal_snapshot', { id, fromSeq });
    }
    async executeCommand(id, command) {
        return invoke('execute_ssh_command', { connectionId: id, command });
    }
    formatSshError(error, profile) {
        const errorStr = String(error).toLowerCase();
        const hostInfo = `${profile.username}@${profile.host}:${profile.port}`;
        if (errorStr.includes('connection refused') || errorStr.includes('拒绝连接')) {
            return `连接被拒绝 (${hostInfo})\n请检查：\n1. 主机地址和端口是否正确\n2. SSH服务是否运行\n3. 防火墙设置`;
        }
        if (errorStr.includes('no route to host') || errorStr.includes('network is unreachable') || errorStr.includes('无法访问')) {
            return `目标主机不可达 (${hostInfo})\n请检查：\n1. 网络是否连通\n2. 主机地址是否正确\n3. 路由或安全组是否放行`;
        }
        if (errorStr.includes('name or service not known') || errorStr.includes('failed to lookup address information') || errorStr.includes('dns')) {
            return `主机名解析失败 (${hostInfo})\n请检查：\n1. 主机名是否正确\n2. DNS 配置是否正常\n3. 是否需要改用 IP 直连`;
        }
        if (errorStr.includes('timeout') || errorStr.includes('超时')) {
            return `连接超时 (${hostInfo})\n请检查：\n1. 网络连接是否正常\n2. 主机地址是否可达\n3. 端口是否正确`;
        }
        if (errorStr.includes('authentication') || errorStr.includes('认证') || errorStr.includes('密码') || errorStr.includes('password')) {
            return `认证失败 (${hostInfo})\n请检查：\n1. 用户名是否正确\n2. 密码是否正确\n3. 私钥文件是否有效`;
        }
        if (errorStr.includes('密码短语') || errorStr.includes('passphrase') || errorStr.includes('解密私钥失败')) {
            return `私钥密码短语无效 (${hostInfo})\n请检查：\n1. 私钥是否需要密码短语\n2. 输入的密码短语是否正确\n3. 私钥文件是否损坏`;
        }
        if (errorStr.includes('私钥认证失败') || errorStr.includes('private key')) {
            return `私钥认证失败 (${hostInfo})\n请检查：\n1. 私钥是否与当前用户名匹配\n2. 私钥格式是否受支持\n3. 如私钥已加密，请重新输入密码短语`;
        }
        if (errorStr.includes('host key') || errorStr.includes('主机密钥')) {
            return `主机密钥验证失败 (${hostInfo})\n请检查：\n1. 主机密钥是否已更改\n2. 是否为第一次连接此主机`;
        }
        if (errorStr.includes('broken pipe') || errorStr.includes('connection reset') || errorStr.includes('connection closed') || errorStr.includes('channel closed') || errorStr.includes('断开')) {
            return `连接已断开 (${hostInfo})\n请检查：\n1. 远端会话是否被关闭\n2. 网络是否稳定\n3. 服务器是否主动断开了连接`;
        }
        if (errorStr.includes('network') || errorStr.includes('网络')) {
            return `网络错误 (${hostInfo})\n请检查网络连接是否正常`;
        }
        if (errorStr.includes('permission') || errorStr.includes('权限')) {
            return `权限被拒绝 (${hostInfo})\n请检查用户是否有SSH登录权限`;
        }
        return `SSH连接失败 (${hostInfo})\n错误详情: ${String(error)}`;
    }
}
export default new SshService();
