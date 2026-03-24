# 变更记录

## [0.0.38] - 2026-03-24

### 修复

- **[workspace-ui]**: 为 SSH 建连后的 bootstrap 增加会话级 cwd shell hook；`SshService` 现在会在会话启动时定义 `__termlink_emit_cwd`，为 bash 拼接 `PROMPT_COMMAND`、为 zsh 注册 `precmd`，并在 `cd` 成功后立即输出 `TERMLINK_CWD` marker，使 Rocky Linux 这类 prompt 不稳定的服务器也能稳定驱动下方文件管理同步。后续又将 bootstrap 改为单行注入，并在 `Terminal` 端按 `__TERMLINK_BOOTSTRAP=1;` 到首个真实 cwd marker 的区间做流式剥离，避免首屏显示整段 hook 脚本；已通过 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603241320_ssh-cwd-shell-hook](archive/2026-03/202603241320_ssh-cwd-shell-hook/)
  - 决策: ssh-cwd-shell-hook#D001(在连接 bootstrap 中注入 cwd shell hook)

## [0.0.37] - 2026-03-24

### 修复

- **[workspace-ui]**: 修正 SSH 终端与下方远程文件管理的工作目录联动；`Terminal` 现保留 `TERMLINK_CWD` 标记与绝对路径提示符解析，同时移除 basename 提示符场景下走独立 `executeCommand('pwd')` 的错误兜底，改为在当前会话内跟踪简单 `cd` 命令并在下一次提示符返回时回填 cwd，使 Rocky Linux 等服务器不再把文件管理误同步回登录目录；已通过 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603241309_ssh-cwd-sync-linux](archive/2026-03/202603241309_ssh-cwd-sync-linux/)
  - 决策: ssh-cwd-sync-linux#D001(用会话内命令推导替代独立 `pwd` 兜底)

## [0.0.36] - 2026-03-23

### 修复

- **[workspace-ui]**: 修正左侧目录树在继续压缩缩进后出现的错行对齐问题；`RemoteFileWorkbench` 现将 aggressive 模式下的 `switcher/indent` 宽度从激进值回调一档，`RemoteDirectoryTree` 也同步去掉 `.ant-tree-treenode` 默认外边距并固定 switcher 对齐，使展开箭头与文件夹图标恢复到同一行，同时节点间距仍比初始状态更紧；已通过 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603231800_remote-directory-tree-align-and-tighten](archive/2026-03/202603231800_remote-directory-tree-align-and-tighten/)
  - 决策: remote-directory-tree-align-and-tighten#D001(回退过度缩进压缩，改为直接压节点间距)

## [0.0.35] - 2026-03-23

### 变更

- **[workspace-ui]**: 继续将 SSH 工作区左侧目录树节点压紧一档；`RemoteFileWorkbench` 现将 aggressive 模式下的目录节点最小高度从 `17px` 下调到 `15px`，节点行高从 `18px` 收到 `16px`，并同步把树内联编辑输入框高度收口到 `15px`，只压缩节点纵向占位，不调整缩进、图标和字体大小；已通过 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603231743_remote-directory-tree-row-spacing-tighten-more](archive/2026-03/202603231743_remote-directory-tree-row-spacing-tighten-more/)
  - 决策: remote-directory-tree-row-spacing-tighten-more#D001(只继续下调 aggressive 节点高度链一档)

## [0.0.34] - 2026-03-23

### 变更

- **[workspace-ui]**: 继续收紧 SSH 工作区左侧目录树的节点高度；`RemoteFileWorkbench` 现将 aggressive 模式下的目录节点最小高度从 `19px` 下调到 `17px`，并同步把树内联编辑输入框高度收口到 `17px`，只压缩节点的纵向占位，不调整字体大小、图标尺寸和层级缩进；已通过 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603231733_remote-directory-tree-row-spacing-tighten](archive/2026-03/202603231733_remote-directory-tree-row-spacing-tighten/)
  - 决策: remote-directory-tree-row-spacing-tighten#D001(仅下调 aggressive 目录树节点高度变量)

## [0.0.33] - 2026-03-23

### 变更

- **[workspace-ui]**: 收紧远程文件表格正文列表的行距；`RemoteFileTable` 现将 compact 模式下的正文行高从 `28px` 下调到 `26px`，只压缩文件列表每一行的垂直占位，不调整图标尺寸、文字字号和名称列内部间距，让远程文件区整体密度进一步贴近桌面文件管理器；已通过 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603231729_remote-file-table-row-spacing-tighten](archive/2026-03/202603231729_remote-file-table-row-spacing-tighten/)
  - 决策: remote-file-table-row-spacing-tighten#D001(仅下调 compact 正文行高，不联动图标与字号)

## [0.0.32] - 2026-03-23

### 修复

