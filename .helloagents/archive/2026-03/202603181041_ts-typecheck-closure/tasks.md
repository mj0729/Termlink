# 任务清单: ts-typecheck-closure

> **@status:** completed | 2026-03-18 11:06

```yaml
@feature: ts-typecheck-closure
@created: 2026-03-18
@status: completed
@mode: R2
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 6 | 0 | 0 | 6 |

---

## 任务列表

### 1. 共享类型与数据模型

- [√] 1.1 扩展 [src/types/app.ts](/Users/mengjia/WebstormProjects/Termlink/src/types/app.ts)，补齐系统监控、下载进度、侧边栏配置、SFTP 视图等共享接口 | depends_on: []
- [√] 1.2 清理第一轮遗留的过渡性类型兜底，确保核心组件直接依赖共享类型而不是 `unknown`/`{}` | depends_on: [1.1]

### 2. 核心大组件收口

- [√] 2.1 修复 [src/components/RightPanel.vue](/Users/mengjia/WebstormProjects/Termlink/src/components/RightPanel.vue) 与 [src/components/SystemMonitor.vue](/Users/mengjia/WebstormProjects/Termlink/src/components/SystemMonitor.vue) 的系统监控/下载类型错误 | depends_on: [1.2]
- [√] 2.2 修复 [src/components/Sidebar.vue](/Users/mengjia/WebstormProjects/Termlink/src/components/Sidebar.vue) 的连接列表、SFTP 状态、弹窗渲染和输入节点类型错误 | depends_on: [1.2]

### 3. 边缘组件与验收

- [√] 3.1 修复 `SshModal`、`Terminal`、`DownloadManager`、`FileEditor`、`FileManager`、`SettingsModal` 的剩余类型错误 | depends_on: [2.1, 2.2]
- [√] 3.2 执行 `vue-tsc --noEmit` 与 `npm run build` 双重验证，收口剩余问题并同步知识库 | depends_on: [3.1]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-18 10:41:33 | 方案设计 | 完成 | 第二轮目标明确为 `vue-tsc --noEmit` 全绿，并确认主战场为 `Sidebar / RightPanel / SystemMonitor` |
| 2026-03-18 11:06:12 | 1.1/1.2 | 完成 | 已补齐系统监控、终端配置、下载进度和 SFTP 状态相关共享类型，并清除第一轮残留的 `unknown/{}` 兜底 |
| 2026-03-18 11:06:12 | 2.1/2.2 | 完成 | `RightPanel`、`SystemMonitor`、`Sidebar` 已完成核心状态、事件负载、SFTP 列表与弹窗输入的显式类型化 |
| 2026-03-18 11:06:12 | 3.1/3.2 | 完成 | `FileManager`、`SettingsModal`、`SshModal`、`Terminal` 等组件已收口，`vue-tsc --noEmit` 与 `npm run build` 双通过 |

---

## 执行备注

> 本轮为第一轮 TypeScript 迁移后的收口轮次，以类型验收闭环为唯一核心目标，按 HelloAGENTS 标准归类为 moderate。
>
> 说明:
> - 当前 `npm run build` 已通过，本轮所有修改必须保持该结果不回退。
> - 第二轮优先消除共享数据模型缺失带来的系统性报错，再处理边缘 DOM/事件类型问题。
> - 本轮完成后，前端类型验收基线已升级为 `vue-tsc --noEmit` 与 `npm run build` 双通过。
