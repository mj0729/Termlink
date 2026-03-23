# 任务清单: remote-file-table-row-spacing-tighten

> **@status:** completed | 2026-03-23 17:31

```yaml
@feature: remote-file-table-row-spacing-tighten
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

- [x] 1.1 确认只压 compact 正文行高，不联动图标和字号 | depends_on: []

### 2. 开发实施

- [x] 2.1 在 `src/components/remote-file/RemoteFileTable.vue` 中下调 compact 模式正文行高 | depends_on: [1.1]
- [x] 2.2 执行构建验证并确认列表正文交互未回退 | depends_on: [2.1]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-23 17:29:00 | 1.1 | completed | 已确认本轮只压正文行高，不改图标尺寸和字号 |
| 2026-03-23 17:30:00 | 2.1 | completed | 已将 compact 正文行高从 28px 调整为 26px |
| 2026-03-23 17:30:30 | 2.2 | completed | 已执行 pnpm run build，构建通过 |

---

## 执行备注

> 本次调整聚焦文件列表正文垂直密度，表头和底部状态栏保持当前状态。
