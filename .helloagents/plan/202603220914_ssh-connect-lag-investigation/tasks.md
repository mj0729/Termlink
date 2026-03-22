# 任务清单: ssh-connect-lag-investigation

```yaml
@feature: ssh-connect-lag-investigation
@created: 2026-03-22
@status: completed
@mode: R2
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 4 | 0 | 0 | 4 |

---

## 任务列表

### 1. 前端连接态优化

- [√] 1.1 在 `src/App.vue` 与 `src/services/SshService.ts` 中让连接中心点击后先创建 `connecting` SSH 标签，再异步完成建连 | depends_on: []
- [√] 1.2 在 `src/components/Terminal.vue`、`src/components/RemoteFileWorkbench.vue`、`src/components/TabManager.vue`、`src/components/SshWorkspace.vue` 中补齐 `connecting` 状态的显示与守卫逻辑 | depends_on: [1.1]

### 2. Rust 建连链路优化

- [√] 2.1 在 `src-tauri/src/ssh_auth.rs` 中把 host key 校验合并到正式 SSH 握手，移除已信任主机的重复 preview 握手 | depends_on: []
- [√] 2.2 为 host key 确认流程增加 pending verification 缓存，并完成前后端构建验证 | depends_on: [2.1]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-22 09:14:00 | 1.1 | completed | `App.vue` 先开 tab、`SshService` 补充 pending tab 与 saved profile 异步建连接口 |
| 2026-03-22 09:16:00 | 1.2 | completed | `Terminal`/`RemoteFileWorkbench`/`TabManager`/`SshWorkspace` 支持 `connecting` 三态 |
| 2026-03-22 09:18:00 | 2.1 | completed | `ssh_auth.rs` 改为在 `check_server_key` 中直接校验，避免已信任主机重复握手 |
| 2026-03-22 09:19:00 | 2.2 | completed | `pnpm run build` 与 `cargo check --manifest-path src-tauri/Cargo.toml` 均通过 |

---

## 执行备注

- 本轮没有关闭 host key 校验，而是把校验并入正式握手，因此属于“保安全的性能优化”。
- `preview_ssh_host_key` 仍保留，作为未知/变更主机密钥时的前端确认入口，但会优先复用本次握手缓存结果。
