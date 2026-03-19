# SSH 安全修复与连接复用实施计划

## 执行策略

采用**分阶段渐进式**实施:
- **阶段 1**: 共享认证层和安全修复 (优先级最高)
- **阶段 2**: 连接复用重构
- **阶段 3**: 测试框架建设

## 阶段 1: 共享认证层和安全修复

### 目标
修复三条 SSH 链路的安全漏洞,实现主机密钥验证和私钥认证支持。

### 新增模块

#### 1. `src-tauri/src/host_key_store.rs`
主机密钥信任存储层,管理应用内主机密钥记录。

**核心数据结构**:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostKeyRecord {
    pub host: String,
    pub port: u16,
    pub algorithm: String,
    pub fingerprint_sha256: String,
    pub public_key_base64: String,
    pub first_seen_at: String,
    pub last_seen_at: String,
    pub trust_source: String,
    pub profile_id: Option<String>,
}
```

**核心函数**:
- `host_keys_path(app: &AppHandle) -> Result<PathBuf, String>`
- `load_host_key_records(app: &AppHandle) -> Result<Vec<HostKeyRecord>, String>`
- `find_host_key_record(app, host, port, algorithm) -> Result<Option<HostKeyRecord>, String>`
- `upsert_host_key_record(app, record) -> Result<(), String>`
- `remove_host_key_record(app, host, port, algorithm) -> Result<(), String>`

**存储位置**: `ProjectDirs::config_dir()/host_keys.json`

#### 2. `src-tauri/src/ssh_auth.rs`
共享认证层,统一处理主机密钥验证和认证逻辑。

**核心数据结构**:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshAuthRequest {
    pub connection_id: String,
    pub profile_id: Option<String>,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: Option<String>,
    pub private_key_path: Option<String>,
    pub passphrase: Option<String>,
    pub strict_host_key_checking: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostKeyVerification {
    pub state: HostKeyTrustState,
    pub presented: HostKeyIdentity,
    pub stored: Option<HostKeyRecord>,
    pub requires_user_confirmation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HostKeyTrustState {
    Trusted,
    Unknown,
    Changed,
    Revoked,
}
```

**核心函数**:
- `preview_host_key(app, request) -> Result<HostKeyVerification, String>`
- `save_host_key_decision(app, decision) -> Result<(), String>`
- `connect_authenticated_session(app, request) -> Result<Handle<Client>, String>`
- `authenticate_session(session, request) -> Result<AuthMethod, String>`
- `load_keypair(path, passphrase) -> Result<KeyPair, String>`

### 修改模块

#### 3. `src-tauri/src/ssh_terminal_russh.rs`
- 删除 `check_server_key()` 中的无条件 `true` 返回
- 改用 `ssh_auth::connect_authenticated_session()`
- 修改 `start_ssh_terminal()` 签名,接受 `SshAuthRequest`

#### 4. `src-tauri/src/sftp_russh.rs`
- 删除 `check_server_key()` 中的无条件 `true` 返回
- 改用 `ssh_auth::connect_authenticated_session()`
- 修改 `connect_sftp()` 签名,接受 `SshAuthRequest`

#### 5. `src-tauri/src/ssh_command.rs`
- 删除 `check_server_key()` 中的无条件 `true` 返回
- 改用 `ssh_auth::connect_authenticated_session()`
- 修改 `connect_ssh_for_monitoring()` 签名,接受 `SshAuthRequest`

#### 6. `src-tauri/src/lib.rs`
注册新增的 Tauri 命令:
- `preview_ssh_host_key`
- `save_ssh_host_key_decision`

#### 7. `src/types/app.ts`
新增 TypeScript 类型定义:
```typescript
export type HostKeyTrustState = 'trusted' | 'unknown' | 'changed' | 'revoked'

export interface HostKeyIdentity {
  host: string
  port: number
  algorithm: string
  fingerprintSha256: string
  publicKeyBase64: string
}

export interface HostKeyVerificationResult {
  state: HostKeyTrustState
  presented: HostKeyIdentity
  stored?: HostKeyIdentity | null
  requiresUserConfirmation: boolean
}

export interface SshAuthPayload {
  host: string
  port: number
  username: string
  password?: string | null
  privateKeyPath?: string | null
  passphrase?: string | null
  profileId?: string | null
}
```

#### 8. `src/services/SshService.ts`
新增方法:
- `previewHostKey(auth: SshAuthPayload): Promise<HostKeyVerificationResult>`
- `confirmHostKey(decision: HostKeyDecisionPayload): Promise<void>`

修改方法:
- `startTerminal()`: 在连接前先预览主机密钥,未知/变更时弹窗确认
- `establishSftpConnection()`: 使用新的认证流程

#### 9. `src/components/SshModal.vue`
- 新增私钥路径选择 (使用 Tauri Dialog 插件)
- 新增密码短语输入框
- 修改提交逻辑,构造完整的 `SshAuthPayload`