- **[workspace-ui]**: 修正远程文件表格表头“变量已调整但视觉高度几乎不变”的真实根因；此前仅将 `RemoteFileTable` 的 `--remote-table-header-height` 从 `28px` 降到 `24px`，但 `vxe-table` 默认的 `.vxe-table--render-default .vxe-header--column.is--padding .vxe-cell` 仍以更高优先级的上下 padding 撑高表头。现已显式覆盖该 header padding 与高度层级，并通过 `header-row-style / header-cell-style` 将表头高度直接内联到组件节点，使表头压缩真正作用到界面，同时保持路径栏、搜索栏和正文行高不变；已通过 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603231650_remote-file-table-header-effective-height-fix](archive/2026-03/202603231650_remote-file-table-header-effective-height-fix/)
  - 决策: remote-file-table-header-effective-height-fix#D001(覆盖 vxe-table 默认 header padding，而不再只改低优先级高度变量)

## [0.0.31] - 2026-03-23

### 变更

- **[workspace-ui]**: 收紧远程文件表格的列表表头高度；`RemoteFileTable` 现将表头高度变量从 `28px` 下调到 `24px`，只压缩列标题横条本身，不影响路径栏、搜索栏和正文行高，使 SSH 远程文件工作台在保持排序与列拖拽交互不变的前提下获得更紧凑的顶部占位；已通过 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603231643_remote-file-table-header-compact](archive/2026-03/202603231643_remote-file-table-header-compact/)
  - 决策: remote-file-table-header-compact#D001(仅下调远程文件表格表头高度，不扩展到路径栏或正文行高)

## [0.0.30] - 2026-03-23

### 变更

- **[workspace-ui]**: 将设置弹窗重构为“左侧分类导航 + 右侧内容区”的双栏偏好设置面板；`SettingsModal` 现已按常规、终端、外观、存储与导入四个分区重组现有设置项，保留原有保存、主题、导入导出与 Tauri 交互逻辑，同时补齐窄宽度退化布局，更接近桌面 IDE 的设置中心使用体验；已通过 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603231227_settings-modal-two-pane-layout](plan/202603231227_settings-modal-two-pane-layout/)
  - 决策: settings-modal-two-pane-layout#D001(采用单组件内双栏重构而非拆分成完整设置子页面体系)

### 快速修改

- **[workspace-ui]**: 将设置弹窗尺寸固定为稳定的桌面高度；`SettingsModal` 现在在常规桌面窗口下统一保持固定外框高度，切换常规/终端/外观/存储分区时不再因为内容多少出现整体忽高忽低，仍保留中间内容区滚动与底部按钮固定的行为；已通过 `pnpm run build` 验证 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/SettingsModal.vue

- **[workspace-ui]**: 将新建主机弹窗改为固定高度并让表单区内部滚动；`SshModal` 现在会把滚动限制在中间表单内容区，底部“取消 / 确定”按钮始终固定在可视范围内，不会再因为高级 SSH 或端口转发项较多而被挤出屏幕；已通过 `pnpm run build` 验证 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/SshModal.vue

- **[workspace-ui]**: 继续统一文件操作弹窗的固定高度与滚动行为；`ChmodModal` 与 `ChownModal` 现已和设置/新建主机弹窗保持同类交互规范，外框高度固定、正文区自滚、底部按钮固定，避免权限或所有者修改弹窗在内容增长时再次把 footer 挤出可视区域；已通过 `pnpm run build` 验证 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/remote-file/ChmodModal.vue, src/components/remote-file/ChownModal.vue

- **[workspace-ui]**: 继续收紧设置弹窗样式密度并修正滚动行为；去掉左栏和内容头部的说明性文案，压缩导航与分组留白，使整体更贴近现有黑白桌面工具风格，同时将 modal 内容区改为内部滚动，确保设置项再多时底部“取消 / 确定”按钮仍固定在可视区域内；已通过 `pnpm run build` 验证 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/SettingsModal.vue

## [0.0.29] - 2026-03-22

### 变更

- **[workspace-ui]**: 对主工作区前端运行时做了一轮结构收口；`Terminal` 现在会在 SSH 标签隐藏时解除会话订阅、重新激活时再按快照恢复，右键菜单抽到共享工具函数，`RemoteFileWorkbench` 把重命名/创建/删除/移动/权限修改统一收口到 `useRemoteFileActions`，`RightPanel` 仅在监控面板真实可见时才继续轮询系统信息，同时 `App.vue` 的卸载资源清理改为批量关闭；已通过 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603221721_frontend-workspace-runtime-refactor](plan/202603221721_frontend-workspace-runtime-refactor/)
  - 决策: frontend-workspace-runtime-refactor#D001(优先重构工作区编排边界，而不是仅做文件级拆分)

### 快速修改

- **[workspace-ui]**: 将主按钮的 hover 反馈从位移/阴影改回纯颜色变化；用户希望悬停时能明显感知到 hover，但不希望按钮产生“动一下”的位移感。现已移除主按钮的上浮与阴影变化，改为浅色主题下黑→深灰、深色主题下白→浅灰的颜色反馈，按下态则进一步加深/恢复，保持静态但可感知；已通过 `pnpm run build` 验证 — by Codex
  - 类型: 快速修改（无方案包）
  - 文件: src/style.css

- **[workspace-ui]**: 为全局主按钮补回明确的 hover / active 反馈；在修复文字不可见后，主按钮悬停时视觉变化仍不够明显。现已为 `ant-btn-primary` 增加轻微上浮与阴影增强，按下时回落，保证“新增主机”等主按钮在浅色和深色主题下都能明显感知到鼠标进入与点击状态；已通过 `pnpm run build` 验证 — by Codex
  - 类型: 快速修改（无方案包）
  - 文件: src/style.css

