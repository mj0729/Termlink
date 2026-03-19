# ui-components

## 职责

- 承载顶部导航、标签栏、侧边栏、文件管理、监控下载、终端配置等前端交互组件
- 负责将主题变量映射到具体 UI 组件与业务操作流

## 本次迁移更新

- 组件脚本中的 `message`、`Modal` 和图标导入已统一迁移到 `antdv-next` 生态
- `TopMenu` 仍作为独立组件保留在仓库中，本轮已将内部原生按钮统一为 `a-button`，但它当前未接入主应用壳层
- `TabManager` 已改为 `items` 模式标签页，减少对旧 `TabPane` 结构的依赖
- `SettingsModal`、`SshModal` 已将 `Input.Group` 风格写法替换为 `Space.Compact`
- `Sidebar` 的连接列表已改为原生结构渲染，避免继续依赖旧 `List` 子组件层级
- `ConnectionHub` 的分组筛选与连接卡片已统一为 `a-segmented`、`a-card`、`a-tag` 组合，保留高密度 SSH 工作台信息布局
- `StatusBar` 的设置、监控和传输入口已统一为 `a-button` 文本按钮，和其他工作台工具控件共享交互反馈
- `RightPanel` 的传输筛选已统一为 `a-segmented`，不再保留独立原生 pill 按钮实现
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
