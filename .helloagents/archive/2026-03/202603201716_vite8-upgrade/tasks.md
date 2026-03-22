# 任务清单: vite8-upgrade

> **@status:** completed | 2026-03-20 17:36

```yaml
@feature: vite8-upgrade
@created: 2026-03-20
@status: completed
@mode: R2
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 6 | 0 | 0 | 6 |

---

## 任务列表

### 1. 方案与现状确认

- [√] 1.1 完善方案包内容，记录 `Vite 8` 升级目标、兼容边界、验证基线与风险 | depends_on: []
- [√] 1.2 复核当前 `package.json`、`vite.config.ts`、`src-tauri/tauri.conf.json` 与知识库中的构建现状，明确本轮升级涉及面 | depends_on: [1.1]

### 2. 升级与兼容处理

- [√] 2.1 升级 `vite` 与直接相关插件版本，刷新锁文件并确认最终落版 | depends_on: [1.2]
- [√] 2.2 按 `Vite 8` 实际行为调整 `vite.config.ts` 或相关脚本，消除升级导致的兼容问题 | depends_on: [2.1]

### 3. 验证与知识库同步

- [√] 3.1 执行 `pnpm run build` 与 `cargo check --manifest-path src-tauri/Cargo.toml`，修复本轮升级引入的问题 | depends_on: [2.2]
- [√] 3.2 同步知识库、CHANGELOG 与执行记录，沉淀 `Vite 8` 升级结果和残余风险 | depends_on: [3.1]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-20 17:18:00 | 1.1/1.2 | 完成 | 已创建并校验方案包，补齐升级目标、兼容边界和现状分析 |
| 2026-03-20 17:24:00 | 2.1 | 完成 | 已将 `vite` 升级到 `8.0.1`，`@vitejs/plugin-vue` 升级到 `6.0.5`，并刷新锁文件 |
| 2026-03-20 17:26:00 | 2.2 | 完成 | 现有 `vite.config.ts` 在 `Vite 8` 下可直接工作，无需额外兼容改码 |
| 2026-03-20 17:28:00 | 3.1 | 完成 | `pnpm run build` 与 `cargo check --manifest-path src-tauri/Cargo.toml` 均通过 |
| 2026-03-20 17:33:00 | 3.2 | 完成 | 已同步知识库、CHANGELOG 与方案包执行记录，记录 Tailwind Vite 插件 peer 残余风险 |

---

## 执行备注

> 说明:
> - 本轮业务代码与 `vite.config.ts` 均未改动，核心变更集中在 `package.json` 与 `pnpm-lock.yaml` 的构建链升级。
> - `Vite 8` 构建已成功，但当前产物仍会因 `monaco` 和 `antdv-next` 大块文件触发 `>500 kB` 告警。
> - `@tailwindcss/vite@4.2.1` 对 `Vite 8` 仍有安装期 peer 警告；现阶段属于“官方声明未跟上、实际构建可用”的已知残余风险。