- **[workspace-ui]**: 修复主按钮 hover 后文字消失的问题；此前通用 `.ant-btn:hover` 会把主按钮文字改成普通文本色，导致浅色主题下出现黑底黑字。现已为全局主按钮 hover 显式保留前景色，浅色主题维持白字，深色主题维持深字，避免“新增主机”等主按钮悬停时文案不可见；已通过 `pnpm run build` 验证 — by Codex
  - 类型: 快速修改（无方案包）
  - 文件: src/style.css

- **[workspace-ui]**: 继续统一主机对象层内部命名；主机中心组件与组合式函数改为 `HostCenter / useHostCatalog`，主机中心标签类型、打开函数和视图配置也从 `Connection*` 语义切到 `Host*`，同时保留 `connectionId / connect / disconnect` 等连接行为命名，并为本地视图配置增加旧 key 兼容读取；已通过 `pnpm run build` 验证 — by Codex
  - 类型: 快速修改（无方案包）
  - 文件: src/App.vue, src/components/HostCenter.vue, src/composables/useHostCatalog.ts, src/composables/useWorkspaceTabs.ts, src/composables/useWorkspaceChrome.ts, src/services/ThemeService.ts, src/types/app.ts, src/components/SettingsModal.vue, src/components/TabManager.vue, src/components/TopMenu.vue, src/components/Terminal.vue, src/components/SshWorkspace.vue, src/components.d.ts, README.md, CLAUDE.md

- **[workspace-ui]**: 统一主机对象层文案，连接中心入口、主机列表、设置页导入导出、主机编辑弹窗、状态栏与删除确认等位置改用“主机”表述，同时保留“连接中 / 已连接 / 建立连接”等动作与状态语义，避免对象层和连接行为混用；已通过 `pnpm run build` 验证 — by Codex
  - 类型: 快速修改（无方案包）
  - 文件: src/App.vue, src/components/HostCenter.vue, src/components/SettingsModal.vue, src/components/SshModal.vue, src/components/StatusBar.vue, src/components/Sidebar.vue, src/composables/useHostCatalog.ts

- **[workspace-ui]**: 为右侧监控展示补上共享样式基座；新增 `monitorShared.css` 收口 `Resources / Processes / StorageNetwork` 三个卡片型子组件重复的卡片壳层、标题、chip 与暗色态规则，让子组件本地样式只保留布局差异与紧凑模式细节，同时保持嵌入式左栏监控布局不回退；已通过 `pnpm run build` 验证 — by Codex
  - 类型: 快速修改（无方案包）
  - 文件: src/components/right-panel/monitorShared.css:1-67, src/components/right-panel/RightPanelMonitorResources.vue:98-286, src/components/right-panel/RightPanelMonitorProcesses.vue:75-184, src/components/right-panel/RightPanelMonitorStorageNetwork.vue:163-389

- **[workspace-ui]**: 修正共享样式基座的接入方式；此前每个监控子组件各自 `scoped` 引入 `monitorShared.css`，源码层复用了，但构建产物仍会重复输出。现已改为由 `RightPanelMonitorView` 单点引入，并给共享规则加上 `.right-panel-monitor` 前缀约束，样式作用域保持稳定，同时 `RightPanel` 相关 CSS 体积从约 `35.2 kB` 回落到约 `29.9 kB`；已通过 `pnpm run build` 验证 — by Codex
  - 类型: 快速修改（无方案包）
  - 文件: src/components/right-panel/monitorShared.css:1-109, src/components/right-panel/RightPanelMonitorView.vue:122-158, src/components/right-panel/RightPanelMonitorHero.vue:189-638, src/components/right-panel/RightPanelMonitorResources.vue:98-286, src/components/right-panel/RightPanelMonitorProcesses.vue:75-184, src/components/right-panel/RightPanelMonitorStorageNetwork.vue:163-389

- **[workspace-ui]**: 修正 `RightPanel` 监控继续拆分后的嵌入式样式回归；此前紧凑模式样式仍停留在父级作用域，拆成子组件后无法继续命中，导致 SSH 左侧监控栏出现字号、间距和表格密度偏松的问题。现已将紧凑模式规则分别下沉到 `Hero / Resources / Processes / StorageNetwork` 子组件中，恢复窄栏监控的可读密度；已通过 `pnpm run build` 验证 — by Codex
  - 类型: 快速修改（无方案包）
  - 文件: src/components/right-panel/RightPanelMonitorHero.vue:433-600, src/components/right-panel/RightPanelMonitorResources.vue:265-319, src/components/right-panel/RightPanelMonitorProcesses.vue:168-198, src/components/right-panel/RightPanelMonitorStorageNetwork.vue:380-441, src/components/right-panel/RightPanelMonitorView.vue:24-35

