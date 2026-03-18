# 任务清单: pnpm-migration

> **@status:** completed | 2026-03-18 11:15

```yaml
@feature: pnpm-migration
@created: 2026-03-18
@status: completed
@mode: R2
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 5 | 0 | 0 | 5 |

---

## 任务列表

### 1. 包管理器入口收敛

- [√] 1.1 更新 `package.json`，声明 `pnpm` 为项目包管理器并保持现有 scripts 兼容 | depends_on: []
- [√] 1.2 更新 `src-tauri/tauri.conf.json`，将前置开发和构建命令切换为 `pnpm run ...` | depends_on: [1.1]
- [√] 1.3 刷新 `pnpm-lock.yaml` 并移除 `package-lock.json`，确保仓库只保留 `pnpm` 锁文件 | depends_on: [1.1]

### 2. 文档与验证

- [√] 2.1 同步 `README.md`、`CLAUDE.md`、`AGENTS.md` 中的安装、开发与构建命令为 `pnpm` | depends_on: [1.2]
- [√] 2.2 使用 `pnpm install` 与 `pnpm run build` 验证切换结果，并记录残留风险 | depends_on: [1.3, 2.1]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-18 11:14 | 方案包初始化 | 完成 | 已创建 `pnpm-migration` 方案包并完成任务拆解 |
| 2026-03-18 11:20 | 1.1/1.2/2.1 | 完成 | 已将 `package.json`、`tauri.conf.json` 与根目录文档统一切换为 `pnpm` |
| 2026-03-18 11:23 | 1.3/2.2 | 完成 | 使用 npm 官方源执行 `pnpm install --no-frozen-lockfile` 刷新锁文件，随后 `pnpm run build` 通过 |

---

## 执行备注

- 当前仓库存在未提交改动，本次实施仅处理与 pnpm 切换直接相关的文件。
- `pnpm install` 提示 `esbuild@0.27.4` 的 build scripts 被忽略；本次前端构建仍已通过，后续如需放开可执行 `pnpm approve-builds`。
