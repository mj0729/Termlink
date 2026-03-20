# 任务清单: monitor-collapse-button-edge

> **@status:** completed | 2026-03-20 15:12

```yaml
@feature: monitor-collapse-button-edge
@created: 2026-03-20
@status: completed
@mode: R2
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 4 | 0 | 0 | 4 |

---

## 任务列表

### 1. 方案与上下文

- [√] 1.1 固定折叠按钮贴右的布局方向，补全方案包中的需求、约束、验收标准和实现方式 | depends_on: []

### 2. 监控头部布局调整

- [√] 2.1 调整 `/Users/mengjia/WebstormProjects/Termlink/src/components/RightPanel.vue` 的监控头部模板，将折叠按钮移出标题行并放入右侧工具区 | depends_on: [1.1]
- [√] 2.2 调整 `/Users/mengjia/WebstormProjects/Termlink/src/components/RightPanel.vue` 的头部样式，确保折叠按钮贴右且不挤压标题信息 | depends_on: [2.1]

### 3. 验证与知识库同步

- [√] 3.1 运行 `pnpm run build` 验证改动可构建，并同步更新知识库文档与 CHANGELOG | depends_on: [2.2]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-20 15:07:00 | 1.1 | 完成 | 已确认将折叠按钮移动到监控卡片头部最右侧 |
| 2026-03-20 15:09:30 | 2.1 | 完成 | `RightPanel.vue` 已将折叠按钮移出标题行，挂到右侧工具区 |
| 2026-03-20 15:09:30 | 2.2 | 完成 | 头部工具区新增操作组样式，折叠按钮保持最右贴边 |
| 2026-03-20 15:11:26 | 3.1 | 完成 | `pnpm run build` 通过，开始同步知识库文档与变更记录 |

---

## 执行备注

> 本任务属于 `simple` 级别单组件布局优化，不改数据结构、不改交互协议，只调整监控头部模板与样式收口。
>
> 验证说明:
> - 已执行 `pnpm run build`，构建成功。
> - 构建过程中仍出现仓库既有的 vendor circular chunk / chunk size 提示，本轮未处理。
