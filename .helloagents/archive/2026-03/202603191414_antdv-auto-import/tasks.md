# 任务清单: antdv-auto-import

> **@status:** completed | 2026-03-19 14:23

```yaml
@feature: antdv-auto-import
@created: 2026-03-19
@status: completed
@mode: R2
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 5 | 0 | 0 | 5 |

---

## 任务列表

### 1. 方案与接入设计

- [√] 1.1 完善方案包内容，记录自动按需注册方案、边界与风险 | depends_on: []
- [√] 1.2 分析项目实际使用的 `a-*` 组件与脚本 API，确定 resolver 与 auto-import 范围 | depends_on: [1.1]

### 2. 实施与验证

- [√] 2.1 接入 `unplugin-vue-components` 与 `unplugin-auto-import`，并切除 `app.use(AntdvNext)` | depends_on: [1.2]
- [√] 2.2 清理项目中 `message / Modal / Input` 的手工 `antdv-next` 导入并生成声明文件 | depends_on: [2.1]
- [√] 2.3 构建验证、知识库同步与执行记录收口 | depends_on: [2.2]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-19 14:14:00 | 1.1 | 完成 | 已创建方案包并记录自动按需注册目标与约束 |
| 2026-03-19 14:16:00 | 1.2 | 完成 | 已确认当前项目模板组件与脚本 API 的实际使用范围 |
| 2026-03-19 14:19:00 | 2.1 | 完成 | 已接入自动组件解析与自动导入插件，并移除 `app.use(AntdvNext)` |
| 2026-03-19 14:20:00 | 2.2 | 完成 | 已清理手工导入并生成 `src/auto-imports.d.ts` / `src/components.d.ts` |
| 2026-03-19 14:22:00 | 2.3 | 完成 | 构建与类型检查通过，`antdv-next` 产物继续收缩且 circular chunk 提示消失 |

---

## 执行备注

> 记录执行过程中的重要说明、决策变更、风险提示等
> 说明:
> - 当前脚本侧自动导入仅覆盖 `Input`、`Modal`、`message`，保持范围收敛，避免引入过大的隐式依赖面。
> - 模板组件解析使用项目定制 resolver，优先保证当前仓库稳定，不追求一次性覆盖全部 `antdv-next` 组件命名变体。