### 验收标准

- [ ] 未知主机首次连接必须显式确认
- [ ] 主机密钥变更必须阻止连接并提示风险
- [ ] 密码认证可正常工作
- [ ] RSA 私钥认证可正常工作
- [ ] Ed25519 私钥认证可正常工作
- [ ] 加密私钥 (带密码短语) 可正常工作
- [ ] 终端、SFTP、监控三条路径行为一致

---

## 阶段 2: 连接复用重构

### 目标
实现 SSH session 复用,减少重复握手,统一信任状态。

### 核心改造

#### 1. Session 管理
新增 `ssh_session_manager.rs` 或在 `ssh_terminal_russh.rs` 内实现:
```rust
pub struct SharedSshSession {
    pub session: Arc<tokio::sync::Mutex<Handle<Client>>>,
    pub auth: SshAuthRequest,
    pub verified_host_key: HostKeyIdentity,
    pub created_at: Instant,
    pub last_used_at: Instant,
}
```

#### 2. 实现 `create_sftp_from_ssh()`
从已存在的 SSH session 打开 SFTP subsystem:
- 从共享 session 打开新 channel
- 请求 `sftp` subsystem
- 包装成 `SftpSession`

#### 3. 系统监控复用
- `connect_ssh_for_monitoring()` 改为附加到现有 session
- 优先复用 terminal session

#### 4. 生命周期管理
- 为每个 `connection_id` 建立引用计数或 lease
- 终端关闭时检查是否有 SFTP/监控租约
- 最后一个租约释放时销毁 session

### 验收标准

- [ ] 终端、SFTP、监控共用同一 SSH 信任状态
- [ ] 同一连接不再出现重复 host key 确认
- [ ] 重连、关闭、异常断开后资源可正确回收

---

## 阶段 3: 测试框架建设

### 前端测试

#### 1. 配置 Vitest
新增 `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

#### 2. 单元测试
- `src/services/__tests__/SshService.test.ts`
  - host key 预检
  - 用户确认分支
  - 密码/私钥 payload 组装
- `src/services/__tests__/SftpService.test.ts`
  - `invoke` 参数映射
  - 文件过滤
- `src/services/__tests__/ThemeService.test.ts`
  - 主题切换
  - 终端配置更新

### 后端测试

#### 1. 单元测试
在各模块添加 `#[cfg(test)]` 模块:
- `host_key_store.rs`: 记录 CRUD
- `ssh_auth.rs`: 指纹生成、信任状态判断
- `system_monitor.rs`: 解析函数
- `fs.rs`: 文件枚举、排序
- `ssh.rs`: 序列化/反序列化

#### 2. 集成测试
使用 `tauri::test` 构建命令级测试:
- host key 预检命令
- 保存决策命令
- session 生命周期

### 验收标准

- [ ] 前端核心服务单元测试覆盖关键分支
- [ ] Rust 纯函数与存储逻辑具备稳定单测
- [ ] session 复用相关至少有一组集成测试

---

## 实施优先级

### 阶段 1 (按顺序执行)
1. `host_key_store.rs` - 基础设施
2. `ssh_auth.rs` - 共享认证层
3. `ssh_terminal_russh.rs` - 终端连接
4. `sftp_russh.rs` - SFTP 连接
5. `ssh_command.rs` - 系统监控
6. `src/types/app.ts` - TypeScript 类型
7. `SshService.ts` - 前端服务
8. `SshModal.vue` - UI 组件
9. `SftpService.ts` - SFTP 服务

### 阶段 2 (阶段 1 完成后)
1. Session 管理器
2. `create_sftp_from_ssh()`
3. 监控复用
4. 生命周期管理

### 阶段 3 (并行或最后)
1. Vitest 配置
2. 前端单元测试
3. Rust 单元测试
4. 集成测试

---

## 关键风险与缓解措施

### 风险 1: 只修复部分链路
**风险**: 只修复终端和 SFTP,不修监控,仍存在 MITM 入口
**缓解**: 必须同步修复三条链路

### 风险 2: 私钥路径不可用
**风险**: 前端继续传 `file.name` 而非绝对路径
**缓解**: 使用 Tauri Dialog 插件获取绝对路径

### 风险 3: 主机密钥存储键错误
**风险**: 存储键不包含算法和端口,产生错误匹配
**缓解**: 使用 `host + port + algorithm` 作为复合键

### 风险 4: Session 生命周期管理
**风险**: 阶段 2 未建立租约/引用计数,出现悬垂句柄
**缓解**: 实现引用计数或 lease 机制

---

## 参考文档

- 完整蓝图: `docs/ssh-connection-reuse-blueprint.md`
- Vitest: https://vitest.dev/guide/
- Tauri Dialog: https://v2.tauri.app/plugin/dialog/
- russh: https://docs.rs/russh/0.40.2/
- russh-keys: https://docs.rs/russh-keys/0.40.1/
