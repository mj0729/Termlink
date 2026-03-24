# ui-components

## 职责

- 承载顶部导航、标签栏、侧边栏、文件管理、监控下载、终端配置等前端交互组件
- 负责将主题变量映射到具体 UI 组件与业务操作流

## 本次迁移更新

- `SshService` 现已在 SSH 建连后的 bootstrap 中注入幂等 cwd shell hook：为 bash 拼接 `PROMPT_COMMAND`、为 zsh 注册 `precmd`，并在会话级重写 `cd` 成功路径后立即发出 `TERMLINK_CWD` marker，进一步修正 Rocky Linux 这类 prompt 不稳定场景下的目录同步；对应 bootstrap 现已压成单行注入，并由 `Terminal` 按 `__TERMLINK_BOOTSTRAP=1;` 到首个真实 cwd marker 的区间做流式剥离，避免连接首屏露出整段 hook 脚本
- `Terminal` 的 SSH 当前目录同步已修正为“会话内推导优先”的兼容策略：保留 `TERMLINK_CWD` 标记和绝对路径提示符解析，同时移除 basename 提示符场景下走独立 `executeCommand('pwd')` 的错误兜底，改为跟踪简单 `cd` 命令并在下一次提示符返回时回填 cwd，避免 Rocky Linux 等服务器把文件管理误同步回登录目录
- `RemoteDirectoryTree` 的左侧目录树已修正一次过度压缩带来的错行问题：aggressive 模式下的 `switcher/indent` 宽度从激进值回调一档，同时直接去掉 `.ant-tree-treenode` 默认外边距并固定 switcher 对齐，使展开箭头与文件夹图标重新回到同一行，且节点间距仍比初始状态更紧
- `RemoteDirectoryTree` 的左侧目录树又继续收紧了一档：SSH 工作区 aggressive 模式下的节点最小高度从 `17px` 下调到 `15px`，节点行高从 `18px` 收到 `16px`，树内联编辑输入框高度也同步收口到 `15px`，仅继续压缩节点纵向占位，不改变缩进、图标和字体大小
- `RemoteDirectoryTree` 的左侧目录树现已继续收紧节点高度：SSH 工作区 aggressive 模式下的节点最小高度从 `19px` 下调到 `17px`，重命名输入框高度也同步收口到 `17px`，仅压缩节点的纵向占位，不改变字体大小、图标尺寸和层级缩进
- `RemoteFileTable` 的正文列表现已进一步收紧：compact 模式下的正文行高从 `28px` 下调到 `26px`，仅压缩文件列表每一行的垂直占位，不联动图标尺寸、文字字号和名称列内部间距，让列表整体更接近桌面文件管理器的紧凑密度
- `RemoteFileTable` 的表头紧凑化样式链已修正到真实命中层：此前仅下调 `--remote-table-header-height` 不足以改变视觉高度，因为 `vxe-table` 默认的 `.vxe-table--render-default .vxe-header--column.is--padding .vxe-cell` 仍通过更高优先级的上下 padding 撑高表头；现在已显式覆盖该 header padding 与高度层级，并通过 `header-row-style / header-cell-style` 内联到组件节点，红框区域会真实收紧，同时不影响路径栏、搜索栏和正文行高
- `RemoteFileTable` 的列表表头现已进一步压缩：表头高度变量从 `28px` 下调到 `24px`，只收紧列标题横条本身，不改路径栏、搜索栏或正文行高，让 SSH 远程文件工作台在紧凑桌面布局里腾出更多垂直可视空间，同时保留排序和列拖拽的操作热区
- `Terminal` 已把终端右键菜单抽到共享工具函数，并收掉一批未实际参与行为判断的 SSH 会话本地缓存；SSH 终端在隐藏标签页时现在会解除事件订阅，重新激活时再按快照回放恢复，避免隐藏工作区持续消费 SSH 输出流
- `RemoteFileWorkbench` 已把重命名、创建目录、删除、拖拽移动、`chmod/chown` 等变更型操作统一抽到 `useRemoteFileActions`，共享“执行命令 → 刷新列表 → 刷新树 → 记录审计”的副作用链，搜索结果也恢复为“先过滤、再排序”的一致数据流
- `RightPanel` 现在会把“监控是否可见”作为轮询前置条件：切到下载面板或折叠后会立即停止刷新，不再在用户根本没看监控时继续拉系统信息
- `RightPanel` 的传输分组、筛选和队列操作已继续下沉到 `useRightPanelTransfers`，组件本身开始从“同时管理监控和传输细节”向“壳层 + 视图装配”收口
- `RightPanel` 的系统监控现已正式拆成 `useRightPanelMonitor` 与 `rightPanelMonitorDerived` 两层：前者只负责 SSH 批量拉取、轮询启停与主题监听，后者只负责派生视图状态、告警、排序和格式化，让监控运行时与展示模型职责分离
- `RightPanel` 的监控刷新失败现在在恢复成功前只提示一次，不再因为轮询持续失败而把同一条错误反复刷满；同时移除了未参与展示的 CPU / 内存 / 磁盘历史缓存，减少无意义响应式更新
- `RightPanel` 现已进一步收口为面板切换壳层：系统监控模板与样式整体下沉到 `RightPanelMonitorView`，父组件仅保留“监控视图 / 传输视图”切换、传输队列装配与对外暴露方法，`RightPanel.vue` 体积已从数千行降到数百行级别
- `RightPanel` 的监控样式也同步去重重写为子组件内聚样式，避免历史叠加的多轮覆盖规则继续滞留在父组件；本轮构建产物中 `RightPanel` 相关 CSS 体积已明显收缩
- `RightPanelMonitorView` 又继续往下拆成 `RightPanelMonitorHero`、`RightPanelMonitorResources`、`RightPanelMonitorProcesses`、`RightPanelMonitorStorageNetwork` 四个无状态展示组件，并补了一层 `monitorViewTypes` 共享展示模型，避免拆分后再次出现重复 props 形状和隐式数据契约
- 拆分后 `RightPanelMonitorView` 自身只保留监控组合式接线与布局编排，监控区从“单组件模板 + 大段样式”转成“容器编排 + 展示块职责分离”；相关 CSS 产物继续从约 `26 kB` 收缩到约 `22.6 kB`
- 继续拆分后暴露出的一个问题是：原先嵌入式监控的紧凑样式有一部分仍停留在父级作用域，`scoped` 后无法继续作用到子组件内部；现已把这批“嵌入式紧凑模式”样式分别下沉到 `Hero / Resources / Processes / StorageNetwork` 子组件中，恢复 SSH 左侧监控在窄栏里的可读密度
- 当前又补了一层共享样式基座 `monitorShared.css`：`Resources / Processes / StorageNetwork` 共同复用卡片外壳、分区标题、通用 chip 和暗色态基准样式，各子组件只保留自己的布局细节与紧凑态差异，重复样式规则明显减少
- 共享样式层后续又进一步修正为“容器单点引入”模式：`monitorShared.css` 现在只由 `RightPanelMonitorView` 引入一次，并通过 `.right-panel-monitor` 前缀约束作用域，避免此前每个子组件各自 `scoped` 引入同一份共享样式导致构建产物重复膨胀
- `SshWorkspace` 已清理 pane 结构里的无效 `title` 状态，并把 `filesDrawerOpen` 的重复 watcher 合并为单一路径，减少布局恢复副作用的重复触发点
- `RemoteFileWorkbench` 与 `RemoteDirectoryTree` 已收紧嵌入式文件管理区的视觉密度：aggressive 模式下移除内容区圆角，左侧目录树进一步压到接近系统文件树的极窄横向占位，并同步压缩节点高度、缩进与内边距，但保留正常可读字号，整体更接近桌面文件管理器的硬朗紧凑观感
- `RemoteDirectoryTree` 已取消树节点整行铺满的 `block-node` 呈现，并把节点 wrapper 从整列占满改为内容自适应宽度，避免短目录名（如 `/`、`boot`）右侧继续残留大块“伪空白”
- `RemoteDirectoryTree` 的 Ant Tree 外层默认留白也已被进一步收掉：aggressive 模式下继续压缩缩进宽度、箭头占位和节点 wrapper 自带 padding，让树节点更贴近系统文件树的紧凑层级
- 针对过度压缩导致的左树可读性下降，`RemoteFileWorkbench`/`RemoteDirectoryTree` 已把 aggressive 模式下的箭头占位、缩进宽度、图标尺寸和节点间距回调到“紧凑但不拥挤”的平衡值，避免箭头、图标、文本相互打架
- `RemoteDirectoryTree` 已按系统文件树风格重做一轮结构样式：节点标题、`ant-tree-title` 与 `ant-tree-node-content-wrapper` 统一改为内容自适应宽度，当前选中态从重按钮感改成更轻的胶囊高亮，配合更稳的树宽、缩进和前导结构，避免短目录名右侧空白过大或层级前导挤压失真
- `RemoteDirectoryTree` 已修正一次误设的节点宽度约束：此前 `ant-tree-treenode` 仍被 `min-width: 100%` 强行撑满整列，导致视觉上看起来“怎么改都没变化”；现在已改为真正按内容宽度收口
- `RemoteDirectoryTree` 现已对 Ant Tree 默认的 `flex / width` 占位做强制覆盖：`ant-tree-treenode`、`ant-tree-title` 与 `ant-tree-node-content-wrapper` 都改为内容宽度收口，避免库默认的整行布局再次把短目录名撑回整列
- `TabManager` 现在会为新建标签提供一次性轻滑入动效，并重新启用 `inkBar` 过渡；整体风格偏轻盈克制，不影响终端工作流
- `ConnectionHub` 点击已保存连接时不再等待后端建连完成后才切换工作区，而是立即打开 SSH 标签页并展示 `connecting` 中间态
- `TabManager`、`Terminal`、`RemoteFileWorkbench`、`SshWorkspace` 已统一支持 `connecting / connected / disconnected` 三态；只有 `connected` 才会绑定终端会话、加载远程文件和启动嵌入式监控
- 组件脚本中的 `message`、`Modal` 和图标导入已统一迁移到 `antdv-next` 生态
- `TopMenu` 仍作为独立组件保留在仓库中，本轮已将内部原生按钮统一为 `a-button`，但它当前未接入主应用壳层
- `TabManager` 已改为 `items` 模式标签页，减少对旧 `TabPane` 结构的依赖
- `TabManager` 现在支持右键菜单，视觉复用远程文件工作台的 `FileContextMenu`；所有标签都可右键，非 SSH 标签的连接类动作会自动置灰，SSH 标签会根据已连接/已断开状态切换“连接 / 断开”的可用性
- `SettingsModal`、`SshModal` 已将 `Input.Group` 风格写法替换为 `Space.Compact`
- `SettingsModal` 已从单列表单重构为“左侧分类导航 + 右侧设置内容”的双栏设置中心，现有终端、主题与存储项被重新组织为常规/终端/外观/存储四个分区，后续可继续沿分类配置化扩展，而不必再次重写整体布局
- `Sidebar` 的连接列表已改为原生结构渲染，避免继续依赖旧 `List` 子组件层级
- `ConnectionHub` 的分组筛选与连接卡片已统一为 `a-segmented`、`a-card`、`a-tag` 组合，保留高密度 SSH 工作台信息布局
- `StatusBar` 的设置、监控和传输入口已统一为 `a-button` 文本按钮，和其他工作台工具控件共享交互反馈
- `RightPanel` 的传输筛选已统一为 `a-segmented`，不再保留独立原生 pill 按钮实现
- `RightPanel` 的嵌入式系统监控已重构为左侧宽仪表盘，采用 `a-card + a-statistic + a-progress + a-alert + a-table` 组合，首屏强化资源状态、实时告警、Top 进程和磁盘/网络分区信息
- `RightPanel` 的网络告警现在基于后端返回的真实 `operstate` 判定，并默认忽略 `docker0`、`veth*`、`br-*` 等常见虚拟接口，避免把容器/桥接网卡误报成异常
- `RightPanel` 的嵌入式系统监控头部已调整为“信息在左、操作在右”的结构，折叠按钮不再夹在主机名与健康标签之间，而是固定贴在头部最右侧操作区
- 系统监控新增前端短周期历史缓存，用于 CPU / 内存 / 根磁盘 / 网络吞吐的轻量趋势图，不依赖额外图表库
- `RightPanel` 在 SSH 标签断开后会立即停止监控轮询、禁用手动刷新，并将状态胶囊与摘要切换为“已断开 / 监控已停止刷新”的静态提示，不再继续弹出“SSH连接不存在”错误
- `SshWorkspace` 在窄屏纵向堆叠场景下提高了监控区最大高度，避免宽仪表盘被截断
- `SshWorkspace` 现在会在标签重新激活后补做一次分栏高度恢复，并在隐藏状态下跳过无效尺寸同步，避免 SSH 终端切换标签回来后被错误压缩到近似最小高度
- `SshWorkspace` 现在会把 SSH 连接状态继续下发到终端和远程文件工作台；断线后用户在终端按回车或在文件管理中点击目录时，会先触发重连，连接恢复后再自动继续原来的回车或目录进入操作
- `RemoteFileWorkbench` 的远程文件表格现已支持路径集合驱动的多选、拖拽框选、`Shift` 连续点选、空白区单击清空、`Cmd/Ctrl + A` 当前视图全选、上下方向键移动当前选中项、`Delete/Backspace` 快捷删除，以及把已选条目直接拖放到目录行内完成移动
- `FileEditor` 的大文本 `textarea` 与隐藏文件上传 `input` 仍保留原生实现，原因是它们属于性能敏感或平台能力敏感路径，不作为 UI 库统一目标
- `TopMenu.vue` 当前未接入主应用壳层，仍有原生按钮遗留；后续若恢复使用，应继续按 `antdv-next` 体系收口

## 关键文件

- [`src/components/TopMenu.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/TopMenu.vue)
- [`src/components/TabManager.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/TabManager.vue)
- [`src/components/Sidebar.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/Sidebar.vue)
- [`src/components/SettingsModal.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/SettingsModal.vue)
- [`src/components/SshModal.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/SshModal.vue)
- [`src/components/ConnectionHub.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/ConnectionHub.vue)
- [`src/components/StatusBar.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/StatusBar.vue)
- [`src/components/RightPanel.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/RightPanel.vue)
- [`src/components/RemoteFileWorkbench.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/RemoteFileWorkbench.vue)
