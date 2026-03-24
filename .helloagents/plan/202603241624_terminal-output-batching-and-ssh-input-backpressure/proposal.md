# 变更提案: terminal-output-batching-and-ssh-input-backpressure

## 元信息
```yaml
类型: 优化
方案类型: implementation
优先级: P1
状态: 已确认
创建: 2026-03-24
```

---

## 1. 需求

### 背景
当前终端链路已经完成前端补全侧的第一轮优化，但后端输出仍然以逐 chunk 事件的方式推送到前端。SSH 连接管理器使用无界命令队列，本地 PTY 也按 reader 每次读到的数据直接 `emit`。在服务器突发输出或本地命令大量刷屏时，事件风暴和无界排队都会放大主线程压力与内存峰值。

### 目标
- 为 SSH 终端输出增加短窗口批量聚合，降低 burst 输出时的事件频率。
- 为本地 PTY 输出增加同样的批量聚合策略，统一本地与 SSH 终端的输出行为。
- 将 SSH 命令输入队列从无界改为有界，避免极端情况下积压过多待处理输入。

### 约束条件
```yaml
性能约束: 聚合窗口控制在约 8ms，优先压缩 emit 次数，不明显增加交互延迟
兼容性约束: 保持现有 `ssh_data://` / `pty://` 事件协议和前端消费逻辑不变
稳定性约束: 不破坏 SSH 快照恢复、终端关闭、断连和命令执行流程
范围约束: 本次仅修改终端后端链路，不扩展到前端 UI 与协议重构
```

### 验收标准
- [ ] SSH 终端输出改为批量聚合后再 `emit`，突发输出时事件数量明显下降。
- [ ] 本地 PTY 输出采用相同的聚合窗口，不再每次 read 都直接推送事件。
- [ ] SSH 输入队列改为 bounded 64，不再使用无界 channel。
- [ ] `read_ssh_terminal_snapshot`、断连和终端关闭场景不会丢失聚合缓冲中的尾部输出。
- [ ] 项目可通过 `cargo check --manifest-path src-tauri/Cargo.toml` 与 `pnpm run build` 验证。

---

## 2. 方案

### 技术方案
在现有 Tauri 后端链路上做局部收口，不改事件名、不改前端协议。

具体策略：
- 在 `connection_manager.rs` 内为 SSH 终端增加待刷出缓冲区与 8ms flush deadline。
- 将 SSH 输出的 `ChannelMsg::Data` 先写入聚合缓冲，命中时间窗或字节上限后再统一生成 `TerminalChunk`、写入 snapshot buffer 并 `emit`。
- 在读取快照、断开连接、接收到 EOF/Close/ExitStatus 等路径上强制 flush，避免尾部输出滞留。
- 将 SSH 管理器命令通道改为 `tokio::sync::mpsc::channel(64)`，写入和缩放命令改走异步 send，形成自然背压。
- 在 `terminal.rs` 中为本地 PTY 增加 reader → aggregator → emit 的两段式线程，把原本按 read 推送的输出改成按窗口批量推送。

### 影响范围
```yaml
涉及模块:
  - connection_manager: SSH 终端输出聚合、快照时机、有界命令队列
  - ssh_terminal_russh: Tauri command 改为异步写入/缩放入口
  - terminal: 本地 PTY 输出批量聚合
预计变更文件: 3
```

### 风险评估
| 风险 | 等级 | 应对 |
|------|------|------|
| 聚合窗口引入感知延迟 | 低 | 窗口固定在约 8ms，并在缓冲超限或关键路径时立即 flush |
| SSH 快照遗漏未刷出数据 | 中 | 在 `GetTerminalSnapshot`、EOF/Close/Disconnect 前统一 flush |
| bounded 队列导致输入阻塞 | 中 | 将写入入口改为 async send，让背压体现在 command future 上而不是内存膨胀 |

---

## 3. 技术设计（可选）

N/A。本次不涉及协议与前端数据结构变更。

---

## 4. 核心场景

### 场景: SSH 会话突发输出
**模块**: connection_manager
**条件**: 远端命令或日志流产生连续大量输出
**行为**: SSH 管理器将多个 `ChannelMsg::Data` 聚合后统一推送
**结果**: 前端接收到的 `ssh_data://` 事件数量下降，但显示内容和顺序保持一致

### 场景: 本地 PTY 刷屏
**模块**: terminal
**条件**: 本地 shell 输出持续刷屏
**行为**: PTY reader 将多个 read chunk 通过短窗口聚合，再统一 `emit`
**结果**: 本地终端减少事件风暴，保持现有显示协议

---

## 5. 技术决策

### terminal-output-batching-and-ssh-input-backpressure#D001: 保持现有事件协议，仅在后端增加聚合与背压
**日期**: 2026-03-24
**状态**: ✅采纳
**背景**: 现有性能问题集中在后端推送频率和无界排队，而不是前端订阅协议本身失效。
**选项分析**:
| 选项 | 优点 | 缺点 |
|------|------|------|
| A: 后端局部聚合 + bounded 队列 | 改动集中、协议兼容、可直接命中事件风暴与内存峰值问题 | 仍保留事件驱动架构，不是根本性重构 |
| B: 重做前后端流协议 | 理论上可进一步压缩开销 | 成本高，会触及终端绑定、快照恢复和前端消费路径 |
**决策**: 选择方案A
**理由**: 当前优化目标明确，优先用最小改动收掉最贵的热点。
**影响**: 主要影响 Tauri 后端终端链路；前端调用方式仅同步到异步 command 入口，不改业务接口。

---

## 6. 成果设计

N/A。本次不涉及视觉产出。
