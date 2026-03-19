# 变更记录

## [0.0.12] - 2026-03-19

### 变更

- **[app-shell]**: 接入 `unplugin-vue-components` 与 `unplugin-auto-import`，移除 `src/main.ts` 中的 `app.use(AntdvNext)` 全量注册，改由项目定制 resolver 自动解析 `<a-*>` 组件，并为 `Input`、`Modal`、`message` 生成自动导入声明；已通过 `pnpm run build` / `pnpm exec vue-tsc --noEmit` 验证，`antdv-next` 相关产物继续缩小且上一轮的 circular chunk 提示已消失 — by 孟彦祖
  - 方案: [202603191414_antdv-auto-import](archive/2026-03/202603191414_antdv-auto-import/)
  - 决策: antdv-auto-import#D001(采用插件自动按需注册，而不是继续手工维护入口注册清单)

## [0.0.11] - 2026-03-19

### 变更

- **[app-shell]**: 调整 `vite.config.ts` 的 `manualChunks`，将原本单块的 `antdv-next` vendor 细分为 `icons / style / date / data-entry / structure / display / feedback` 多组 chunk，构建中已不再出现单个 `antdv` chunk 超过 500 kB 的告警，并通过 `pnpm run build` / `pnpm exec vue-tsc --noEmit` 验证；当前仍有来自 `antdv-next` 组件家族互相引用的 circular chunk 提示，后续如需继续优化应转入按需注册阶段 — by 孟彦祖
  - 方案: [202603191402_bundle-chunk-optimization](archive/2026-03/202603191402_bundle-chunk-optimization/)
  - 决策: bundle-chunk-optimization#D001(先做基于模块家族的 `manualChunks` 细分，不直接切按需注册)

## [0.0.10] - 2026-03-19

### 变更

- **[workspace-ui]**: 继续收口遗留原生控件，将 `TopMenu.vue` 与示例组件 `HelloWorld.vue` 的按钮统一到 `antdv-next`，并修正文档中仍将 `TopMenu` 视为主壳层组件、仍引用旧 `ant-design-vue` 的描述 — by 孟彦祖

## [0.0.9] - 2026-03-19

### 变更

- **[workspace-ui]**: 将连接中心分组筛选、连接卡片、底部状态栏操作和右侧传输筛选统一到 `antdv-next` 组件骨架，同时明确保留 `FileEditor` 大文本 `textarea` 与隐藏文件输入等性能敏感原生实现，并通过 `pnpm run build` / `pnpm exec vue-tsc --noEmit` 验证 — by 孟彦祖
  - 方案: [202603191346_frontend-antdv-unification](archive/2026-03/202603191346_frontend-antdv-unification/)
  - 决策: frontend-antdv-unification#D001(保留性能敏感原生控件，只统一高价值交互壳层)

## [0.0.8] - 2026-03-19

### 变更

- **[workspace-ui]**: 将 SSH 工作台文件管理器进一步统一到 `antdv-next` 组件体系，文件列表改为 `a-table`，目录区补齐 `a-menu` 右键菜单与 `a-upload-dragger` 拖拽上传，弹窗输入改为 `a-input`，并通过 `pnpm run build` 验证 — by 孟彦祖

## [0.0.7] - 2026-03-18

### 变更

- **[workspace-ui]**: 重构 SSH 工作台文件管理区为更紧凑的树 + 明细表双栏布局，补齐目录/空白区右键菜单、当前目录筛选、选中信息条与拖拽/选择上传，统一为更高密度但信息完整的浏览体验 — by 孟彦祖

## [0.0.6] - 2026-03-18

### 变更

- **[ssh-runtime]**: 为 SSH 终端输出增加后端序号缓冲与前端快照补拉，修复连接建立早期的欢迎横幅、登录信息和首屏输出在终端挂载前丢失的问题 — by 孟彦祖

## [0.0.5] - 2026-03-18

### 变更

- **[workspace-ui]**: 单标签场景下继续保留标签栏，并为终端画布增加顶部与左右安全边距，修复首行贴顶裁切的问题 — by 孟彦祖

## [0.0.4] - 2026-03-18

### 变更

- **[workspace-ui]**: 去掉顶部连接带里和工作区标签重复的连接 pill，只保留 `+` 作为连接中心入口，避免双重导航造成视觉噪音 — by 孟彦祖

## [0.0.3] - 2026-03-18

### 变更

