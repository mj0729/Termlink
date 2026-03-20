# 📋 实施计划：Remote File Workbench 重构

## 任务类型
- [x] 前端 (→ Gemini)
- [x] 后端 (→ Codex)
- [x] 全栈 (→ 并行)

---

## 技术方案

将 `RemoteFileWorkbench.vue`（当前 3326 行的单体组件）拆分为 7 个子组件的模块化架构，同时在 Rust 后端新增 6 个 Tauri 命令以支持 chmod/chown/archive/symlink/disk-usage 等高级文件操作。

### 架构概览

```
RemoteFileWorkbench.vue (编排器, ≤800 行)
├── RemoteDirectoryTree.vue    ← a-directory-tree, 异步懒加载
├── RemotePathBar.vue          ← 面包屑 + 路径输入 + 工具栏
├── RemoteFileTable.vue        ← vxe-table, 核心文件列表
│   └── FileContextMenu.vue    ← Vue 组件右键菜单
├── RemoteStatusBar.vue        ← 磁盘信息 + 审计日志开关
├── RemoteAuditLog.vue         ← 可展开的命令历史
├── ChmodModal.vue             ← 权限编辑器
└── ChownModal.vue             ← 所有者编辑器
```

### 布局

```
┌────────────────────────────────────────────────┐
│  RemotePathBar (面包屑 + 路径输入 + 工具栏)      │
├──────────┬─────────────────────────────────────┤
│ Directory│        RemoteFileTable              │
│   Tree   │        (vxe-table)                  │
│ (260px)  │                                     │
│          │                                     │
├──────────┴─────────────────────────────────────┤
│  RemoteStatusBar + RemoteAuditLog (可展开)      │
└────────────────────────────────────────────────┘
```

---

## 实施步骤

### Phase 1: 后端扩展 (Rust)

#### Step 1.1: 增强 execute_session_command 采集 stderr
- **文件**: `src-tauri/src/connection_manager.rs:460-495`
- **操作**: 修改
- **说明**: 在 `execute_session_command` 中同时采集 `ChannelMsg::ExtendedData`（stderr），失败时返回 stderr 内容而非仅退出码

```rust
// 伪代码
ChannelMsg::ExtendedData { data, .. } => {
    stderr.push_str(&String::from_utf8_lossy(&data));
}
// 错误返回时优先使用 stderr 内容
```

#### Step 1.2: 新增共享 helper 和数据结构
- **文件**: `src-tauri/src/sftp_russh.rs` (顶部新增)
- **操作**: 新增
- **说明**:
  - `SftpDetailedEntry` 结构体（含 owner_user, owner_group, numeric_permissions, is_symlink, symlink_target）
  - `SftpDiskUsageInfo` 结构体
  - `shell_quote()` 路径安全转义函数
  - `validate_mode()` 权限格式校验
  - `validate_owner_segment()` 用户/组名校验
  - `run_remote_command()` 统一 SSH 命令执行 + 错误包装
  - `parse_stat_record()` 解析 `stat -c` 输出
  - `permissions_from_octal()` 八进制转 rwx 字符串

#### Step 1.3: 实现 `sftp_list_detailed` 命令
- **文件**: `src-tauri/src/sftp_russh.rs`
- **操作**: 新增
- **说明**:
  1. 用 SFTP `read_dir()` 获取基础目录项
  2. 按 64 个路径为一批，拼批量 `stat -c '%a\x1f%U\x1f%G\x1f%F\x1f%N'` 命令
  3. 合并 SFTP metadata + stat 详细信息
  4. 返回 `Vec<SftpDetailedEntry>`

#### Step 1.4: 实现 `sftp_stat` 命令
- **文件**: `src-tauri/src/sftp_russh.rs`
- **操作**: 新增
- **说明**: 单文件详情，用于选中文件时展示（owner/symlink/permissions 等）

#### Step 1.5: 实现 `sftp_chmod` 命令
- **文件**: `src-tauri/src/sftp_russh.rs`
- **操作**: 新增
- **说明**: `validate_mode()` → `chmod {mode} -- {quoted_path}`

#### Step 1.6: 实现 `sftp_chown` 命令
- **文件**: `src-tauri/src/sftp_russh.rs`
- **操作**: 新增
- **说明**: `validate_owner_segment()` → `chown {user}:{group} -- {quoted_path}`

