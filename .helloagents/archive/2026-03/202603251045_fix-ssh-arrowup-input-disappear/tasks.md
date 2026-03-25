# 任务清单: fix_ssh_arrowup_input_disappear

> **@status:** completed | 2026-03-25 10:48

```yaml
@feature: fix_ssh_arrowup_input_disappear
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

### 1. Terminal

- [√] 1.1 在 `src/components/Terminal.vue` 中补充 SSH 终端显式尺寸同步逻辑 | depends_on: []
- [√] 1.2 在 `src/components/Terminal.vue` 中把尺寸同步挂到连接恢复、激活和 `fit` 流程，修复 `ArrowUp` 后提示符/输入异常 | depends_on: [1.1]

### 2. 验证与文档

- [√] 2.1 执行构建验证并同步知识库、CHANGELOG 与模块文档 | depends_on: [1.2]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-25 10:46 | 1.1 / 1.2 | 已完成 | `Terminal.vue` 增加 SSH 视口尺寸缓存与主动同步，覆盖 `fit`、连接恢复和激活场景 |
| 2026-03-25 10:47 | 2.1 | 已完成 | `pnpm run build` 通过，并已同步模块文档 |
| 2026-03-25 10:55 | 1.1 / 1.2 | 已完成 | 移除 `SshService` 中旧的 `PROMPT_COMMAND/cd()` bootstrap，统一到单一 shell integration 协议，并再次通过构建验证 |

---

## 执行备注

- 本次修复最终收口为两部分：一是补齐 SSH 终端尺寸同步，二是移除 `SshService` 里的旧 bootstrap，避免与新的 shell integration 重复注入。