- **[workspace-ui]**: 继续细化 `RightPanel` 的监控展示边界；本轮把 `RightPanelMonitorView` 再拆成 `Hero / Resources / Processes / StorageNetwork` 四个无状态展示组件，并新增 `monitorViewTypes` 统一共享展示模型，容器组件自身只保留监控数据接线与布局编排，进一步降低模板耦合与样式堆叠复杂度；已通过 `pnpm run build` 验证 — by Codex
  - 类型: 快速修改（无方案包）
  - 文件: src/components/right-panel/RightPanelMonitorView.vue:1-158, src/components/right-panel/RightPanelMonitorHero.vue:1-501, src/components/right-panel/RightPanelMonitorResources.vue:1-264, src/components/right-panel/RightPanelMonitorProcesses.vue:1-195, src/components/right-panel/RightPanelMonitorStorageNetwork.vue:1-379, src/components/right-panel/monitorViewTypes.ts:1-57

- **[workspace-ui]**: 继续完成 `RightPanel` 的壳层化重构；本轮新增 `RightPanelMonitorView` 承载系统监控模板、样式与监控组合式逻辑接线，父组件只保留监控/传输视图切换和传输队列装配，`RightPanel.vue` 由巨型单文件收口到数百行级别，同时监控样式覆盖链被整体内聚到子组件；已通过 `pnpm run build` 验证 — by Codex
  - 类型: 快速修改（无方案包）
  - 文件: src/components/RightPanel.vue:1-447, src/components/right-panel/RightPanelMonitorView.vue:1-1284, src/composables/rightPanelMonitorDerived.ts:64-393

- **[workspace-ui]**: 继续把 `RightPanel` 从“巨型脚本组件”往运行时壳层收口；本轮将系统监控拆为 `useRightPanelMonitor`（轮询/主题/拉取）与 `rightPanelMonitorDerived`（排序/告警/展示派生）两层，`RightPanel.vue` 仅保留面板装配与事件透传，同时将重复失败提示收敛为“恢复前仅提示一次”，并移除未参与展示的历史缓存；已通过 `pnpm run build` 验证 — by Codex
  - 类型: 快速修改（无方案包）
  - 文件: src/components/RightPanel.vue:463-566, src/composables/useRightPanelMonitor.ts:1-204, src/composables/rightPanelMonitorDerived.ts:1-471

- **[workspace-ui]**: 继续收口右侧面板职责；本轮把 `RightPanel` 的传输分组、筛选和队列操作抽到 `useRightPanelTransfers`，让组件自身更接近壳层装配角色，同时保持监控轮询与下载面板行为稳定；已通过 `pnpm run build` 验证 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/RightPanel.vue:465-1120, src/composables/useRightPanelTransfers.ts:1-170

## [0.0.28] - 2026-03-22

### 变更

- **[workspace-ui]**: 收紧 SSH 嵌入式文件管理区的视觉密度；`RemoteFileWorkbench` 在 aggressive 模式下移除了内容区圆角，左侧目录树同步缩窄宽度并压缩节点高度、缩进、节点间距和容器留白，让文件树更贴近桌面文件管理器的紧凑观感；已通过 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603221358_tighten-remote-file-tree-spacing](plan/202603221358_tighten-remote-file-tree-spacing/)
  - 决策: tighten-remote-file-tree-spacing#D001(采用局部样式压缩而非重写文件树结构)

### 快速修改

- **[workspace-ui]**: 继续修正左侧目录树“依旧没效果”的根因；这次直接对 Ant Tree 默认的 `flex / width` 行为做强制覆盖，把 `ant-tree-treenode`、`ant-tree-title` 和 `ant-tree-node-content-wrapper` 全部改为内容宽度收口，避免库默认整行布局再次把短目录名撑回整列 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/remote-file/RemoteDirectoryTree.vue:494-537

- **[workspace-ui]**: 修正左侧目录树“重做了但肉眼几乎没变化”的真实根因；此前 `RemoteDirectoryTree` 里的 `ant-tree-treenode` 仍被 `min-width: 100%` 强制撑满整列，抵消了前面对内容自适应宽度的改动。现在已改为真正按内容宽度收口，短目录名右侧不再默认占满整个树栏 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/remote-file/RemoteDirectoryTree.vue:498-502

- **[workspace-ui]**: 按系统文件树风格重做左侧目录树的结构样式；这次不再继续硬压参数，而是同时重排 `RemoteDirectoryTree` 的标题、`ant-tree-title` 和 `ant-tree-node-content-wrapper` 占位链路，让节点按内容宽度自然收口，并把选中态收敛为更轻的胶囊高亮，避免短目录名右侧空白过大和前导结构挤压失真 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/RemoteFileWorkbench.vue:919-942, src/components/remote-file/RemoteDirectoryTree.vue:430-532

- **[workspace-ui]**: 修正左侧文件树被压得过头导致的糟糕观感；把 aggressive 模式下的树宽、箭头占位、缩进宽度、图标尺寸和节点间距回调到更平衡的范围，保留紧凑感，但不再出现箭头、图标与文本互相挤压的失真效果 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/RemoteFileWorkbench.vue:919-942, src/components/remote-file/RemoteDirectoryTree.vue:430-514

- **[workspace-ui]**: 继续收紧左侧文件树的真实占位；在去掉 `block-node` 后，再进一步压缩 aggressive 模式下的树宽、层级缩进、箭头占位，并去掉 Ant Tree 节点 wrapper 自带的横向 padding，让层级前导结构更接近系统文件树 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/RemoteFileWorkbench.vue:919-942, src/components/remote-file/RemoteDirectoryTree.vue:498-513

