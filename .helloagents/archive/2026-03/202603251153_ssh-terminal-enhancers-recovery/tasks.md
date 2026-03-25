# 任务清单: ssh_terminal_enhancers_recovery

> **@status:** completed | 2026-03-25 11:59

```yaml
@feature: ssh_terminal_enhancers_recovery
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

### 1. 增强层回归

- [√] 1.1 在 `src/components/Terminal.vue` 中接回 prompt marker 注入、marker 解析与 bootstrap echo 过滤 | depends_on: []
- [√] 1.2 在 `src/components/Terminal.vue` 中恢复历史联想 overlay、历史预热与建议接受快捷键 | depends_on: [1.1]

### 2. CWD 与验证

- [√] 2.1 恢复 cwd 同步到“marker 优先、prompt 解析兜底”，并保持工作区文件联动 | depends_on: [1.2]
- [√] 2.2 执行构建验证并同步知识库与变更记录 | depends_on: [2.1]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-25 11:57 | 1.1 / 1.2 | 已完成 | `Terminal.vue` 已接回 prompt marker 注入、echo 过滤、历史联想 overlay 与快捷接受 |
| 2026-03-25 11:58 | 2.1 | 已完成 | cwd 同步恢复为 marker 优先、prompt 解析兜底，继续驱动工作区路径联动 |
| 2026-03-25 11:58 | 2.2 | 已完成 | `pnpm run build` 通过，准备同步知识库与 CHANGELOG |

---

## 执行备注

- 本轮仍保持 SSH 会话层为唯一核心路径；增强层都可以在失效时退化，不会阻断基本输入输出。
