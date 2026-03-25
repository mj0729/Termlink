# desktop-backend

## 职责

- 承载 Tauri Rust 后端能力，当前以 SSH 终端、SFTP、远程命令执行、系统监控和本地文件系统辅助为主
- 为前端提供统一的 Tauri command 与事件通道，保证 SSH 连接、文件操作和监控复用同一条远端传输层

## 当前实现状态

- 后端终端能力已收口为 SSH-only：`src-tauri/src/lib.rs` 不再注册本地 PTY 命令，`src-tauri/src/terminal.rs` 已移除
- `connection_manager.rs` 仍是 SSH 会话的单一事实来源，负责交互 shell、SFTP 惰性会话、远程命令执行与终端快照
- `ssh_terminal_russh.rs` 负责 Tauri command 到 SSH 会话层的薄适配，包括启动 SSH shell、写入、resize、读取快照和主机密钥确认
- `ssh.rs` 当前只保留 SSH 配置与凭据相关 CRUD，不再承担本地 PTY 清理职责

## 关键文件

- [`src-tauri/src/lib.rs`](/Users/mengjia/WebstormProjects/Termlink/src-tauri/src/lib.rs)
- [`src-tauri/src/connection_manager.rs`](/Users/mengjia/WebstormProjects/Termlink/src-tauri/src/connection_manager.rs)
- [`src-tauri/src/ssh_terminal_russh.rs`](/Users/mengjia/WebstormProjects/Termlink/src-tauri/src/ssh_terminal_russh.rs)
- [`src-tauri/src/ssh.rs`](/Users/mengjia/WebstormProjects/Termlink/src-tauri/src/ssh.rs)
- [`src-tauri/src/sftp_russh.rs`](/Users/mengjia/WebstormProjects/Termlink/src-tauri/src/sftp_russh.rs)
- [`src-tauri/src/ssh_command.rs`](/Users/mengjia/WebstormProjects/Termlink/src-tauri/src/ssh_command.rs)

## 约束与说明

- 当前产品方向是 SSH-only；若未来恢复本地终端，需要重新设计命令面和前端入口，而不是直接回滚旧 PTY 模块
- SSH shell 里申请 `pty` 属于远端伪终端能力，不等同于已删除的本地 PTY 后端
