# ui-components

## 职责

- 承载顶部导航、标签栏、侧边栏、文件管理、监控下载、终端配置等前端交互组件
- 负责将主题变量映射到具体 UI 组件与业务操作流

## 本次迁移更新

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
