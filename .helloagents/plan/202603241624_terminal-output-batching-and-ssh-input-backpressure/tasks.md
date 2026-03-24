# 任务清单: terminal-output-batching-and-ssh-input-backpressure

```yaml
@feature: terminal-output-batching-and-ssh-input-backpressure
@created: 2026-03-24
@status: completed
@mode: R2
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 6 | 0 | 0 | 6 |

---

## 任务列表

### 1. 方案设计

- [√] 1.1 完成 SSH / PTY 输出热点与输入队列问题定位，固化局部后端优化方案 | depends_on: []
- [√] 1.2 填写 proposal.md 与 tasks.md，形成可执行方案包 | depends_on: [1.1]

### 2. 开发实施

- [√] 2.1 在 `src-tauri/src/connection_manager.rs` 中增加 SSH 输出批量聚合与快照前 flush 机制 | depends_on: [1.2]
- [√] 2.2 在 `src-tauri/src/connection_manager.rs` / `src-tauri/src/ssh_terminal_russh.rs` 中将 SSH 命令队列改为 bounded 64，并改造写入入口为异步背压 | depends_on: [2.1]
- [√] 2.3 在 `src-tauri/src/terminal.rs` 中为本地 PTY 输出增加 8ms 窗口批量聚合 | depends_on: [1.2]
- [√] 2.4 运行 Rust / 前端验证并同步方案包状态、知识库变更 | depends_on: [2.2, 2.3]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-24 16:24 | 方案包创建 | completed | 已生成 implementation 类型方案包 |
| 2026-03-24 16:24 | 需求确认 | completed | 用户选择继续做 C + D |
| 2026-03-24 16:28 | SSH 输出聚合 | completed | 为 SSH 终端增加 8ms flush 窗口、快照前 flush 与 16KB 立即刷出上限 |
| 2026-03-24 16:29 | SSH 输入背压 | completed | 命令通道切换为 bounded 64，写入/缩放入口改为 async send |
| 2026-03-24 16:30 | 本地 PTY 输出聚合 | completed | reader 输出改为经聚合线程批量 emit |
| 2026-03-24 16:32 | 构建验证 | completed | `cargo check --manifest-path src-tauri/Cargo.toml` 与 `pnpm run build` 均通过 |

---

## 执行备注

> 本次以最小改动优先，不调整前端终端消费协议与 UI 行为。
