# 任务清单: terminal-shell-integration-phase1

```yaml
@feature: terminal-shell-integration-phase1
@created: 2026-03-24
@status: completed
@mode: R2
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 4 | 0 | 0 | 4 |

---

## 任务列表

### 1. 协议与后端启动链路

- [√] 1.1 在 `src/utils/terminalShellIntegration.ts` 中定义统一 marker 协议与 bash/zsh bootstrap 生成逻辑 | depends_on: []
- [√] 1.2 在 `src-tauri/src/terminal.rs` 与 `src-tauri/src/connection_manager.rs` 中调整本地/SSH shell integration 挂点 | depends_on: [1.1]

### 2. 前端接入与验证

- [√] 2.1 在 `src/components/Terminal.vue` 中接入 bootstrap 注入、marker 解析与本地/SSH 状态同步 | depends_on: [1.1, 1.2]
- [√] 2.2 更新知识库记录并完成 `pnpm run build`、`cargo check --manifest-path src-tauri/Cargo.toml` 验证 | depends_on: [2.1]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-24 14:13:00 | 方案设计 | completed | 已确认第一阶段范围：bash + zsh、本地 PTY + SSH、仅基础协议不做联想 UI |
| 2026-03-24 14:21:00 | 1.1 / 1.2 | completed | 新增 `terminalShellIntegration` 工具，统一本地 PTY 与 SSH 的 bash/zsh bootstrap 注入协议 |
| 2026-03-24 14:24:00 | 2.1 | completed | `Terminal.vue` 已统一解析 shell marker，并在本地/SSH 会话绑定后自动注入 bootstrap |
| 2026-03-24 14:26:00 | 2.2 | completed | `pnpm run build` 与 `cargo check --manifest-path src-tauri/Cargo.toml` 均通过 |

---

## 执行备注

- 第一阶段只交付 shell integration 基础协议与状态同步，不包含联想展示、命令历史排序与 `Ctrl+E` 接受逻辑。
- SSH 现已不再依赖 Rust 侧的 bash 专属 `PROMPT_COMMAND` 环境注入，后续若扩展更多 marker，应优先在共享 bootstrap 中演进。
