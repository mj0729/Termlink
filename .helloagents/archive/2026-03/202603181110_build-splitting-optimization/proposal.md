# 方案说明: build-splitting-optimization

```yaml
@feature: build-splitting-optimization
@created: 2026-03-18
@mode: R2
@type: implementation
@status: in_progress
```

## 目标

在不改变现有交互行为的前提下，收紧前端生产构建体积，优先降低主包首屏负载，并让 Monaco / 编辑器相关代码只在真正打开远程文件预览时才加载。

## 上下文摘要

- 前两轮已完成 `Tailwind CSS v4` 接入、前端 `JS -> TS` 迁移，以及 `vue-tsc --noEmit` 全绿闭环。
- 当前 `npm run build` 可通过，但仍有大 chunk 警告。
- 当前体积热点主要来自：
  - `monaco-editor` 被 [`FileEditor.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/FileEditor.vue) 静态导入
  - [`App.vue`](/Users/mengjia/WebstormProjects/Termlink/src/App.vue) 静态导入 [`FileEditor.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/FileEditor.vue)
  - [`vite.config.ts`](/Users/mengjia/WebstormProjects/Termlink/vite.config.ts) 仅做了非常粗粒度的 `monaco` 手动分包
- `Terminal.vue` 已经通过动态导入按需加载 xterm，因此第三轮优先处理编辑器链路。

## 约束条件

- 不回退前两轮已经完成的类型安全和构建稳定性。
- 不做无关架构重写，保持当前三栏工作台和标签页行为不变。
- 验收以真实构建结果为准，至少保证：
  - `vue-tsc --noEmit` 继续通过
  - `npm run build` 继续通过
  - 主包体积较第三轮开始前明显下降

## 实施方案

### 1. 编辑器链路懒加载

- 将 [`App.vue`](/Users/mengjia/WebstormProjects/Termlink/src/App.vue) 中的 [`FileEditor.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/FileEditor.vue) 改为 `defineAsyncComponent` 按需加载。
- 保持 `Terminal`、`Sidebar`、`RightPanel` 这些高频主工作区组件不动，避免引入额外切换抖动。

### 2. Monaco 库级懒加载

- 将 [`FileEditor.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/FileEditor.vue) 从静态 `import * as monaco from 'monaco-editor'` 改为运行时动态加载。
- 引入轻量模块级缓存，避免同一会话中重复初始化 Monaco。
- 保持现有主题切换、文件读写、只读切换和布局刷新行为不变。

### 3. Vite 分包策略收口

- 将 [`vite.config.ts`](/Users/mengjia/WebstormProjects/Termlink/vite.config.ts) 的 `manualChunks` 改为函数式分包：
  - `monaco-vendor`
  - `xterm-vendor`
  - `vue-vendor`
  - `tauri-vendor`
  - `antdv-vendor`
- 保持 `optimizeDeps` 的最小必要配置，避免 dev/build 行为漂移。

## 验收标准

- `vue-tsc --noEmit` 通过
- `npm run build` 通过
- 生产构建中 `index-*.js` 主包体积下降，Monaco 与公共依赖从主包进一步剥离
- 文件预览页仍可正常打开、编辑、保存、切换主题和下载

## 风险与控制

- 风险: 动态加载后首次打开文件编辑器会出现一次延迟
  - 控制: 保持加载态与现有 `a-spin` 逻辑一致，避免空白闪烁
- 风险: Monaco 模块异步化后影响主题同步
  - 控制: 在模块加载后立即根据当前主题设置编辑器主题，并保留现有 watch 逻辑
- 风险: 过度分包造成 chunk 数过多
  - 控制: 仅按明确的大依赖边界拆分，不做碎片化切割
