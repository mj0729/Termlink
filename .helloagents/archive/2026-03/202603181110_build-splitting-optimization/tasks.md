# 任务清单: build-splitting-optimization

> **@status:** completed | 2026-03-18 11:18

```yaml
@feature: build-splitting-optimization
@created: 2026-03-18
@status: completed
@mode: R2
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 3 | 0 | 0 | 3 |

---

## 任务列表

### 1. 编辑器链路按需化

- [√] 1.1 将 [src/App.vue](/Users/mengjia/WebstormProjects/Termlink/src/App.vue) 中的文件编辑器改为异步组件加载，避免 Monaco 相关链路进入主包 | depends_on: []
- [√] 1.2 重构 [src/components/FileEditor.vue](/Users/mengjia/WebstormProjects/Termlink/src/components/FileEditor.vue) 的 Monaco 加载方式，改为带缓存的运行时懒加载 | depends_on: [1.1]

### 2. 构建分包与验收

- [√] 2.1 调整 [vite.config.ts](/Users/mengjia/WebstormProjects/Termlink/vite.config.ts) 的手动分包策略并执行 `vue-tsc --noEmit` / `npm run build` 验证，记录体积变化 | depends_on: [1.2]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-18 11:10:00 | 方案设计 | 完成 | 已确认第三轮目标为构建体积与分包优化，采用“FileEditor 异步组件 + Monaco 运行时懒加载 + Vite 函数式 manualChunks”方案 |
| 2026-03-18 11:18:20 | 1.1/1.2 | 完成 | `App.vue` 已切换到异步文件编辑器组件，`FileEditor.vue` 中 Monaco 改为带缓存的运行时动态加载 |
| 2026-03-18 11:18:20 | 2.1 | 完成 | `vite.config.ts` 已切换到函数式 vendor 分包；`vue-tsc --noEmit` 与 `npm run build` 双通过，主包由约 2.15MB 降到约 64.88kB |

---

## 执行备注

> 本轮目标聚焦构建体积优化，不引入新功能，不调整现有业务流。
>
> 说明:
> - 当前项目已完成前两轮 TypeScript 收口，本轮所有改动必须保持类型检查与生产构建继续通过。
> - 优先减少主包体积，其次再优化 Monaco / 公共依赖的 chunk 边界。
> - 当前仍存在 `antdv-vendor` 与 `monaco-vendor` 的大异步 chunk 警告，但主包首屏负载已经完成显著收缩，作为第三轮阶段目标视为已达成。
