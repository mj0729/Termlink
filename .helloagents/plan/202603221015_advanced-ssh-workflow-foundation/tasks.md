# 任务清单: advanced-ssh-workflow-foundation

```yaml
@feature: advanced-ssh-workflow-foundation
@created: 2026-03-22
@status: completed
@mode: R3
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 10 | 0 | 0 | 10 |

---

## 任务列表

### 1. 连接模型与高级 SSH 配置

- [√] 1.1 在 `src/types/app.ts`、`src/components/SshModal.vue`、`src/services/SshService.ts` 中扩展 SSH 配置模型，支持 `ProxyJump`、端口转发与 `SSH config` 来源字段 | depends_on: []
- [√] 1.2 在 `src-tauri/src/connection_store.rs`、`src-tauri/src/ssh.rs`、`src-tauri/src/import_export.rs` 中同步新的 profile 存储与导入导出结构 | depends_on: [1.1]

### 2. SSH config 导入链路

- [√] 2.1 在 `src-tauri/src/fs.rs` 或新增命令中实现本地 `~/.ssh/config` 读取与解析能力，并暴露给前端 | depends_on: [1.2]
- [√] 2.2 在 `src/components/SettingsModal.vue` 或连接入口中接入 `SSH config` 导入交互，并将导入结果写回现有连接体系 | depends_on: [2.1]

### 3. ProxyJump 与端口转发运行时

- [√] 3.1 在 `src-tauri/src/ssh_auth.rs`、`src-tauri/src/connection_manager.rs`、`src-tauri/src/ssh_terminal_russh.rs` 中实现基于跳板机的 SSH 建连路径 | depends_on: [1.2]
- [√] 3.2 在 Rust 侧实现本地端口转发的生命周期管理，并在前端工作区中提供可见状态与控制入口 | depends_on: [3.1]

### 4. 分屏与会话编组

- [√] 4.1 在 `src/App.vue`、`src/components/SshWorkspace.vue`、`src/components/Terminal.vue` 中引入 pane 布局状态，支持 SSH 工作区分屏 | depends_on: [1.1]
- [√] 4.2 在 `src/App.vue`、`src/components/SshWorkspace.vue`、`src/services/SshService.ts` 中实现会话组与广播输入逻辑，默认显式开启广播 | depends_on: [4.1]

### 5. 完成度补强与验证

- [√] 5.1 在 `src-tauri/src/download_manager.rs`、相关前端调用点中替换为真实系统文件选择器 | depends_on: []
- [√] 5.2 优化启动/首屏资源加载并补充关键路径回归验证，至少覆盖高级 SSH、分屏广播与真实文件选择器调用 | depends_on: [2.2, 3.2, 4.2, 5.1]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-22 10:15:00 | design | completed | 已选择方案 A，创建实施方案包并进入开发实施 |
| 2026-03-22 10:28:00 | 1.1 / 1.2 | completed | 扩展前端/后端 SSH profile 字段，补齐 ProxyJump、端口转发、SSH config 来源存储 |
| 2026-03-22 10:36:00 | 2.1 / 2.2 | completed | 新增默认 `~/.ssh/config` 读取命令，并在设置中接入导入流程 |
| 2026-03-22 10:47:00 | 4.1 / 4.2 | completed | SSH 工作区支持分屏 pane 和广播输入，广播默认显式开启 |
| 2026-03-22 10:54:00 | 3.2 / 5.1 | completed | 本地端口转发首版接入连接管理器，下载/私钥路径改为真实系统文件选择器 |
| 2026-03-22 11:08:00 | 3.1 | completed | `ProxyJump` 改为通过跳板机会话的 `direct-tcpip` 建立目标 SSH 连接，并在断连时联动回收跳板机会话 |
| 2026-03-22 11:12:00 | 5.2 | completed | 已完成 `SshModal/SettingsModal` 异步加载、Rust 侧 SSH config/文件选择器辅助测试，以及 `pnpm run test:regression` 前端回归脚本 |

---

## 执行备注

- 本轮采用“底座先行”的策略，允许前期改动范围稍大，但后续功能会更稳。
- 广播输入属于高风险效率功能，默认不会自动跟随会话组开启。
- 本方案已完成，后续若继续迭代可优先考虑端口转发 UI 可视化增强和更细粒度的端到端自动化。
