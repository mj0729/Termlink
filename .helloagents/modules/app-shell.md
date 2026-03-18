# app-shell

## 职责

- 管理 Vue 应用入口注册
- 维护应用壳层组件装配关系
- 负责全局主题、消息提示和基础样式引入

## 本次迁移更新

- 前端 UI 组件库已从 `ant-design-vue` 切换为 `antdv-next`
- 图标依赖已从 `@ant-design/icons-vue` 切换为 `@antdv-next/icons`
- 入口样式引入已更新为 `antdv-next/dist/reset.css`
- 全局消息调用已切换到 `antdv-next` 导出
- 项目包管理器入口已统一切换为 `pnpm`，Tauri 前置开发与构建命令同步改为 `pnpm run ...`

## 关键文件

- [`package.json`](/Users/mengjia/WebstormProjects/Termlink/package.json)
- [`src/main.ts`](/Users/mengjia/WebstormProjects/Termlink/src/main.ts)
- [`src/App.vue`](/Users/mengjia/WebstormProjects/Termlink/src/App.vue)
- [`src/style.css`](/Users/mengjia/WebstormProjects/Termlink/src/style.css)
