# 任务清单: remote-directory-tree-row-spacing-tighten

> **@status:** completed | 2026-03-23 17:35

```yaml
@feature: remote-directory-tree-row-spacing-tighten
@created: 2026-03-23
@status: completed
@mode: R2
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 3 | 0 | 0 | 3 |

---

## 任务列表

### 1. 方案设计

- [x] 1.1 确认仅压目录节点行高与上下留白，不改字体大小 | depends_on: []

### 2. 开发实施

- [x] 2.1 在 `src/components/RemoteFileWorkbench.vue` 中下调 aggressive 目录树节点高度变量 | depends_on: [1.1]
- [x] 2.2 执行构建验证并确认目录树交互未回退 | depends_on: [2.1]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-23 17:33:00 | 1.1 | completed | 已确认本轮仅压目录节点行高，不改字体大小 |
| 2026-03-23 17:34:00 | 2.1 | completed | 已将 aggressive 目录节点最小高度从 19px 调整为 17px，并同步输入框高度 |
| 2026-03-23 17:34:30 | 2.2 | completed | 已执行 pnpm run build，构建通过 |

---

## 执行备注

> 本次调整只影响 SSH 工作区左侧目录树的 aggressive 模式节点高度。
