@feature: connection-manager-actor-refactor
@created: 2026-03-18 15:03
@status: completed
@mode: interactive

## 进度概览

- 完成: 4
- 失败: 0
- 跳过: 0
- 总数: 4

## 任务列表

- [√] 1. 新增 `src-tauri/src/connection_manager.rs`，实现单连接 actor 与全局 sender 注册表 | depends_on: []
- [√] 2. 重构 `ssh_terminal_russh.rs`、`sftp_russh.rs`、`ssh_command.rs`、`lib.rs`，全部改为通过 manager 转发 | depends_on: [1]
- [√] 3. 重构 `SshService.ts`、`App.vue`、`RightPanel.vue`，统一前端连接 ID 与时序 | depends_on: [2]
- [√] 4. 运行 Rust 与前端验证，并同步知识库变更记录 | depends_on: [2, 3]

## 执行日志

- 2026-03-18 15:03 创建方案包，确认采用单 actor 收口方案。
- 2026-03-18 15:41 完成后端单连接 actor 收口、前端连接 ID 统一，并通过 `cargo check --manifest-path src-tauri/Cargo.toml` 与 `pnpm run build` 验证。

## 执行备注

- 工作区存在未提交改动，实施时只在本次重构相关区域做增量修改。
