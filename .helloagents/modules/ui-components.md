# ui-components

## 职责

- 承载顶部导航、标签栏、侧边栏、文件管理、监控下载、终端配置等前端交互组件
- 负责将主题变量映射到具体 UI 组件与业务操作流

## 本次迁移更新

- 组件脚本中的 `message`、`Modal` 和图标导入已统一迁移到 `antdv-next` 生态
- `TopMenu` 已改为 `items` 模式菜单，避免依赖旧的嵌套子菜单结构
- `TabManager` 已改为 `items` 模式标签页，减少对旧 `TabPane` 结构的依赖
- `SettingsModal`、`SshModal` 已将 `Input.Group` 风格写法替换为 `Space.Compact`
- `Sidebar` 的连接列表已改为原生结构渲染，避免继续依赖旧 `List` 子组件层级

## 关键文件

- [`src/components/TopMenu.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/TopMenu.vue)
- [`src/components/TabManager.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/TabManager.vue)
- [`src/components/Sidebar.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/Sidebar.vue)
- [`src/components/SettingsModal.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/SettingsModal.vue)
- [`src/components/SshModal.vue`](/Users/mengjia/WebstormProjects/Termlink/src/components/SshModal.vue)
