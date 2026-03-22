# 任务清单: tab-context-menu-ssh-actions

```yaml
@feature: tab-context-menu-ssh-actions
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

### 1. 标签右键菜单实现

- [√] 1.1 在 `src/components/TabManager.vue` 中接入右键菜单，并按标签类型与 SSH 状态生成禁用态 | depends_on: []
- [√] 1.2 在 `src/App.vue`、`src/services/SshService.ts` 与 `src/types/app.ts` 中补齐 SSH 标签连接状态、手动断开保留标签以及菜单动作分发 | depends_on: [1.1]

### 2. 验证与文档同步

- [√] 2.1 运行构建验证并同步 `.helloagents` 模块文档与 CHANGELOG 记录 | depends_on: [1.2]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-20 16:54 | 方案包创建 | completed | 已创建 implementation 类型方案包 |
| 2026-03-20 17:00 | 1.1 | completed | 标签栏已接入文件管理同款右键菜单与菜单禁用态 |
| 2026-03-20 17:02 | 1.2 | completed | SSH 标签新增连接状态，并支持手动断开后保留标签再连接 |
| 2026-03-20 17:04 | 2.1 | completed | `pnpm run build` 通过，并已同步模块文档与 CHANGELOG |

---

## 执行备注

> 记录执行过程中的重要说明、决策变更、风险提示等

- `连接全部` 采用顺序重连，避免多个 SSH 标签同时弹出密码输入
- 断开 SSH 连接时保留标签，只更新标签状态点与菜单禁用态