- **[workspace-ui]**: 应用启动默认直接进入“连接中心”，并移除入口阶段遗留的欢迎空白页与左侧文件管理器空态，避免与 SSH 工作台底部 Explorer 重复 — by 孟彦祖

## [0.0.2] - 2026-03-18

### 变更

- **[ssh-runtime]**: 将 SSH 配置与密码存储切到本地文件方案，新增 `connections.json`、`credentials.json` 与 `app.key`，并兼容读取旧 `profiles/` 与旧 keyring 密码后迁移到本地加密存储，已通过 `cargo check --manifest-path src-tauri/Cargo.toml` / `pnpm run build` 验证 — by 孟彦祖

- **[ssh-runtime]**: 增加简化版连接导入导出能力，设置页支持导出全部连接、可选包含已保存密码的 `.tlink` 包，并支持从文件导入后按“保留副本”策略刷新连接列表，已通过 `cargo check --manifest-path src-tauri/Cargo.toml` / `pnpm run build` 验证 — by 孟彦祖

- **[ssh-runtime]**: 清理连接栈过渡代码，前端移除 `sftpConnectionId` 等临时字段，`SshService.ts` 收敛为单一正式连接流程，并删除未使用的 `open_sftp_from_connection` / `disconnect_sftp` / `close_ssh_terminal` / `get_connection_state` 命令入口，已通过 `cargo check --manifest-path src-tauri/Cargo.toml` / `pnpm run build` 验证 — by 孟彦祖

- **[ssh-runtime]**: 为严格主机密钥校验补回前端确认链，首次连接或主机密钥变化时支持“信任并保存”与“仅本次信任”，避免连接直接失败，并通过 `cargo check --manifest-path src-tauri/Cargo.toml` / `pnpm run build` 验证 — by 孟彦祖

- **[ssh-runtime]**: 将 SSH 终端、SFTP 与系统监控统一收敛到单 `ConnectionManager` actor，后端改为按 `connection_id` 复用同一 transport，前端同步移除 `sftp-${id}` 与 2 秒延迟等待，并通过 `cargo check --manifest-path src-tauri/Cargo.toml` / `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603181503_connection-manager-actor-refactor](plan/202603181503_connection-manager-actor-refactor/)
  - 决策: connection-manager-actor-refactor#D001(采用单 actor 收口，而非保留三套 facade 共享 transport)

- **[tauri-deps]**: 将 `src-tauri/Cargo.toml` 的 Tauri、russh、tokio、keyring 等 Rust 依赖整体升级到 crates.io 当前稳定版，并同步修正 `ssh_auth.rs` / `ssh.rs` 以适配最新认证与凭据 API，已通过 `cargo check --manifest-path src-tauri/Cargo.toml` 验证 — by 孟彦祖

- **[workspace-ui]**: 远程文件区升级为更紧凑的树形导航 + 高密度文件表，压缩顶部层级和列表行高，同屏显示更多目录与文件项 — by 孟彦祖

- **[workspace-ui]**: SSH 工作台新增可拖拽的上下分割条，终端区与文件区高度可按使用场景手动调整 — by 孟彦祖

- **[workspace-ui]**: SSH 标签页改为“上终端、下文件区”的工作台结构，远程文件浏览从左侧栏抽离为底部 Explorer 区并新增目录列/明细列表布局 — by 孟彦祖

- **[workspace-ui]**: 右侧监控/下载按钮改为底部状态栏控件，和工作区信息同排显示，右侧面板本体只保留内容区 — by 孟彦祖

- **[workspace-ui]**: 右侧监控/下载浮动按钮收到底部并缩小尺寸，降低悬浮打断感并给主内容区留出更多呼吸空间 — by 孟彦祖

- **[workspace-ui]**: 将空状态右侧两张预览卡改成同层级的信息分区，去掉独立底色和圆角壳，进一步压平空态层次 — by 孟彦祖

- **[workspace-ui]**: 拉平空状态工作区的外层容器层级，去掉终端空态下的额外背景壳与内缩卡片感，避免出现多层套盒视觉 — by 孟彦祖

- **[workspace-ui]**: 单一 SSH 会话时自动隐藏重复的标签栏，只保留顶部连接入口，避免同一连接在上下两处重复展示 — by 孟彦祖

- **[workspace-ui]**: 右侧监控栏改为更贴边的连续侧轨样式，去掉独立卡片壳体感并收紧内部层级 — by 孟彦祖

- **[workspace-ui]**: 去除 SSH 终端区域的内层卡片包裹与额外留白，让终端内容区像连接中心一样直接撑满主工作区 — by 孟彦祖

- **[workspace-ui]**: 移除顶部工作区计数及右侧“本地 / 浅 / 深”快捷按钮，进一步压缩头部视觉噪音 — by 孟彦祖

- **[workspace-ui]**: 修复 `RemoteFileWorkbench` 中 `a-tree` 的节点插槽兼容问题，改为 `antdv-next` 1.1 可用的 `titleRender/switcherIcon` 参数形状，并关闭虚拟滚动以优先保证远程目录树稳定显示 — by 孟彦祖

- **[workspace-ui]**: 调整远程目录树的数据组织方式，新增按路径缓存的目录节点，进入子目录后保留父级同层目录列表，只展开当前路径分支，避免树退化成单链路显示 — by 孟彦祖

- **[workspace-ui]**: 顶部新增连接带与 `+` 入口，并增加主内容区“连接中心”页统一承载搜索、筛选与连接启动；左侧常驻连接列表已移出 — by 孟彦祖

- **[workspace-ui]**: 将连接状态收敛到标签页标题旁展示，并移除文件管理器区域的重复连接状态提示 — by 孟彦祖

- **[workspace-ui]**: 移除顶部“当前连接”上下文带，进一步压缩头部层级并释放终端上方纵向空间 — by 孟彦祖

- **[workspace-ui]**: 完成工作台紧凑化重设计，去掉外层与左右分栏硬边框，收敛顶部/底部重复信息并压缩侧栏和标签栏密度，小屏可用面积明显提升 — by 孟彦祖
  - 方案: [202603181130_compact-workspace-redesign](archive/2026-03/202603181130_compact-workspace-redesign/)
  - 决策: compact-workspace-redesign#D001(以“信息收敛”优先于“单纯缩小控件”), compact-workspace-redesign#D002(better-icons 不可用时回退到现有图标体系)

- **[app-shell]**: 将项目包管理器入口收敛到 `pnpm`，同步 Tauri 前置命令与项目文档并通过 `pnpm install` / `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603181108_pnpm-migration](archive/2026-03/202603181108_pnpm-migration/)
  - 决策: pnpm-migration#D001(采用 pnpm 作为唯一包管理器入口)

