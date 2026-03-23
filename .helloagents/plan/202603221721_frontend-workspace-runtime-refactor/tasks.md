# 任务清单: frontend-workspace-runtime-refactor

```yaml
@feature: frontend-workspace-runtime-refactor
@created: 2026-03-22
@status: completed
@mode: R3
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 8 | 0 | 0 | 8 |

---

## 任务列表

### 1. 工作区编排重构

- [√] 1.1 收敛 [`src/App.vue`](/Users/mengjia/WebstormProjects/Termlink/src/App.vue) 的壳层职责，梳理标签页关闭、活动工作区和高层事件路由 | depends_on: []
- [√] 1.2 调整工作区渲染与可见性策略，避免隐藏工作区持续消费运行时资源 | depends_on: [1.1]

### 2. SSH 工作区与终端运行时

- [√] 2.1 重构 [`src/components/SshWorkspace.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/SshWorkspace.vue) 的 pane 生命周期、布局恢复和文件抽屉副作用 | depends_on: [1.2]
- [√] 2.2 重构 [`src/components/Terminal.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/Terminal.vue) 的会话绑定、激活态 gating 和上下文菜单逻辑 | depends_on: [2.1]

### 3. 监控面板拆分与性能治理

- [√] 3.1 收口 [`src/components/RightPanel.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/RightPanel.vue) 中监控启停条件与遗留逻辑，避免监控在非可见状态继续运行 | depends_on: [1.1]
- [√] 3.2 让监控刷新仅在面板真实可见且连接可用时运行，保留下载面板行为稳定 | depends_on: [3.1]

### 4. 远程文件工作台复用化

- [√] 4.1 抽取 [`src/components/RemoteFileWorkbench.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/RemoteFileWorkbench.vue) 的统一文件操作执行路径 | depends_on: [1.1]
- [√] 4.2 清理重复状态、无效逻辑和多余 watcher，并完成构建验证与知识库同步 | depends_on: [2.2, 3.2, 4.1]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-22 17:21 | 方案包创建 | completed | 已生成 proposal.md 与 tasks.md |
| 2026-03-22 17:21 | 方案设计 | completed | 已确定采用工作区编排重构优先方案 |
| 2026-03-22 17:29 | 开发实施 | completed | 已完成终端会话 gating、监控可见性启停、文件工作台操作抽取与壳层清理 |
| 2026-03-22 17:30 | 构建验证 | completed | `pnpm run build` 通过 |
| 2026-03-23 09:03 | 后续结构收口 | completed | `RightPanel` 监控进一步拆为运行时拉取层与展示派生层，保留构建通过 |
| 2026-03-23 09:04 | 模板与样式拆分 | completed | `RightPanel` 监控模板/样式整体下沉到独立子组件，并再次通过 `pnpm run build` |
| 2026-03-23 09:05 | 展示块再拆分 | completed | 监控容器继续拆成 4 个无状态展示组件，并保持构建通过 |
| 2026-03-23 09:06 | 样式基座复用 | completed | 监控卡片型子组件已接入共享样式基座，并保持嵌入式紧凑布局稳定 |
| 2026-03-23 09:07 | 共享样式单点接入 | completed | `monitorShared.css` 改为容器单点引入，避免构建产物重复输出 |

---

## 执行备注

- 本轮按“最优改动”执行，不以最小修改量为目标。
- 重构以主工作区链路为边界，不扩展新的业务能力或替换底层技术栈。
- `RightPanel` 后续已继续把监控逻辑拆成 `useRightPanelMonitor + rightPanelMonitorDerived`，组件自身进一步收口为壳层装配；本轮仍未触碰模板结构，优先降低运行时与脚本复杂度。
- 随后的继续收口中，监控模板与样式也已整体迁出父组件，`RightPanel.vue` 现在只负责面板切换与传输装配，剩余可继续优化点主要转为监控子组件内部再拆分。
- 最新继续收口里，监控子组件已再按展示职责切成 `Hero / Resources / Processes / StorageNetwork` 四块，容器只保留接线与布局；后续若还要继续优化，重点将转为样式 token 进一步共享，而不是再拆业务边界。
- 当前已开始样式 token / 共享规则收口：通过 `monitorShared.css` 把卡片壳层、标题、chip 和暗色态共性样式抽成共享层，后续若继续推进，方向会是把 Hero 区再纳入同一套 token，而不是继续增加组件数量。
- 样式共享这一轮又修正了接入策略：共享样式若在每个子组件里各自 `scoped` 引入，会导致构建产物重复；现已收口为容器单点引入 + `.right-panel-monitor` 前缀约束，兼顾局部作用域与产物去重。
