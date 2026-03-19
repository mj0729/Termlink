# 任务清单: compact-workspace-redesign

```yaml
@feature: compact-workspace-redesign
@created: 2026-03-18
@status: completed
@mode: R2
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 4 | 0 | 0 | 4 |

---

## 任务列表

### 1. 工作台结构收敛

- [√] 1.1 重构 `/Users/mengjia/WebstormProjects/Termlink/src/App.vue` 的工作台外壳与空状态，去掉外层边框壳并改为背景一体化布局 | depends_on: []
- [√] 1.2 压缩 `/Users/mengjia/WebstormProjects/Termlink/src/components/TopMenu.vue`、`/Users/mengjia/WebstormProjects/Termlink/src/components/StatusBar.vue`、`/Users/mengjia/WebstormProjects/Termlink/src/components/TabManager.vue` 的信息密度与控件尺寸 | depends_on: [1.1]

### 2. 侧栏与主题压缩

- [√] 2.1 压缩 `/Users/mengjia/WebstormProjects/Termlink/src/components/Sidebar.vue` 与 `/Users/mengjia/WebstormProjects/Termlink/src/components/RightPanel.vue` 的卡片、按钮和边界层次 | depends_on: [1.1]
- [√] 2.2 调整 `/Users/mengjia/WebstormProjects/Termlink/src/style.css` 的主题变量和全局 antdv-next 组件样式，并执行 `pnpm run build` 验证 | depends_on: [1.2, 2.1]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-18 11:30:00 | 1.1 | 完成 | 去掉工作台外层硬边框，重写空状态为双列紧凑说明卡片 |
| 2026-03-18 11:34:00 | 1.2 | 完成 | 顶部栏、底部状态条和标签栏完成信息收敛与尺寸压缩 |
| 2026-03-18 11:37:00 | 2.1 | 完成 | 左右侧栏改为轻玻璃层，连接卡片和监控区边框感明显弱化 |
| 2026-03-18 11:39:00 | 2.2 | 完成 | `pnpm run build` 通过；better-icons CLI 不可用，已回退到现有图标体系 |
