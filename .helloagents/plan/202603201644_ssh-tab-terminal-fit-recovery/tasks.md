# 任务清单: ssh-tab-terminal-fit-recovery

```yaml
@feature: ssh-tab-terminal-fit-recovery
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

### 1. 方案设计与实施

- [√] 1.1 在 `src/components/SshWorkspace.vue` 中修复隐藏状态下的分栏高度同步，并在标签重新激活时恢复布局 | depends_on: []
- [√] 1.2 验证 `Terminal` 的尺寸刷新链路与 SSH 工作区恢复逻辑协同正常，并完成必要的最小代码补强 | depends_on: [1.1]

### 2. 验证与文档同步

- [√] 2.1 运行构建验证并同步 `.helloagents` 模块文档与 CHANGELOG 记录 | depends_on: [1.2]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-20 16:44 | 方案包创建 | completed | 已创建 implementation 类型方案包 |
| 2026-03-20 16:47 | 1.1 | completed | 已为 SSH 工作区增加隐藏态保护和激活后的双帧布局恢复 |
| 2026-03-20 16:48 | 1.2 | completed | 已确认通过窗口级 resize 刷新终端 fit 链路 |
| 2026-03-20 16:49 | 2.1 | completed | `pnpm run build` 通过，并已同步模块文档与 CHANGELOG |

---

## 执行备注

> 记录执行过程中的重要说明、决策变更、风险提示等

- 本次修复范围限定为 SSH 工作区切换标签后的终端高度恢复问题
- 自动化验证已完成构建校验，实际标签切换交互仍需在应用内手动复现确认