#### Step 1.7: 实现 `sftp_archive` 命令
- **文件**: `src-tauri/src/sftp_russh.rs`
- **操作**: 新增
- **说明**:
  - 支持 `tar.gz` 和 `zip` 两种格式
  - zip 前先检测 `command -v zip`
  - 计算公共父目录，使用相对路径打包

#### Step 1.8: 实现 `sftp_disk_usage` 命令
- **文件**: `src-tauri/src/sftp_russh.rs`
- **操作**: 新增
- **说明**: `df -h --output=size,used,avail,target` + fallback

#### Step 1.9: 注册新命令
- **文件**: `src-tauri/src/lib.rs:63-77`
- **操作**: 修改
- **说明**: 在 `invoke_handler` 中添加 6 个新命令

---

### Phase 2: 前端依赖准备

#### Step 2.1: 安装 vxe-table
- **操作**: `pnpm add vxe-table vxe-pc-ui`
- **说明**: vxe-table v4 for Vue 3，高性能虚拟滚动表格

#### Step 2.2: 扩展 TypeScript 类型
- **文件**: `src/types/app.ts`
- **操作**: 修改
- **说明**: 新增 `SftpDetailedEntry`, `SftpDiskUsageInfo`, `AuditLogEntry` 类型

#### Step 2.3: 扩展 SftpService
- **文件**: `src/services/SftpService.ts`
- **操作**: 修改
- **说明**: 新增 `listDetailed()`, `stat()`, `chmod()`, `chown()`, `archive()`, `diskUsage()` 方法

---

### Phase 3: 前端组件拆分与实现

#### Step 3.1: RemotePathBar.vue
- **操作**: 新建
- **Props**: `currentPath`, `canGoBack`, `canGoForward`, `isLoading`
- **Events**: `navigate(path)`, `goBack()`, `goForward()`, `goUp()`, `refresh()`, `createFolder()`
- **说明**:
  - a-breadcrumb 展示路径段，点击跳转
  - a-input 路径输入框，支持 Enter 提交和 Ctrl+L 聚焦
  - 工具栏按钮：返回、前进、上级、刷新、新建文件夹

#### Step 3.2: RemoteDirectoryTree.vue
- **操作**: 新建
- **Props**: `connectionId`, `currentPath`
- **Events**: `select(path)`
- **说明**:
  - a-directory-tree 组件
  - `loadData` 异步回调：展开时调用 `list_sftp_files` 仅获取子目录
  - 监听 `currentPath` 变化自动展开并高亮对应节点
  - 窄屏时可折叠

#### Step 3.3: RemoteFileTable.vue (核心)
- **操作**: 新建
- **Props**: `files`, `loading`, `selectedPaths`
- **Events**: `navigate(path)`, `select(entries)`, `openFile(entry)`, `contextMenu(event, entries)`
- **说明**:
  - vxe-table 列配置：checkbox | icon+name | size | permissions | owner | group | modified
  - 自定义 name 列 slot：文件图标 + 名称 + symlink 箭头指示器
  - 双击行为：目录→navigate，文本文件→openFile
  - Shift/Ctrl 多选
  - 列排序
  - 虚拟滚动（文件 >500 时自动启用）
  - 拖拽上传（监听 dragover/drop 事件）

#### Step 3.4: FileContextMenu.vue
- **操作**: 新建
- **说明**:
  - Vue 组件实现（非 DOM 操作），使用 a-dropdown 或绝对定位面板
  - 菜单项：打开 | 下载 | 上传 | 重命名 | 删除 | 新建文件夹 | 打包(tar.gz/zip) | 权限(chmod) | 所有者(chown) | 终端打开此处 | 复制路径
  - 根据选中项类型（文件/目录/多选）动态显示/隐藏菜单项

#### Step 3.5: ChmodModal.vue
- **操作**: 新建
- **说明**:
  - 可视化权限编辑器：3×3 checkbox 矩阵（owner/group/other × read/write/execute）
  - 实时预览八进制值（如 755）
  - 支持直接输入八进制或符号格式

#### Step 3.6: ChownModal.vue
- **操作**: 新建
- **说明**:
  - 用户名 + 用户组输入框
  - 显示当前 owner/group
  - 可选递归应用（对目录）

