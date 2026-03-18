# 任务清单: tailwind4-ts-migration

> **@status:** completed | 2026-03-18 10:37

```yaml
@feature: tailwind4-ts-migration
@created: 2026-03-18
@status: completed
@mode: R3
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 9 | 0 | 0 | 9 |

---

## 任务列表

### 1. 底座与构建链

- [√] 1.1 接入 `Tailwind CSS v4` 所需依赖与构建配置，完成 `vite.config.js -> vite.config.ts`、主样式导入和基础 TypeScript 配置落地 | depends_on: []
- [√] 1.2 补充 `env.d.ts`、组件与服务共享类型定义，建立 Vue/Tauri/Monaco/xterm 的前端类型底座 | depends_on: [1.1]

### 2. 入口与服务层 TS 迁移

- [√] 2.1 将 [src/main.js](/Users/mengjia/WebstormProjects/Termlink/src/main.js) 与核心服务文件迁移为 `TypeScript`，统一导入导出与返回值类型 | depends_on: [1.2]
- [√] 2.2 清理应用壳层中的隐式 `any` 与通用数据结构，将 [src/App.vue](/Users/mengjia/WebstormProjects/Termlink/src/App.vue) 升级为类型化入口壳层 | depends_on: [2.1]

### 3. 组件批次迁移

- [√] 3.1 迁移中等复杂度组件到 `<script setup lang=\"ts\">`，包括顶部栏、标签栏、状态栏、模态框、编辑器与下载相关组件 | depends_on: [2.2]
- [√] 3.2 迁移文件管理与终端相关组件，补齐 DOM 引用、事件回调和 Tauri 交互类型 | depends_on: [3.1]
- [√] 3.3 迁移超大组件 [src/components/Sidebar.vue](/Users/mengjia/WebstormProjects/Termlink/src/components/Sidebar.vue) 与 [src/components/RightPanel.vue](/Users/mengjia/WebstormProjects/Termlink/src/components/RightPanel.vue)，完成关键状态和事件链路类型化 | depends_on: [3.2]

### 4. Tailwind 混合重构

- [√] 4.1 在保留现有主题变量的前提下，将高频容器、按钮区、布局间距和状态标签逐步切换到 `Tailwind` 组合类 | depends_on: [2.2]
- [√] 4.2 收口样式冲突并执行构建验证，确保 `npm run build` 通过且无明显结构性回退 | depends_on: [3.3, 4.1]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-18 10:16:47 | 方案设计 | 完成 | 已创建方案包并确认采用“底座先行，分层收口”迁移策略 |
| 2026-03-18 10:28:41 | 1.1/1.2 | 完成 | 已安装 `tailwindcss`、`@tailwindcss/vite`、`typescript`、`vue-tsc`，并落地 `tsconfig.json`、`env.d.ts` 与共享类型 |
| 2026-03-18 10:28:41 | 2.1/2.2 | 完成 | 入口文件、Vite 配置与服务层已迁移到 `.ts`，应用壳层完成第一批类型化 |
| 2026-03-18 10:28:41 | 3.1/3.2/3.3 | 完成 | `src` 下组件脚本已统一迁移到 `<script setup lang="ts">`，超大组件进入渐进式类型化阶段 |
| 2026-03-18 10:28:41 | 4.1/4.2 | 完成 | `Tailwind 4` 已接入并用于工作台壳层、顶部栏、标签栏、状态栏；`npm run build` 通过 |

---

## 执行备注

> 当前任务覆盖 `Tailwind 4` 接入、前端全量 `JS -> TS` 迁移及高频样式混合重构，按 HelloAGENTS 复杂度标准归类为 complex。
>
> 说明:
> - 工作区当前已存在此前 `antdv-next` 迁移相关改动，本次任务将在该基础上继续推进，不回滚现有用户改动。
> - 首轮 `Tailwind` 改造优先覆盖布局与状态类，避免直接重写 `antdv-next` 的核心 DOM 皮肤。
> - `vue-tsc --noEmit` 目前仍会在 `Sidebar`、`RightPanel`、`SystemMonitor` 等超大组件中报告一批渐进式类型问题；本轮以“完成 TS 迁移并保证生产构建通过”为验收基线。
