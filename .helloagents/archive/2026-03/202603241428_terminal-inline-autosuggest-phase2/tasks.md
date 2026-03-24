# 任务清单: terminal-inline-autosuggest-phase2

```yaml
@feature: terminal-inline-autosuggest-phase2
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

### 1. 建议服务与终端状态

- [√] 1.1 在 `src/services/TerminalSuggestionService.ts` 中实现历史存储、查询和排序逻辑 | depends_on: []
- [√] 1.2 在 `src/components/Terminal.vue` 中接入建议状态、prompt gating 与历史记录触发 | depends_on: [1.1]

### 2. 渲染与验收

- [√] 2.1 在 `src/components/Terminal.vue` 与 `src/style.css` 中实现 ghost text decoration 和 `Ctrl+E` 接受逻辑 | depends_on: [1.2]
- [√] 2.2 更新知识库记录并完成 `pnpm run build`、`cargo check --manifest-path src-tauri/Cargo.toml` 验证 | depends_on: [2.1]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-24 14:31:00 | 方案设计 | completed | 已确认第二阶段采用内联灰字 ghost text，底层用 xterm decoration 实现 |
| 2026-03-24 14:36:00 | 1.1 / 1.2 | completed | 新增终端历史建议服务，并把建议状态与 prompt gating 接入 `Terminal.vue` |
| 2026-03-24 14:40:00 | 2.1 | completed | 已实现 xterm decoration ghost text、`Ctrl+E` 接受与 `sshHost` 作用域透传 |
| 2026-03-24 14:42:00 | 2.2 | completed | `pnpm run build` 与 `cargo check --manifest-path src-tauri/Cargo.toml` 均通过 |

---

## 执行备注

- 第二阶段只做单候选历史联想，不做 AI 联想、多候选面板和设置页开关。
- ghost text 采用“视觉内联、技术上 decoration 挂载”的折中方案，避免污染真实终端 buffer。
