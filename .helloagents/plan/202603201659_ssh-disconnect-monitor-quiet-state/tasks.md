# 任务清单: ssh-disconnect-monitor-quiet-state

```yaml
@feature: ssh-disconnect-monitor-quiet-state
@created: 2026-03-20
@status: completed
@mode: R2
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 3 | 0 | 0 | 3 |

---

## 任务列表

### 1. 断开后监控状态修复

- [√] 1.1 在 `src/App.vue` 与 `src/components/SshWorkspace.vue` 中让监控使用的 `connectionId` 只在 SSH 连接有效时传递 | depends_on: []
- [√] 1.2 在 `src/components/RightPanel.vue` 中停止断开后的轮询、禁用刷新并切换为静态断开文案 | depends_on: [1.1]

### 2. 验证与文档同步

- [√] 2.1 运行构建验证并同步 `.helloagents` 模块文档与 CHANGELOG 记录 | depends_on: [1.2]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-20 16:59 | 方案包创建 | completed | 已创建 implementation 类型方案包 |
| 2026-03-20 17:05 | 1.1 | completed | 监控连接 ID 已与 SSH 标签连接状态解耦 |
| 2026-03-20 17:07 | 1.2 | completed | 监控断开后改为静态状态并静默停止轮询 |
| 2026-03-20 17:09 | 2.1 | completed | `pnpm run build` 通过，并已同步模块文档与 CHANGELOG |

---

## 执行备注

> 记录执行过程中的重要说明、决策变更、风险提示等

- 断开后保留已有监控面板壳子和最近一次静态数据，但不再继续刷新
- 正常连接路径下的监控刷新策略保持不变