- **[workspace-ui]**: 修正左侧文件树“参数变了但中间空白看起来没变”的问题；根因是目录树开启了整行铺满的 `block-node`，并把节点 wrapper 设成了整列宽度，导致短目录名右侧始终残留整块伪空白。现在已改为内容自适应宽度，短节点右侧不会再被整行铺满 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/remote-file/RemoteDirectoryTree.vue:9-16, src/components/remote-file/RemoteDirectoryTree.vue:507-514

- **[workspace-ui]**: 继续将嵌入式文件树间距压到更接近系统文件管理器的程度；在保留正常字号的前提下，进一步收窄 aggressive 模式下的树宽、缩进、节点高度和左右内边距，让左侧树区更贴近你最后给的参考图 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/RemoteFileWorkbench.vue:919-942

- **[workspace-ui]**: 修正嵌入式文件树“看起来是字体变小而不是间距变小”的观感；在保留紧凑树宽与间距压缩的前提下，将 aggressive 模式下的树节点字号恢复为正常大小，并同步把目录图标恢复一档，避免文件树因字太小而显得单薄 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/RemoteFileWorkbench.vue:935-941

- **[workspace-ui]**: 继续压缩嵌入式文件树与文件表格之间的横向留白；aggressive 模式下进一步收窄左侧树栏宽度，并把树区左右内边距再收一档，减少根目录和短文件名场景下树栏右侧的大块空白 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/RemoteFileWorkbench.vue:918-927

- **[workspace-ui]**: 继续将嵌入式文件树压缩到更接近系统文件管理器的密度；aggressive 模式下进一步缩窄树宽、缩进、图标尺寸与节点内边距，减少左侧树区的空白感，更贴近你给的第二张参考图 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/RemoteFileWorkbench.vue:887-941, src/components/remote-file/RemoteDirectoryTree.vue:430-514

## [0.0.27] - 2026-03-22

### 变更

- **[system-monitor]**: 修正系统监控的网卡告警来源；Rust 侧现在会批量采集接口真实 `operstate` 并返回接口类型，前端告警默认忽略 `docker0`、`veth*`、`br-*` 等常见虚拟接口，避免把容器/桥接网卡误报成异常，同时保留真实物理接口状态异常提示；已通过 `cargo check --manifest-path src-tauri/Cargo.toml` 与 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603221239_network-interface-operstate-alert](archive/2026-03/202603221239_network-interface-operstate-alert/)
  - 决策: network-interface-operstate-alert#D001(以真实链路状态替代流量推断，并忽略常见虚拟接口告警)

## [0.0.26] - 2026-03-22

### 变更

- **[ssh-workspace]**: 补齐高级 SSH 与多会话工作台底座；前端 SSH 配置现已支持 `ProxyJump`、端口转发与 `SSH config` 来源字段，设置页可直接导入 `~/.ssh/config`，Rust 侧新增真实文件选择器、SSH config 解析命令与通过跳板机 `direct-tcpip` 建连目标主机的运行时链路，SSH 工作区支持新增分屏 pane 与广播输入，且新增 `pnpm run test:regression` 以及 Rust 单元测试覆盖核心回归；已通过 `pnpm run test:regression`、`cargo test --manifest-path src-tauri/Cargo.toml`、`cargo check --manifest-path src-tauri/Cargo.toml` 与 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603221015_advanced-ssh-workflow-foundation](plan/202603221015_advanced-ssh-workflow-foundation/)
  - 决策: advanced-ssh-workflow-foundation#D001(先统一连接与工作区状态模型，再挂载功能)

### 快速修改

- **[build-optimization]**: 将 `vxe-table` 从应用入口全局注册改为仅在远程文件表格组件中局部引入，成功把主入口 chunk 从约 `511 kB` 收敛到约 `36 kB`；当前主要重量已转移到按需加载的 `SshWorkspace` chunk，首屏冷启动压力明显下降 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/main.ts:1-2, src/components/remote-file/RemoteFileTable.vue:95-97

## [0.0.25] - 2026-03-22

### 快速修改

- **[workspace-ui]**: 终端 `cd` 驱动文件管理器切换目录时，左侧目录树现在会在展开祖先节点后自动把当前目录滚动定位到可视区；不仅右侧列表会同步进入目录，左树也会跟着高亮并自动定位到对应节点 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/remote-file/RemoteDirectoryTree.vue:2-6, src/components/remote-file/RemoteDirectoryTree.vue:82-129, src/components/remote-file/RemoteDirectoryTree.vue:365-369

- **[workspace-ui]**: 为应用壳层补上统一的原生右键菜单拦截；普通空白区、连接中心和工作区默认不再弹浏览器原生菜单，仅输入框、文本域和 Monaco 编辑区保留系统右键能力 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/App.vue:3-6, src/App.vue:281-295

- **[workspace-ui]**: 修复顶部标签右键偶发落到系统默认菜单的问题；现在 `TabManager` 会在整个 `ant-tabs` 标签节点范围内统一拦截 `contextmenu`，即使点到关闭按钮、标签边缘或状态点，也会稳定打开项目自定义菜单 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/TabManager.vue:4-16, src/components/TabManager.vue:88-152

