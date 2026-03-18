# 变更记录

## [0.0.2] - 2026-03-18

### 变更

- **[app-shell]**: 将项目包管理器入口收敛到 `pnpm`，同步 Tauri 前置命令与项目文档并通过 `pnpm install` / `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603181108_pnpm-migration](archive/2026-03/202603181108_pnpm-migration/)
  - 决策: pnpm-migration#D001(采用 pnpm 作为唯一包管理器入口)

## [0.0.1] - 2026-03-18

### 新增

- **[app-shell]**: 接入 `Tailwind CSS v4` 并将前端入口、服务层和组件脚本整体迁移到 TypeScript 轨道 — by 孟彦祖
  - 方案: [202603181016_tailwind4-ts-migration](archive/2026-03/202603181016_tailwind4-ts-migration/)
  - 决策: tailwind4-ts-migration#D001(采用“底座先行，分层收口”的迁移路径), tailwind4-ts-migration#D002(采用 Tailwind 混合重构而非整站重画)

### 变更

- **[type-closure]**: 完成第二轮 TypeScript 类型验收闭环，系统监控、侧边栏、终端与文件管理链路实现共享类型收口并通过 `vue-tsc --noEmit` / `npm run build` 双验收 — by 孟彦祖
  - 方案: [202603181041_ts-typecheck-closure](archive/2026-03/202603181041_ts-typecheck-closure/)
  - 决策: ts-typecheck-closure#D001(以“类型验收闭环”为唯一目标，优先修共享模型缺失导致的系统性报错), ts-typecheck-closure#D002(保留第一轮构建稳定性，以最小必要改动收口大组件与 DOM 事件类型)

- **[build-optimization]**: 完成第三轮构建体积优化，文件编辑器链路切到异步加载并收紧 Vite vendor 分包，显著降低主包首屏负载 — by 孟彦祖
  - 方案: [202603181110_build-splitting-optimization](archive/2026-03/202603181110_build-splitting-optimization/)
  - 决策: build-splitting-optimization#D001(优先切断 FileEditor→Monaco 的静态依赖链，再做 Vite vendor 分包), build-splitting-optimization#D002(本轮以主包显著下降为完成边界，不把 antdv 整库按需注册重构纳入同一轮)

## [0.0.0] - 2026-03-18

### 新增

- **[知识库]**: 初始化 HelloAGENTS 知识库并创建 `antdv-next` 迁移方案包 — by 孟彦祖
  - 方案: [202603180906_antdv-next-migration](archive/2026-03/202603180906_antdv-next-migration/)
  - 决策: antdv-next-migration#D001(保持现有布局与主题体验，基于 `antdv-next` 完成兼容迁移)
