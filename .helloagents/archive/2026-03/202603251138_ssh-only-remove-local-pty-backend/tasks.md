# 任务清单: ssh_only_remove_local_pty_backend

> **@status:** completed | 2026-03-25 11:41

```yaml
@feature: ssh_only_remove_local_pty_backend
@created: 2026-03-25
@status: completed
@mode: R2
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 3 | 0 | 0 | 3 |

---

## 任务列表

### 1. 后端清理

- [√] 1.1 删除 `src-tauri/src/terminal.rs` 并从 `src-tauri/src/lib.rs` 移除本地 PTY 命令注册 | depends_on: []
- [√] 1.2 删除 `src-tauri/src/ssh.rs` 中失效的 `restart_ssh_connection()` 清理逻辑 | depends_on: [1.1]

### 2. 文档与验证

- [√] 2.1 更新 README、`src/CLAUDE.md`、`src-tauri/CLAUDE.md` 与知识库文档中的本地 PTY 描述 | depends_on: [1.2]
- [√] 2.2 执行 `cargo check --manifest-path src-tauri/Cargo.toml` 与 `pnpm run build` 验证 | depends_on: [2.1]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-25 11:38 | 1.1 / 1.2 | 已完成 | 删除 Rust 本地 PTY 模块、命令注册与失效重连清理逻辑 |
| 2026-03-25 11:39 | 2.1 | 已完成 | README 与前后端 CLAUDE 文档已同步为 SSH-only 描述 |
| 2026-03-25 11:39 | 2.2 | 已完成 | `cargo check` 与 `pnpm run build` 均通过 |

---

## 执行备注

- 当前仓库仍可能保留个别 “PTY” 文字出现在 SSH 伪终端语义里，例如 `request_pty(true, "xterm-256color", ...)`，这属于 SSH shell 申请伪终端，不是本地终端残留。