- **[workspace-ui]**: 修正激活标签页顶部描边在浅色背景下看起来像“缺了一条上边框”的问题；当前 active tab 额外补了一层顶部高光描边，并去掉上移 1px 的位移，避免顶部边线被吞掉 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/TabManager.vue:304-309

## [0.0.24] - 2026-03-22

### 变更

- **[workspace-ui]**: 为新开 tab 和工作区切换补上轻量 reveal 动效；`App.vue` 统一通过 `openTabWithMotion()` 打开标签，`TabManager` 为新标签内容增加短促滑入并恢复 `inkBar` 过渡，工作区内容区会以 240ms 左右的淡入+轻微上浮进入，不再像瞬间硬切，已通过 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603220932_ssh-tab-open-motion](plan/202603220932_ssh-tab-open-motion/)
  - 决策: ssh-tab-open-motion#D001(采用短时 CSS reveal，而不是复杂 Transition 组件重构)

## [0.0.23] - 2026-03-22

### 变更

- **[ssh-runtime]**: 优化连接中心进入 SSH 工作区的首击体验；前端现在会先创建 `connecting` 标签并立即切换工作区，Rust 侧则把 host key 校验合并进正式握手、为确认弹窗复用本次握手的 verification 缓存，从而去掉已信任主机每次连接的额外 preview 握手，已通过 `pnpm run build` 与 `cargo check --manifest-path src-tauri/Cargo.toml` 验证 — by 孟彦祖
  - 方案: [202603220914_ssh-connect-lag-investigation](plan/202603220914_ssh-connect-lag-investigation/)
  - 决策: ssh-connect-lag-investigation#D001(保留 host key 安全校验，但把校验并入正式握手)

## [0.0.22] - 2026-03-20

### 快速修改

- **[workspace-ui]**: 将嵌入式监控里的磁盘容量卡片改为按“使用百分比从高到低”排序，占用更高、更值得优先关注的挂载点会排在最前面；若占用率相同，再按剩余可用空间从小到大排序 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/RightPanel.vue:549-558

- **[workspace-ui]**: 将终端显示区统一收口为更符合终端习惯的黑底白字；即使应用处于浅色模式，`Terminal.vue` 也会继续使用深色终端配色，并把终端外层底色固定为深色，避免 SSH 终端出现整块白底观感 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/Terminal.vue:72-119, src/components/Terminal.vue:771-786

## [0.0.21] - 2026-03-20

### 变更

- **[app-shell]**: 将前端构建链升级到 `Vite 8.0.1`，同步把 `@vitejs/plugin-vue` 升到 `6.0.5`，并在现有 `manualChunks` 配置下完成 `pnpm run build` 与 `cargo check --manifest-path src-tauri/Cargo.toml` 双验证；当前残留风险是 `@tailwindcss/vite@4.2.1` 仍仅声明支持到 `Vite 7`，安装时会出现 peer 警告，但实际构建已通过 — by 孟彦祖
  - 方案: [202603201716_vite8-upgrade](archive/2026-03/202603201716_vite8-upgrade/)
  - 决策: vite8-upgrade#D001(直接升级到 Vite 8 并同步校正直接相关插件)

## [0.0.20] - 2026-03-20

### 变更

- **[workspace-ui]**: 为 SSH 断线场景补上更接近 FinalShell 的自动恢复交互；标签断开后，用户在终端按回车会先触发重连并在连接恢复后自动补发这次回车，文件管理里点击目录也会先触发重连并在恢复后自动继续进入原目录，已通过 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603201708_ssh-disconnect-auto-reconnect-actions](plan/202603201708_ssh-disconnect-auto-reconnect-actions/)
  - 决策: ssh-disconnect-auto-reconnect-actions#D001(在子组件内部挂起原操作，待 SSH 状态恢复后自动续执行)

## [0.0.19] - 2026-03-20

### 变更

- **[workspace-ui]**: 修复 SSH 标签手动断开后嵌入式系统监控仍继续拉取数据并报“SSH连接不存在”的问题；监控现在只在连接有效时持有 `connectionId`，断开后会立即停止轮询、禁用手动刷新，并切换为“已断开 / 监控已停止刷新”的静态状态，已通过 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603201659_ssh-disconnect-monitor-quiet-state](plan/202603201659_ssh-disconnect-monitor-quiet-state/)
  - 决策: ssh-disconnect-monitor-quiet-state#D001(监控连接状态跟随 SSH 标签状态失效)

## [0.0.18] - 2026-03-20

### 变更

- **[workspace-ui]**: 为顶部标签栏增加了与远程文件工作台一致风格的右键菜单，支持“连接、连接全部、断开、关闭、关闭其他、关闭全部”；所有标签都可右键，非 SSH 标签的连接类动作自动置灰，SSH 标签会根据已连接/已断开状态切换“连接 / 断开”的可用性，且手动断开后会保留标签方便再次连接；已通过 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603201654_tab-context-menu-ssh-actions](plan/202603201654_tab-context-menu-ssh-actions/)
  - 决策: tab-context-menu-ssh-actions#D001(复用文件管理右键菜单并在 App 层维护 SSH 标签状态)

## [0.0.17] - 2026-03-20

