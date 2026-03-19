# 任务清单: frontend-antdv-unification

> **@status:** completed | 2026-03-19 13:54

```yaml
@feature: frontend-antdv-unification
@created: 2026-03-19
@status: completed
@mode: R2
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
|------|------|------|------|
| 7 | 0 | 0 | 7 |

---

## 任务列表

### 1. 方案与审查范围

- [√] 1.1 完善方案包内容，记录本轮高价值替换范围、风险和保留项 | depends_on: []
- [√] 1.2 完成前端 review 基线，标记应替换与应保留的原生实现 | depends_on: [1.1]

### 2. 组件统一改造

- [√] 2.1 在 `/Users/mengjia/WebstormProjects/Termlink/src/components/StatusBar.vue` 中将原生图标按钮替换为 `a-button` | depends_on: [1.2]
- [√] 2.2 在 `/Users/mengjia/WebstormProjects/Termlink/src/components/ConnectionHub.vue` 中将分组筛选与连接卡片统一到 `a-segmented` / `a-card` / `a-tag` | depends_on: [1.2]
- [√] 2.3 在 `/Users/mengjia/WebstormProjects/Termlink/src/components/RightPanel.vue` 中将传输筛选按钮替换为 `a-segmented` | depends_on: [1.2]

### 3. 验证与知识库同步

- [√] 3.1 执行 `pnpm run build` 并修复本轮改动引入的问题 | depends_on: [2.1, 2.2, 2.3]
- [√] 3.2 同步方案进度、知识库与 CHANGELOG，并输出 review 结论 | depends_on: [3.1]

---

## 执行日志

| 时间 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-19 13:46:00 | 1.1 | 完成 | 已创建方案包并填充本轮高价值统一改造目标与约束 |
| 2026-03-19 13:49:00 | 2.1/2.2/2.3 | 完成 | 已将状态栏、连接中心和传输筛选切到 `antdv-next` 组件骨架 |
| 2026-03-19 13:51:00 | 3.1 | 完成 | `pnpm run build` 与 `pnpm exec vue-tsc --noEmit` 均通过 |
| 2026-03-19 13:53:00 | 3.2 | 完成 | 已同步模块文档与变更记录，并补充 review 说明 |

---

## 执行备注

> 说明:
> - `FileEditor.vue` 中的大文本 `textarea` 保留为原生实现，原因是其承担长文本加载、搜索定位与低开销编辑行为。
> - 隐藏文件上传 `input` 继续保留，因其直接承接桌面文件选择能力，不属于用户可见 UI 风格统一范畴。
> - `TopMenu.vue` 当前未接入主应用壳层，本轮仅在 review 中记录其仍有原生按钮遗留，未纳入高价值统一范围。
