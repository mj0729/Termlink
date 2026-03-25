# 任务清单: ssh_terminal_ssh_only_core_rebuild

> **@status:** completed | 2026-03-25 11:15

```yaml
@feature: ssh_terminal_ssh_only_core_rebuild
@created: 2026-03-25
@status: completed
@mode: R3
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 4 | 0 | 0 | 4 |

---

## 任务列表

### 1. Terminal 分层重构

- [√] 1.1 在 `src/components/Terminal.vue` 中重写 SSH-only 终端组件，分离 SSH 会话层、轻量提示符层与展示层 | depends_on: []
- [√] 1.2 移除本地 PTY、shell marker 注入和内联联想分支，恢复 SSH 原始输入输出主路径 | depends_on: [1.1]

### 2. 应用入口与验证

- [√] 2.1 在 `src/App.vue`、`src/components/SshWorkspace.vue`、`src/components/TabManager.vue`、`src/types/app.ts` 中移除本地终端入口并完成 SSH 单栈收口 | depends_on: [1.2]
- [√] 2.2 执行构建验证并同步知识库与变更记录 | depends_on: [2.1]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-25 11:12 | 1.1 / 1.2 | 已完成 | `Terminal.vue` 重写为 SSH-only 组件，移除本地 PTY、shell integration marker 与联想增强 |
| 2026-03-25 11:13 | 2.1 | 已完成 | `App.vue`、`SshWorkspace.vue`、`TabManager.vue` 与 `types/app.ts` 完成 SSH 单栈收口 |
| 2026-03-25 11:14 | 2.2 | 已完成 | `pnpm run build` 通过，准备同步知识库与 CHANGELOG |

---

## 执行备注

- 本轮优先把 SSH 终端恢复成稳定单栈实现；提示符目录同步保留轻量解析，历史联想和 shell marker 注入暂时移除。
