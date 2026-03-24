# 任务清单: ssh-cwd-sync-linux

> **@status:** completed | 2026-03-24 13:16

```yaml
@feature: ssh-cwd-sync-linux
@created: 2026-03-24
@status: completed
@mode: R2
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 3 | 0 | 0 | 3 |

---

## 任务列表

### 1. 终端 cwd 同步修复

- [√] 1.1 在 `src/components/Terminal.vue` 中移除独立 `pwd` 兜底，并改为维护会话内 cwd 候选目录 | depends_on: []
- [√] 1.2 在 `src/components/Terminal.vue` 中补充简单 `cd` 命令解析、失败识别和提示符回填逻辑 | depends_on: [1.1]

### 2. 验证与记录

- [√] 2.1 运行前端构建验证修复未引入类型或打包错误，并同步方案包/变更记录 | depends_on: [1.2]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-24 13:09 | 方案包初始化 | completed | 已创建 proposal.md 与 tasks.md |
| 2026-03-24 13:14 | 1.1 / 1.2 | completed | 已改为会话内 `cd` 候选目录推导，移除独立 `pwd` 兜底 |
| 2026-03-24 13:15 | 2.1 | completed | `pnpm run build` 通过 |

---

## 执行备注

> 优先保证当前交互终端目录与文件管理一致；复杂 shell 语法保持保守，不为覆盖边缘命令牺牲已有稳定路径。
>
> 本次未新增远端 bootstrap 命令，避免在 SSH 终端首屏注入可见脚本；目录同步依旧优先信任 `TERMLINK_CWD` 标记，其次才使用提示符和输入推导兜底。
