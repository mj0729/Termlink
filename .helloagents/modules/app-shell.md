# app-shell

## 职责

- 管理 Vue 应用入口注册
- 维护应用壳层组件装配关系
- 负责全局主题、消息提示和基础样式引入

## 本次迁移更新

- `App.vue` 已清理未使用的旧壳层辅助函数，并把卸载阶段的 SSH / PTY 资源释放从 `forEach(async ...)` 收口为 `Promise.all(...)` 批量关闭，避免顶层销毁阶段的异步清理变得不可追踪
- `App.vue` 现在统一通过 `openTabWithMotion()` 打开新标签页，并用 `freshTabId / activatingWorkspaceId` 为 tab 与工作区提供一次性 reveal 动效，连接中心进入 SSH 工作区不再是硬切
- `App.vue` 与 `SshService.ts` 现在会在连接中心点击 SSH 卡片后立即创建 `connecting` 标签页，再异步完成建连，避免 UI 被完整 SSH 握手阻塞 1-2 秒
- `App.vue` 向 `RightPanel` 下发的 `connectionId` 现已收紧为仅在 `sshState === 'connected'` 时有效，避免连接中阶段提前触发监控/传输侧逻辑
- 前端 UI 组件库已从 `ant-design-vue` 切换为 `antdv-next`
- 图标依赖已从 `@ant-design/icons-vue` 切换为 `@antdv-next/icons`
- 入口样式引入已更新为 `antdv-next/dist/reset.css`
- 全局消息调用已切换到 `antdv-next` 导出
- 项目包管理器入口已统一切换为 `pnpm`，Tauri 前置开发与构建命令同步改为 `pnpm run ...`
- 前端构建核心已升级到 `Vite 8.0.1`，`@vitejs/plugin-vue` 已同步到 `6.0.5`
- `vite.config.ts` 已将 `antdv-next` vendor 从单块拆为 `icons / style / date / data-entry / structure / display / feedback` 多组 chunk，以降低单块集中度并改善缓存粒度
- `vite.config.ts` 已接入 `unplugin-vue-components` 和 `unplugin-auto-import`，当前通过项目定制 resolver 自动解析 `<a-*>` 组件，并为 `Input`、`Modal`、`message` 生成脚本自动导入
- `src/main.ts` 已移除 `app.use(AntdvNext)`，当前仅保留 `antdv-next/dist/reset.css` 作为全局样式基线
- 当前 `Vite 8` 生产构建可通过，但 `@tailwindcss/vite@4.2.1` 仍只声明支持到 `Vite 7`，安装阶段存在 peer 警告；实际是否继续保留该插件，以 Tailwind 官方后续支持策略为准

## 关键文件

- [`package.json`](/Users/mengjia/WebstormProjects/Termlink/package.json)
- [`src/main.ts`](/Users/mengjia/WebstormProjects/Termlink/src/main.ts)
- [`src/App.vue`](/Users/mengjia/WebstormProjects/Termlink/src/App.vue)
- [`src/style.css`](/Users/mengjia/WebstormProjects/Termlink/src/style.css)
