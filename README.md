# Termlink

一个基于 Tauri 2.x + Vue 3 + Rust 构建的现代化跨平台终端管理工具，提供 SSH 终端会话、SFTP 文件管理、远程系统监控等功能。

## 主要功能

### 终端管理
- **多标签页** - 同时管理多个本地/远程终端会话
- **本地终端** - 基于 PTY 的本地命令行环境
- **SSH 连接** - 支持密码和私钥认证，基于 russh 实现
- **高级 SSH** - 支持 `ProxyJump` 堡垒机、`~/.ssh/config` 导入、本地端口转发
- **会话持久化** - 保存和复用连接配置，密码通过系统钥匙串安全存储
- **多会话工作区** - SSH 工作区支持分屏 pane 与广播输入

### 文件管理
- **SFTP 文件浏览器** - 远程目录树浏览、文件操作
- **文件编辑** - 集成 Monaco Editor，支持远程文件在线编辑
- **文件传输** - 上传、下载，支持进度显示
- **本地文件浏览** - 本地文件系统导航

### 远程监控
- **系统信息** - 远程主机 CPU、内存、磁盘、网络实时监控
- **进程概览** - 远程进程状态统计
- **独立连接** - 监控使用独立 SSH 连接，不干扰终端会话

### 界面
- **主题切换** - 深色/浅色主题，CSS 变量驱动
- **可折叠面板** - 左侧边栏、右侧面板均可折叠
- **连接中心** - ConnectionHub 集中管理所有连接配置
- **状态栏** - 显示连接状态和系统信息

### 快捷键
| 快捷键 | 功能 |
|--------|------|
| `Ctrl + T` | 新建本地终端 |
| `Ctrl + W` | 关闭当前标签页 |
| `Ctrl + Shift + T` | 新建 SSH 连接 |

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 桌面框架 | Tauri | 2.x |
| 前端框架 | Vue 3 (Composition API + `<script setup>`) | 3.5+ |
| UI 组件库 | Ant Design Vue Next (antdv-next) | 1.x |
| 样式 | Tailwind CSS | 4.x |
| 终端模拟 | xterm.js | 5.x |
| 代码编辑器 | Monaco Editor | 0.52+ |
| 构建工具 | Vite | 8.x |
| 语言 | TypeScript + Rust (edition 2021) | TS 5.x / Rust 1.77.2+ |
| SSH 协议 | russh + russh-sftp | 0.57 / 2.1 |
| 本地终端 | portable-pty | 0.9 |
| 凭证存储 | keyring | 3.x |
| 异步运行时 | tokio | 1.x |
| 包管理 | pnpm | 10.28+ |

## 安装和运行

### 环境要求
- Node.js 18+
- Rust 1.77.2+
- pnpm 10.28.0+
- 操作系统: Windows / macOS / Linux

### 开发模式

```bash
# 安装前端依赖
pnpm install

# 启动开发服务器（Vite + Tauri）
cargo tauri dev
```

### 构建发布版本

```bash
# 构建应用
cargo tauri build

# 产物路径: src-tauri/target/release/bundle/
```

### 其他命令

```bash
# 仅启动前端开发服务器
pnpm run dev

# 仅构建前端
pnpm run build

# 运行前端关键路径回归
pnpm run test:regression

# 运行 Rust 测试
cargo test --manifest-path src-tauri/Cargo.toml
```

## 项目结构

```
Termlink/
├── src/                          # 前端 (Vue 3 + TypeScript)
│   ├── components/
│   │   ├── App.vue               # 根组件
│   │   ├── Terminal.vue          # xterm.js 终端组件
│   │   ├── TabManager.vue        # 标签页管理
│   │   ├── Sidebar.vue           # 左侧边栏
│   │   ├── RightPanel.vue        # 右侧面板（监控/下载）
│   │   ├── ConnectionHub.vue     # 连接中心
│   │   ├── SshWorkspace.vue      # SSH 工作区
│   │   ├── SshModal.vue          # SSH 连接对话框
│   │   ├── FileManager.vue       # 远程文件管理器
│   │   ├── RemoteFileWorkbench.vue # 远程文件工作台
│   │   ├── FileEditor.vue        # Monaco 文件编辑器
│   │   ├── SystemMonitor.vue     # 系统监控面板
│   │   ├── DownloadManager.vue   # 下载管理器
│   │   ├── TopMenu.vue           # 顶部菜单栏
│   │   ├── SettingsModal.vue     # 设置对话框
│   │   └── StatusBar.vue         # 底部状态栏
│   ├── services/                 # 服务层
│   │   ├── SshService.ts         # SSH 连接管理
│   │   ├── SftpService.ts        # SFTP 文件操作
│   │   └── ThemeService.ts       # 主题管理
│   └── types/
│       └── app.ts                # TypeScript 类型定义
├── src-tauri/                    # 后端 (Rust)
│   ├── src/
│   │   ├── lib.rs                # 入口 + 命令注册
│   │   ├── terminal.rs           # 本地 PTY 管理
│   │   ├── connection_manager.rs # SSH 连接管理器（共享传输层）
│   │   ├── ssh_terminal_russh.rs # SSH 终端会话
│   │   ├── ssh_auth.rs           # SSH 认证 + 主机密钥验证
│   │   ├── host_key_store.rs     # 主机密钥持久化
│   │   ├── ssh.rs                # SSH 配置 CRUD
│   │   ├── sftp_russh.rs         # SFTP 文件操作
│   │   ├── ssh_command.rs        # SSH 命令执行
│   │   ├── system_monitor.rs     # 远程系统监控
│   │   ├── download_manager.rs   # 下载辅助
│   │   └── fs.rs                 # 本地文件系统操作
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.*
```

## 架构概览

```
┌─────────────────────────────────────────────┐
│                Frontend (Vue 3)             │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ Terminal  │ │   File   │ │   System    │ │
│  │ (xterm)  │ │ Manager  │ │  Monitor    │ │
│  └────┬─────┘ └────┬─────┘ └──────┬──────┘ │
│       │             │              │        │
│       └─────────────┼──────────────┘        │
│                     │ invoke() / listen()   │
├─────────────────────┼──────────────────────-┤
│                     │ Tauri IPC             │
├─────────────────────┼──────────────────────-┤
│                Backend (Rust)               │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │   PTY    │ │  russh   │ │ System Mon  │ │
│  │(portable)│ │SSH/SFTP  │ │(SSH commands)│ │
│  └──────────┘ └──────────┘ └─────────────┘ │
└─────────────────────────────────────────────┘
```

- **前端 → 后端**: 通过 Tauri `invoke()` 调用 Rust 命令
- **后端 → 前端**: 通过 Tauri 事件 (`emit`) 推送数据（终端输出、下载进度等）
- **连接复用**: `ConnectionManager` 统一管理 SSH 传输层，终端、SFTP、命令执行共享同一连接

## 许可证

[GPL-3.0](LICENSE)

## 致谢

- [Tauri](https://tauri.app/) - 跨平台桌面应用框架
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Ant Design Vue](https://antdv.com/) - 企业级 UI 组件库
- [xterm.js](https://xtermjs.org/) - 终端模拟器组件
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - 代码编辑器
- [russh](https://github.com/warp-tech/russh) - Rust SSH 协议实现
