# 方案包：connection-manager-actor-refactor

- 创建时间：2026-03-18 15:03
- 类型：implementation
- 路由级别：R3
- 执行模式：INTERACTIVE

## 1. 需求

### 背景

当前 SSH 终端、SFTP 与系统监控分别维护独立连接池，导致同一主机重复建连、生命周期互相误伤、监控持锁阻塞其他操作，以及前端 SFTP 连接 ID 与真实 SSH 连接 ID 脱节。

### 目标

- 为每个 SSH 连接引入单一 `ConnectionManager` actor。
- 全局仅维护 `connection_id -> Sender<ConnectionCmd>` 的注册表。
- 终端写入/缩放、SFTP 打开/关闭、命令执行、完全断开全部通过 manager 转发。
- 前端统一使用 `connection_id`，移除 `sftp-${id}` 分支和 2 秒“稳定等待”。

### 约束条件

- 保持现有 Tauri + Vue 调用链可用，避免回滚工作区现有未提交改动。
- 不引入新的架构层或多余兼容包装。
- 优先解决生命周期统一和重复建连问题，再做最小范围的前端同步。

### 验收标准

- 同一 SSH 标签页只建立一条底层 transport 连接。
- SFTP 文件操作与监控命令均复用同一连接 manager。
- 关闭 SSH 标签页时走“完全断开”；单独关闭 terminal channel 不会误杀 SFTP。
- 前端不再依赖 `sftp-${id}` 或固定 2 秒等待。
- `cargo check --manifest-path src-tauri/Cargo.toml` 与 `pnpm run build` 通过。

## 2. 方案

### 技术方案

1. 新增 `src-tauri/src/connection_manager.rs`
   - 持有认证后的 `russh::client::Handle<Client>`
   - 维护 terminal channel、可复用的 `Arc<SftpSession>`、连接状态
   - 暴露 `start_connection`、`write_terminal`、`resize_terminal`、`close_terminal`、`open_sftp`、`close_sftp`、`execute_command`、`disconnect_connection`
2. 将现有模块改为薄适配层
   - `ssh_terminal_russh.rs` 仅负责 host key 相关 command 和 terminal command 转发
   - `sftp_russh.rs` 删除独立连接池，改为每次从 manager 获取/确保 SFTP session
   - `ssh_command.rs` 删除监控独立连接池，直接转发执行命令
3. 前端统一连接身份
   - `SshService.ts` 启动 SSH 后立即打开同连接的 SFTP，不再等待 2 秒
   - SSH 标签页直接使用 `connection_id`
   - 监控面板不再显式建立/断开专用监控连接

### 影响范围

- Rust: `connection_manager.rs`、`ssh_terminal_russh.rs`、`sftp_russh.rs`、`ssh_command.rs`、`lib.rs`
- Vue/TS: `SshService.ts`、`App.vue`、`RightPanel.vue`、`types/app.ts`
- 知识库：方案包、CHANGELOG

### 风险评估

- `russh` channel 生命周期与 actor 循环耦合较深，需避免 terminal 关闭时误断 transport。
- SFTP session 改为从 manager 获取后，文件操作链路全部依赖 manager 可用性，需要统一错误提示。
- 工作区已有未提交改动，必须只在相关区域上做增量修改。

## 3. 核心场景

- SSH 终端启动后立即可打开远程文件树，无需再等“连接稳定”。
- 监控面板批量命令与 SFTP 下载可并发运行，不受额外监控连接池影响。
- 关闭 SSH 标签页时触发一次完整断开；关闭 terminal channel 时不直接杀掉 SFTP session。

## 4. 技术决策

- `connection-manager-actor-refactor#D001`：采用单 actor 收口，而不是保留三套 facade 共享 transport。
  - 原因：本次问题的根因是生命周期碎片化，继续保留多池只会把复杂度转移到跨模块同步逻辑。
