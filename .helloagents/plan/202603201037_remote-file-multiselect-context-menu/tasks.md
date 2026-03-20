# 任务清单: remote-file-multiselect-context-menu

```yaml
@feature: remote-file-multiselect-context-menu
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

### 1. 方案与交互建模

- [√] 1.1 明确远程文件多选、右键作用域与批量删除交互约定 | depends_on: []
- [√] 1.2 补全方案包 `proposal.md` / `tasks.md` 并固定验收标准 | depends_on: [1.1]

### 2. 远程文件工作台实现

- [√] 2.1 在 `src/components/RemoteFileWorkbench.vue` 中实现路径集合驱动的单选/多选状态 | depends_on: [1.2]
- [√] 2.2 在 `src/components/RemoteFileWorkbench.vue` 中实现拖拽框选与批量右键菜单、批量删除 | depends_on: [2.1]

### 3. 文档与验证

- [√] 3.1 更新 `.helloagents/modules/ui-components.md`、`CHANGELOG.md`，同步新交互行为 | depends_on: [2.2]
- [√] 3.2 运行 `pnpm run build` 完成回归验证，并记录结果 | depends_on: [3.1]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-20 10:38 | 1.1 | 已完成 | 确认右键命中已选中项时作用于整组选中项 |
| 2026-03-20 10:39 | 1.2 | 已完成 | 已创建并补全 implementation 方案包 |
| 2026-03-20 10:47 | 2.1 | 已完成 | 远程文件选择状态改为路径集合，补齐单选/多选主选中项 |
| 2026-03-20 10:49 | 2.2 | 已完成 | 已实现拖拽框选、批量右键菜单与批量删除 |
| 2026-03-20 10:52 | 3.1 | 已完成 | 已同步 ui-components 模块文档与 CHANGELOG |
| 2026-03-20 10:53 | 3.2 | 已完成 | `pnpm run build` 通过，仍存在既有 circular chunk 提示 |

---

## 执行备注

- 多选状态以远程路径作为唯一键，避免名称重复导致选中错乱
- 本轮只改 `RemoteFileWorkbench.vue`，旧 `FileManager.vue` 不在范围内
