# 项目上下文

## 项目概况

`Termlink` 是一个基于 Vue 3 + Vite + Tauri 的桌面终端工具，前端主要集中在 [`src`](/Users/mengjia/WebstormProjects/Termlink/src) 目录，桌面能力与系统集成位于 [`src-tauri`](/Users/mengjia/WebstormProjects/Termlink/src-tauri)。

## 当前技术栈

- 前端框架: Vue 3.5
- 构建工具: Vite 7
- 样式引擎: Tailwind CSS 4（通过 `@tailwindcss/vite` 接入）
- 桌面容器: Tauri 2
- 包管理器: pnpm 10
- UI 组件库: `antdv-next`
- 图标库: `@antdv-next/icons`
- 前端语言形态: 入口、服务层与 `Vue SFC` 脚本已迁移到 TypeScript 轨道
- 编辑器/终端: `monaco-editor`、`@xterm/xterm`

## 前端结构

- `src/main.ts`: Vue 应用入口与 UI 组件库注册
- `src/App.vue`: 应用壳层与全局消息调用
- `src/components/`: 主要页面与业务组件，当前有多个文件直接使用 Ant Design Vue 组件
- `src/services/`: SSH、SFTP、主题等前端服务，已迁移为 `.ts`
- `src/types/`: 前端共享类型定义
- `src/style.css`: 全局样式、主题变量与 Tailwind 4 入口

## 当前迁移状态

- `Tailwind CSS v4` 已按官方 Vite 插件方式接入，主样式文件顶部使用 `@import "tailwindcss";`
- `vite.config.ts`、`src/main.ts`、`src/services/*.ts` 已完成从 JavaScript 到 TypeScript 的文件级迁移
- `src` 下 `Vue SFC` 脚本已统一切换为 `<script setup lang="ts">`
- 第一批 Tailwind 混合重构已覆盖工作台壳层、顶部栏、标签栏和状态栏，现有深浅主题变量体系仍作为主视觉底座
- 第二轮类型收口已完成，`RightPanel`、`SystemMonitor`、`Sidebar`、`Terminal`、`SshModal`、`FileManager`、`SettingsModal` 等组件已切到显式共享类型
- 当前前端验收基线为 `vue-tsc --noEmit` 与 `pnpm run build` 双通过，可在此基础上继续做功能开发或进一步类型细化
- 第三轮已完成首屏构建体积优化：[App.vue](/Users/mengjia/WebstormProjects/Termlink/src/App.vue) 中的 [FileEditor.vue](/Users/mengjia/WebstormProjects/Termlink/src/components/FileEditor.vue) 已异步加载，Monaco 改为运行时懒加载并做了模块缓存
- 当前生产构建的主入口包已从多 MB 级降到约 `64.88 kB`，但 `antdv-next` 与 `monaco-editor` 仍各自保留一个较大的异步 vendor chunk，后续如要继续优化需进入 UI 库按需注册或 Monaco 语言能力精拆阶段
