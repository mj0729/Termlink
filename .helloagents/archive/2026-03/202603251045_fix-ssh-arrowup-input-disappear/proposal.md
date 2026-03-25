# 变更提案: fix_ssh_arrowup_input_disappear

## 元信息
```yaml
类型: 修复
方案类型: implementation
优先级: P1
状态: 已确认
创建: 2026-03-25
```

---

## 1. 需求

### 背景
当前 SSH 终端在已连接状态下按上键调出历史命令时，提示符会消失，并且后续输入看起来无法继续显示，导致远程命令行基本不可用。

### 目标
- 修复 SSH 终端按 `ArrowUp` 后提示符/输入行异常消失的问题。
- 保证历史命令回显后仍可继续输入，不破坏现有 SSH 终端连接、广播和联想逻辑。

### 约束条件
```yaml
时间约束: 本次只修最小范围的 SSH 终端上键问题
性能约束: 不能给终端输入链路引入明显卡顿或重复重绘
兼容性约束: 保持现有 xterm.js + Tauri SSH 通信链路不变
业务约束: 不顺带修改本地终端和其他命令行功能
```

### 验收标准
- [ ] SSH 终端按上键可正常调出历史命令，不再出现提示符消失
- [ ] 调出历史命令后继续输入字符，输入内容能正常显示并发送到远端
- [ ] 现有终端尺寸同步、连接恢复和普通输入流程不回归

---

## 2. 方案

### 技术方案
收口为单一 SSH shell integration 协议，并补一层显式 SSH 终端尺寸同步：
- 删除 `SshService` 中旧的 `PROMPT_COMMAND/cd()` cwd bootstrap，避免它与 `terminalShellIntegration.ts` 重复改写 prompt/cwd hook。
- 抽出当前 xterm 可见列宽/行高到 SSH PTY 的同步函数，并缓存上次已同步尺寸，避免重复发送。
- 在终端连接完成、终端激活与重新 `fit` 后补发一次窗口尺寸，确保远端 shell 的行编辑器使用最新尺寸。

### 影响范围
```yaml
涉及模块:
  - Terminal: SSH 终端尺寸同步与输入体验修复
预计变更文件: 4
```

### 风险评估
| 风险 | 等级 | 应对 |
|------|------|------|
| 额外尺寸同步导致重复 `window_change` 调用 | 低 | 缓存最近一次同步尺寸，只在变化或强制场景下发送 |
| 误伤本地终端输入链路 | 低 | 同步逻辑仅在 SSH 且已连接时生效 |

---

## 3. 技术设计（可选）

本次为局部行为修复，不涉及架构、API 或数据模型变更，N/A。

---

## 4. 核心场景

> 执行完成后同步到对应模块文档

### 场景: SSH 终端历史命令回显
**模块**: Terminal
**条件**: SSH 会话已建立，用户位于可交互 shell 提示符
**行为**: 用户按 `ArrowUp` 调出历史命令，再继续输入字符
**结果**: 提示符与历史命令正常显示，后续输入持续可见且可发送

---

## 5. 技术决策

> 本方案涉及的技术决策，归档后成为决策的唯一完整记录

### fix_ssh_arrowup_input_disappear#D001: 统一到单一 shell integration 协议并补齐 SSH PTY 尺寸同步
**日期**: 2026-03-25
**状态**: ✅采纳
**背景**: SSH 会话建立后同时存在两套 shell hook 注入：`SshService` 的旧 cwd bootstrap 会改写 `PROMPT_COMMAND` 和 `cd()`，`Terminal` 的新 `terminalShellIntegration` 又会追加 prompt/cwd marker。双重注入会干扰 readline 历史重绘；此外连接恢复和首帧激活阶段还可能继续带着过期列宽。
**选项分析**:
| 选项 | 优点 | 缺点 |
|------|------|------|
| A: 移除旧 bootstrap，只保留 `terminalShellIntegration`，并补充尺寸同步 | 根因更直接，避免 prompt/cwd hook 打架，同时保留现有 marker 协议 | 需要确认不会影响环境变量和启动任务 |
| B: 只补 `Terminal.vue` 尺寸同步 | 改动更小 | 无法解决双重 prompt 注入造成的 readline 重绘异常 |
**决策**: 选择方案 A
**理由**: 当前最可疑的异常点是重复注入 prompt/cwd hook。统一到单一协议后，再由 `Terminal.vue` 补齐尺寸同步，能同时覆盖“提示符重绘错乱”和“过期列宽”两条风险链路。
**影响**: 影响 `src/services/SshService.ts` 的连接后 bootstrap，和 `src/components/Terminal.vue` 的 SSH 输入与 resize 同步逻辑

---

## 6. 成果设计

> 含视觉产出的任务由 DESIGN Phase2 填充。非视觉任务整节标注"N/A"。

N/A（非视觉任务）
