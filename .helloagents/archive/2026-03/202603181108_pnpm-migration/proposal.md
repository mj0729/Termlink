# 变更提案: pnpm-migration

## 元信息
```yaml
类型: 优化
方案类型: implementation
优先级: P1
状态: 已完成
创建: 2026-03-18
```

---

## 1. 需求

### 背景
仓库当前同时存在 `package-lock.json` 和 `pnpm-lock.yaml`，但实际配置和文档仍以 `npm` 为主。`src-tauri/tauri.conf.json` 的前置命令、根目录说明文档以及协作说明文件都还在引导使用 `npm`，这会让依赖安装、锁文件维护和桌面构建入口出现双轨状态。

### 目标
- 将项目的唯一推荐包管理器切换为 `pnpm`
- 保持现有 Vite 与 Tauri 的开发、构建入口不变，只替换命令调用方式
- 清理 `npm` 锁文件并刷新 `pnpm` 锁文件，避免双锁文件并存

### 约束条件
```yaml
时间约束: 本次改动需在当前工作树基础上完成，避免影响已有功能性修改
性能约束: 不引入额外运行时依赖，不改变现有前端构建产物逻辑
兼容性约束: 保持 package.json scripts、Tauri 构建流程和现有依赖版本兼容
业务约束: 仅收敛到 pnpm，不顺带调整功能代码或依赖版本策略
```

### 验收标准
- [x] [package.json](/Users/mengjia/WebstormProjects/Termlink/package.json) 明确声明 `pnpm` 为项目包管理器
- [x] [src-tauri/tauri.conf.json](/Users/mengjia/WebstormProjects/Termlink/src-tauri/tauri.conf.json) 的前置开发与构建命令改为 `pnpm`
- [x] 根目录仅保留 `pnpm-lock.yaml`，移除 `package-lock.json`
- [x] 相关项目文档中的安装、开发、构建命令统一切换为 `pnpm`
- [x] 通过 `pnpm install` 与 `pnpm run build` 完成一次实际验证

---

## 2. 方案

### 技术方案
以“单一包管理器收敛”为原则做最小变更：

- 在 [package.json](/Users/mengjia/WebstormProjects/Termlink/package.json) 中增加 `packageManager` 字段，声明当前仓库采用 `pnpm`
- 保留现有 scripts 名称，仅把所有外部调用入口改为 `pnpm run ...`
- 删除 `package-lock.json`，使用 `pnpm install` 重新生成或校准 [pnpm-lock.yaml](/Users/mengjia/WebstormProjects/Termlink/pnpm-lock.yaml)
- 同步更新 [README.md](/Users/mengjia/WebstormProjects/Termlink/README.md)、[CLAUDE.md](/Users/mengjia/WebstormProjects/Termlink/CLAUDE.md) 和 [AGENTS.md](/Users/mengjia/WebstormProjects/Termlink/AGENTS.md) 中的命令说明

### 影响范围
```yaml
涉及模块:
  - app-shell: 包管理器声明与 Tauri 前置命令切换
  - knowledge-base-docs: 开发文档与协作说明同步到 pnpm
预计变更文件: 6
```

### 风险评估
| 风险 | 等级 | 应对 |
|------|------|------|
| 现有 `pnpm-lock.yaml` 与 package 声明不一致 | 中 | 通过 `pnpm install` 刷新锁文件后再执行构建验证 |
| Tauri 仍引用旧的 `npm` 命令 | 中 | 同步更新 `beforeDevCommand` 和 `beforeBuildCommand` 并用 `pnpm run build` 验证 |
| 文档遗漏导致团队继续混用包管理器 | 低 | 全量检索项目内 `npm` 相关说明并统一替换 |

---

## 3. 技术设计（可选）

> 涉及架构变更、API设计、数据模型变更时填写

### 架构设计
N/A

### API设计
N/A

### 数据模型
N/A

---

## 4. 核心场景

> 执行完成后同步到对应模块文档

### 场景: 使用 pnpm 进行本地开发与构建
**模块**: app-shell
**条件**: 开发者在项目根目录执行依赖安装、开发或构建命令
**行为**: 系统文档、包管理器声明与 Tauri 前置命令全部指向 `pnpm`
**结果**: 开发者仅需使用 `pnpm install`、`pnpm run dev`、`pnpm run build` 或 `pnpm run tauri:*` 即可完成工作流

---

## 5. 技术决策

> 本方案涉及的技术决策，归档后成为决策的唯一完整记录

### pnpm-migration#D001: 采用 pnpm 作为唯一包管理器入口
**日期**: 2026-03-18
**状态**: ✅采纳
**背景**: 仓库已出现 `npm` 与 `pnpm` 双轨并存，锁文件和文档入口不一致会增加依赖漂移和协作成本。
**选项分析**:
| 选项 | 优点 | 缺点 |
|------|------|------|
| A: 保持 npm/pnpm 双兼容 | 对现有习惯更宽容 | 锁文件持续双写，Tauri 与文档入口难以统一 |
| B: 全量切换到 pnpm | 锁文件、命令入口和协作约定单一清晰 | 需要一次性更新配置与文档，并删除 package-lock |
**决策**: 选择方案B
**理由**: 用户目标是“把项目 npm 改为 pnpm”，而且仓库已经存在 `pnpm-lock.yaml` 与可用的 pnpm 环境，直接收敛为单一入口能减少后续维护成本。
**影响**: 影响根目录包管理器声明、Tauri 前置构建命令、安装与构建文档，以及知识库中的技术栈记录

---

## 6. 成果设计

> 含视觉产出的任务由 DESIGN Phase2 填充。非视觉任务整节标注"N/A"。

### 设计方向
- **美学基调**: N/A
- **记忆点**: N/A
- **参考**: 无

### 视觉要素
- **配色**: N/A
- **字体**: N/A
- **布局**: N/A
- **动效**: N/A
- **氛围**: N/A

### 技术约束
- **可访问性**: N/A
- **响应式**: N/A
