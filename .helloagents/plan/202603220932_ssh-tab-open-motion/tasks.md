# 任务清单: ssh-tab-open-motion

```yaml
@feature: ssh-tab-open-motion
@created: 2026-03-22
@status: completed
@mode: R2
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 3 | 0 | 0 | 3 |

---

## 任务列表

### 1. Tab 与工作区动效

- [√] 1.1 在 `src/App.vue` 中增加统一的开 tab 动效入口和工作区 reveal 状态 | depends_on: []
- [√] 1.2 在 `src/components/TabManager.vue` 中为新 tab 标签与 ink bar 增加轻量过渡效果 | depends_on: [1.1]
- [√] 1.3 运行前端构建验证，确认动效改动不影响现有功能 | depends_on: [1.1, 1.2]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-22 09:32:00 | 1.1 | completed | `App.vue` 增加 freshTabId / activatingWorkspaceId 与 `openTabWithMotion` |
| 2026-03-22 09:34:00 | 1.2 | completed | `TabManager.vue` 增加新标签轻滑入与激活 tab 过渡样式 |
| 2026-03-22 09:35:00 | 1.3 | completed | `pnpm run build` 通过 |

---

## 执行备注

- 本轮没有引入复杂 JS 动画库，全部使用现有结构上的短时 CSS 动效，优先保证终端区域的稳定性。