#### Step 3.7: RemoteStatusBar.vue
- **操作**: 新建
- **Props**: `diskUsage`, `fileCount`, `selectedCount`, `showHidden`
- **Events**: `toggleHidden()`
- **说明**:
  - 左侧：磁盘空间（total/used/available）、文件数、选中数
  - 右侧：隐藏文件开关

#### Step 3.8: RemoteAuditLog.vue
- **操作**: 新建
- **Props**: `logs`
- **说明**:
  - 可展开/折叠面板
  - 显示 shell 命令历史，格式：`[时间] $ 命令`
  - 支持复制命令
  - 玻璃拟态样式

#### Step 3.9: 重构 RemoteFileWorkbench.vue
- **文件**: `src/components/RemoteFileWorkbench.vue`
- **操作**: 重写（从 3326 行缩减至 ≤800 行）
- **说明**:
  - 编排器角色：管理 currentPath、fileList、selectedFiles、auditLogs 状态
  - 布局：CSS Grid `grid-cols-[260px_1fr] grid-rows-[auto_1fr_auto]`
  - 组合子组件，通过 props 和 events 通信
  - provide/inject 共享 `connectionId` 和导航函数
  - Ctrl+L 全局快捷键注册

---

### Phase 4: 集成测试与验收

#### Step 4.1: 功能验证清单
- [ ] 目录树异步加载（展开时才请求，响应 <200ms）
- [ ] vxe-table 展示：文件名、大小、权限、所有者、修改时间、symlink
- [ ] 右键菜单全功能（下载/上传/删除/重命名/打包/chmod/chown/终端打开）
- [ ] 面包屑导航 + 路径直达（Ctrl+L）
- [ ] 拖拽上传
- [ ] 隐藏文件切换
- [ ] 操作审计日志
- [ ] Monaco 编辑器打开文本文件

---

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src-tauri/src/connection_manager.rs:460-495` | 修改 | stderr 采集增强 |
| `src-tauri/src/sftp_russh.rs` | 修改+新增 | 6 个新命令 + helper |
| `src-tauri/src/lib.rs:63-77` | 修改 | 注册新命令 |
| `src/types/app.ts` | 修改 | 新增类型定义 |
| `src/services/SftpService.ts` | 修改 | 新增 service 方法 |
| `src/components/RemoteFileWorkbench.vue` | 重写 | 3326→≤800 行 |
| `src/components/remote-file/RemoteDirectoryTree.vue` | 新建 | 异步目录树 |
| `src/components/remote-file/RemotePathBar.vue` | 新建 | 面包屑+路径栏 |
| `src/components/remote-file/RemoteFileTable.vue` | 新建 | vxe-table 核心 |
| `src/components/remote-file/FileContextMenu.vue` | 新建 | Vue 右键菜单 |
| `src/components/remote-file/RemoteStatusBar.vue` | 新建 | 状态栏 |
| `src/components/remote-file/RemoteAuditLog.vue` | 新建 | 审计日志 |
| `src/components/remote-file/ChmodModal.vue` | 新建 | 权限编辑器 |
| `src/components/remote-file/ChownModal.vue` | 新建 | 所有者编辑器 |
| `package.json` | 修改 | 添加 vxe-table 依赖 |

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 大目录（1000+文件）批量 stat 命令过长 | 按 64 个文件分批执行，vxe-table 虚拟滚动 |
| 远端无 `stat -c`（非 GNU Linux） | fallback 到 `ls -ld` 解析 |
| 远端无 `zip` 命令 | 执行前 `command -v zip` 探测，不可用时禁用 zip 选项 |
| chmod/chown 命令注入 | 所有路径 `shell_quote()`，mode/user/group 白名单校验 |
| 3326 行组件重构破坏现有功能 | 保持 SshWorkspace 的 props/events 接口不变 |
| vxe-table 与 antdv-next 主题不一致 | 使用 CSS 变量覆盖 vxe-table 默认样式 |

---

## SESSION_ID（供 /ccg:execute 使用）
- CODEX_SESSION: 019d097b-e90d-7d42-8866-77a057ed3021
- GEMINI_SESSION: (gemini wrapper 未返回 session_id)