## [0.0.1] - 2026-03-18

### 新增

- **[app-shell]**: 接入 `Tailwind CSS v4` 并将前端入口、服务层和组件脚本整体迁移到 TypeScript 轨道 — by 孟彦祖
  - 方案: [202603181016_tailwind4-ts-migration](archive/2026-03/202603181016_tailwind4-ts-migration/)
  - 决策: tailwind4-ts-migration#D001(采用“底座先行，分层收口”的迁移路径), tailwind4-ts-migration#D002(采用 Tailwind 混合重构而非整站重画)

### 变更

- **[type-closure]**: 完成第二轮 TypeScript 类型验收闭环，系统监控、侧边栏、终端与文件管理链路实现共享类型收口并通过 `vue-tsc --noEmit` / `npm run build` 双验收 — by 孟彦祖
  - 方案: [202603181041_ts-typecheck-closure](archive/2026-03/202603181041_ts-typecheck-closure/)
  - 决策: ts-typecheck-closure#D001(以“类型验收闭环”为唯一目标，优先修共享模型缺失导致的系统性报错), ts-typecheck-closure#D002(保留第一轮构建稳定性，以最小必要改动收口大组件与 DOM 事件类型)

- **[build-optimization]**: 完成第三轮构建体积优化，文件编辑器链路切到异步加载并收紧 Vite vendor 分包，显著降低主包首屏负载 — by 孟彦祖
  - 方案: [202603181110_build-splitting-optimization](archive/2026-03/202603181110_build-splitting-optimization/)
  - 决策: build-splitting-optimization#D001(优先切断 FileEditor→Monaco 的静态依赖链，再做 Vite vendor 分包), build-splitting-optimization#D002(本轮以主包显著下降为完成边界，不把 antdv 整库按需注册重构纳入同一轮)

## [0.0.0] - 2026-03-18

### 新增

- **[知识库]**: 初始化 HelloAGENTS 知识库并创建 `antdv-next` 迁移方案包 — by 孟彦祖
  - 方案: [202603180906_antdv-next-migration](archive/2026-03/202603180906_antdv-next-migration/)
  - 决策: antdv-next-migration#D001(保持现有布局与主题体验，基于 `antdv-next` 完成兼容迁移)