### 变更

- **[workspace-ui]**: 修复 SSH 工作区切换到其他标签再返回后终端区域被错误压缩到近似最小高度的问题；`SshWorkspace` 现在会在隐藏态跳过无效尺寸同步，并在标签重新激活后补做分栏恢复与终端 `resize` 刷新，已通过 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603201644_ssh-tab-terminal-fit-recovery](plan/202603201644_ssh-tab-terminal-fit-recovery/)
  - 决策: ssh-tab-terminal-fit-recovery#D001(在 SshWorkspace 中修复标签恢复尺寸同步)

## [0.0.16] - 2026-03-20

### 快速修改

- **[workspace-ui]**: 将连接中心的默认视图从列表切换为卡片视图，并同步调整组件默认值、程序配置默认值以及本地配置回退值，确保首次进入连接中心时优先展示卡片列表 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/ConnectionHub.vue:282-287, src/components/SettingsModal.vue:144-151, src/services/ThemeService.ts:21-28

- **[workspace-ui]**: 移除远程文件工作台顶部路径栏里的重复“显示隐藏文件”按钮，仅保留底部状态栏里的同一开关，避免同一功能在上下两处重复出现 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/RemoteFileWorkbench.vue:5-18, src/components/remote-file/RemotePathBar.vue:41-85

- **[workspace-ui]**: 移除“关键资源”卡片右侧的趋势图与对应占位文案，资源行现在只保留状态、数值和进度条，避免在无历史数据时出现大块空白趋势区 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/RightPanel.vue:128-146, src/components/RightPanel.vue:678-713

- **[workspace-ui]**: 将系统监控头部的按钮组上移到“需关注”标签同一行，手动刷新改为纯图标按钮，并把最近刷新时间下移到按钮组下方，整体层级更接近主机信息区的右侧操作栏 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/RightPanel.vue:20-38, src/components/RightPanel.vue:1742-1768, src/components/RightPanel.vue:2297-2319

- **[workspace-ui]**: 修正系统监控头部右侧操作组的宽度约束，移除 `width: 100%` 导致的溢出问题，让折叠按钮重新回到可视区并稳定贴在工具区最右侧 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/components/RightPanel.vue:1756-1761

- **[workspace-ui]**: 收紧“终端目录同步文件管理”的触发时机，取消 `cd` 提交瞬间的乐观目录切换，改为只信任 shell 实际返回的当前目录标记；同时为文件区目录加载增加请求序号保护，并把提示符解析改成跨 chunk 拼接、静默直载，避免 `/usr/local` 这类目录在终端已切换时文件区既不报错也不跟进 — by Codex
  - 类型: 快速修改（无方案包）
  - 文件: src/components/Terminal.vue:89-177, src/components/Terminal.vue:238-278, src/components/RemoteFileWorkbench.vue:174-350

## [0.0.15] - 2026-03-20

### 变更

- **[workspace-ui]**: 将 SSH 工作区左侧系统监控头部的折叠按钮从主机名标题行中移出，改为并入右侧工具区并固定贴近卡片右边缘，避免按钮夹在标题与健康标签之间打断阅读流；已通过 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603201507_monitor-collapse-button-edge](archive/2026-03/202603201507_monitor-collapse-button-edge/)
  - 决策: monitor-collapse-button-edge#D001(将折叠按钮移入头部右侧工具区)

## [0.0.14] - 2026-03-20

### 变更

- **[ssh-auth]**: 将首次连接/主机密钥变化的确认交互从“两步弹窗”收敛为单个三选项弹窗，用户现在可直接在同一层选择“拒绝连接 / 仅本次信任 / 信任并保存”，减少一次额外点击 — by 孟彦祖
  - 类型: 快速修改（无方案包）
  - 文件: src/services/SshService.ts:199-267

- **[workspace-ui]**: 收紧远程文件表格的目录拖放链路，目录行现在会稳定接住内部拖拽移动，并新增“禁止把文件夹拖进自身子目录”的前置保护与批量移动结果提示，避免整理目录时误拖后只看到静默失败 — by Codex

- **[workspace-ui]**: 将远程文件内部拖动状态同步到左侧目录树，支持把右侧文件直接拖到树节点完成移动，并沿用相同的非法目标校验与高亮提示，整理多层目录时不必先切换到目标目录 — by Codex

- **[workspace-ui]**: 收口远程文件表格的选择交互，补强 `Shift` 范围选择、空白区单击清空和 `Cmd/Ctrl + A` 全选，并让这些逻辑统一基于当前可见排序结果工作，避免筛选或文件名拖动手势下出现选择锚点漂移 — by Codex

- **[workspace-ui]**: 让左侧远程目录树复用工作台现有文件菜单与内部拖动状态，支持树节点右键操作、目录树内拖拽移动，并在新建/重命名/删除/移动后主动刷新树缓存，避免树结构停留在旧状态 — by Codex

- **[workspace-ui]**: 将远程文件区的重命名从弹窗改为行内编辑，右键触发后在表格行或目录树节点内直接进入输入态，并统一使用 `Enter` 确认、`Esc` 取消、失焦自动确认，减少目录整理时的弹窗打断 — by Codex

