# 变更记录

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
