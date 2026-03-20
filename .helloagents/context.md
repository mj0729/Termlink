# 项目上下文

## 项目概况

`Termlink` 是一个基于 Vue 3 + Vite + Tauri 的桌面终端工具，前端主要集中在 [`src`](/Users/mengjia/WebstormProjects/Termlink/src) 目录，桌面能力与系统集成位于 [`src-tauri`](/Users/mengjia/WebstormProjects/Termlink/src-tauri)。

## 当前技术栈

- 前端框架: Vue 3.5
- 构建工具: Vite 8
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
- `src/components/`: 主要页面与业务组件，当前已统一到 `antdv-next` 体系，只有隐藏文件输入和编辑器 `textarea` 等性能/平台敏感实现继续保留原生控件
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
- 第四轮已完成低风险 vendor 分包优化：`vite.config.ts` 将 `antdv-next` 拆为 `icons / style / date / data-entry / structure / display / feedback` 多组 vendor chunk，已消除单个 `antdv` chunk 超过 500 kB 的告警
- 第五轮已完成 `antdv-next` 自动按需注册：入口已移除 `app.use(AntdvNext)`，改由 `unplugin-vue-components` 解析 `<a-*>` 模板组件、`unplugin-auto-import` 注入 `Input / Modal / message`，同时生成 `src/components.d.ts` 与 `src/auto-imports.d.ts`
- 当前构建中 `antdv-next` 相关产物已进一步收缩到约 `49K / 53K / 118K / 236K / 282K / 353K` 的多组 vendor chunk，且上一轮的 circular chunk 提示已消失
- 当前前端构建链已升级到 `Vite 8.0.1` 与 `@vitejs/plugin-vue 6.0.5`，`pnpm run build` 和 `cargo check --manifest-path src-tauri/Cargo.toml` 已通过
- 本轮升级后，构建产物中可见 `rolldown-runtime`，且 `monaco` / `antdv-next` 大块产物仍会触发 `>500 kB` 警告；这属于当前分包策略下的已知现象，不阻断构建
- `@tailwindcss/vite@4.2.1` 目前仍声明 peer `vite@"^5.2.0 || ^6 || ^7"`，因此安装阶段会对 `Vite 8` 报出未满足 peer 警告；实际生产构建仍可通过，后续可关注 Tailwind 官方是否发布显式支持 `Vite 8` 的版本