- **[workspace-ui]**: 将 SSH 文件工作台的目录树、文件表格和相关输入框接到终端设置里的字体族配置，远程文件区现在会跟随“程序配置 → 字体族”同步切换，避免终端与文件区字体割裂 — by Codex

- **[workspace-ui]**: 参考 FinalShell 一类文件面板的层次感，压深 SSH 文件区主体底色与选中/悬停对比，并替换目录树/文件表格里的默认线框图标为更接近系统文件管理器风格的本地 SVG 文件夹/文件图标，让文件区更耐看也更易扫读 — by Codex

- **[workspace-ui]**: 为远程文件工作台补上路径集合驱动的多选状态、拖拽框选、`Shift` 连续点选、空白区单击清空、`Cmd/Ctrl + A` 当前视图全选、上下方向键移动当前选中项、`Delete/Backspace` 快捷删除，以及把已选条目直接拖放到目录行内完成移动，目录整理时可直接框选、键盘选择后右键、快捷删除或拖入文件夹；已通过 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603201037_remote-file-multiselect-context-menu](plan/202603201037_remote-file-multiselect-context-menu/)
  - 决策: remote-file-multiselect-context-menu#D001(远程文件多选以路径集合为唯一状态源)

## [0.0.13] - 2026-03-20

### 变更

- **[workspace-ui]**: 将 SSH 工作区左侧系统监控重构为约 960px 的现代运维仪表盘，采用 `a-card`、`a-statistic`、`a-progress`、`a-alert` 与 `a-table` 重排首屏概览、关键资源、实时告警、Top 进程、磁盘和网络接口信息，并补充前端短期趋势图与颜色分级规则，显著提升信息密度与运维可读性；已通过 `pnpm run build` 验证 — by 孟彦祖
  - 方案: [202603200927_monitor-dashboard-redesign](plan/202603200927_monitor-dashboard-redesign/)
  - 决策: monitor-dashboard-redesign#D001(在现有 RightPanel 基础上扩展左侧宽仪表盘，而不是新建独立监控工作台)

## [0.0.12] - 2026-03-19

### 变更

- **[workspace-ui]**: 将连接中心结果条与搜索操作条合并成同一行，让搜索框、“新增连接”和结果数集中在列表上方同排展示，减少一层纵向占用 — by 孟彦祖

- **[workspace-ui]**: 将 SSH 工作区的默认上下分割比例调整为终端 40% / 文件管理 60%，让 Explorer 在默认打开时获得更稳定的可视空间 — by 孟彦祖

- **[workspace-ui]**: 移除远程文件工作台里的英文眉题与操作说明文案，保留中文标题和核心功能，减少界面噪音 — by 孟彦祖

- **[workspace-ui]**: 将远程目录操作按钮缩小后并入“目录”标题旁，减少顶部横向噪音，让树面板操作更贴近目录本身 — by 孟彦祖

- **[workspace-ui]**: 将“筛选当前目录”控件移入“当前目录”标题栏，移除右上角文件计数与顶部文件头，进一步压平远程文件区层级 — by 孟彦祖

- **[workspace-ui]**: 在“当前目录”标题栏恢复目录/文件与项数摘要，保留筛选就近布局的同时补回必要的数量反馈 — by 孟彦祖

- **[workspace-ui]**: 将路径面包屑并入“当前目录”标题栏并缩小显示，去掉独立路径行，继续压缩远程文件区纵向占用 — by 孟彦祖

- **[workspace-ui]**: 进一步放松左侧“目录”标题栏的操作密度，缩小按钮并拉开标题与操作组距离，缓解树面板头部拥挤感 — by 孟彦祖

- **[workspace-ui]**: 将系统监控从窗口外侧右栏改为嵌入 SSH 工作区内部左侧，让监控明确属于当前 SSH 标签上下文，同时保留外侧右栏继续承载传输管理 — by 孟彦祖

- **[workspace-ui]**: 将 SSH 内嵌系统监控改为默认展开并恢复宽度过渡动画，避免进入 SSH 标签后仍需手动展开，且保证收起/展开体验与传输面板一致 — by 孟彦祖

- **[workspace-ui]**: 系统监控改为可见即立即拉取首屏数据，再进入自动刷新循环，避免嵌入 SSH 后首屏长时间停留在占位值 — by 孟彦祖

- **[workspace-ui]**: 在连接中心强制隐藏右侧监控/传输面板，并同步收口状态栏激活态，避免无连接上下文时显示无意义侧栏 — by 孟彦祖

- **[workspace-ui]**: 重构系统监控信息布局，按更高密度的信息面板方式重排系统/CPU/内存/磁盘/网络区块，在不照搬 FinalShell 视觉的前提下压缩留白并提高同屏可读信息量 — by 孟彦祖

- **[workspace-ui]**: 磁盘监控改为默认仅展示核心两项并支持展开更多挂载点，同时补回可用/总量字段并将进度条、容量文字与文件系统标签压缩到同一行，参考 FinalShell 的高密度信息组织方式 — by 孟彦祖

- **[workspace-ui]**: 为系统监控新增 FinalShell 风格的活跃进程小表，展示 Top 进程的内存、CPU 与命令摘要，并补回进程总数/运行中/休眠统计 — by 孟彦祖

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
