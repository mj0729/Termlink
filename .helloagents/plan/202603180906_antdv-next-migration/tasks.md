# 任务清单: antdv-next-migration

```yaml
@feature: antdv-next-migration
@created: 2026-03-18
@status: completed
@mode: R3
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 8 | 0 | 0 | 8 |

---

## 任务列表

### 1. 方案与基础设施

- [√] 1.1 完善知识库和方案包内容，记录迁移目标、风险与任务拆解 | depends_on: []

### 2. 依赖与入口迁移

- [√] 2.1 在 `/Users/mengjia/WebstormProjects/Termlink/package.json` 中替换 `ant-design-vue`、`@ant-design/icons-vue` 为 `antdv-next`、`@antdv-next/icons` | depends_on: [1.1]
- [√] 2.2 在 `/Users/mengjia/WebstormProjects/Termlink/src/main.js` 与 `/Users/mengjia/WebstormProjects/Termlink/src/App.vue` 中迁移组件库注册、样式引入与消息 API | depends_on: [2.1]

### 3. 组件模板与脚本迁移

- [√] 3.1 迁移模态框和表单相关组件，包括 `SettingsModal.vue`、`SshModal.vue`、`FileEditor.vue` | depends_on: [2.2]
- [√] 3.2 迁移导航与列表相关组件，包括 `TopMenu.vue`、`TabManager.vue`、`Sidebar.vue`、`FileManager.vue` | depends_on: [2.2]
- [√] 3.3 迁移监控与下载相关组件，包括 `RightPanel.vue`、`DownloadManager.vue`、`SystemMonitor.vue`、`Terminal.vue` | depends_on: [2.2]

### 4. 样式兼容与验收

- [√] 4.1 调整 `/Users/mengjia/WebstormProjects/Termlink/src/style.css` 与局部 `:deep(.ant-*)` 规则，适配 `antdv-next` DOM 结构 | depends_on: [3.1, 3.2, 3.3]
- [√] 4.2 执行构建验证并修复剩余兼容问题 | depends_on: [4.1]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-18 09:07:17 | 1.1 | 完成 | 已创建方案包与知识库骨架，并补全迁移提案与任务拆解 |
| 2026-03-18 09:12:40 | 2.1/2.2 | 完成 | 依赖、入口注册、全局消息与图标导入已迁移到 `antdv-next` |
| 2026-03-18 09:15:20 | 3.1/3.2/3.3 | 完成 | 高风险旧写法已升级为 `antdv-next` 推荐模式，剩余组件统一切换到新包导入 |
| 2026-03-18 09:15:55 | 4.1/4.2 | 完成 | `npm run build` 通过，未发现残留旧包导入 |

---

## 执行备注

> 当前任务属于前端多组件迁移，按 HelloAGENTS 复杂度标准归类为 complex（影响文件数 > 10）。
>
> 说明:
> - 构建产物仍存在 Monaco 与 xterm 带来的大包体 warning，这属于项目既有体量提示，不是本次迁移引入的阻断问题。
> - 工作区里仍有未跟踪的 `pnpm-lock.yaml`，本次以已存在且已更新的 `package-lock.json` 为准完成依赖同步。
