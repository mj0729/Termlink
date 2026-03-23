import { createApp, h } from 'vue'
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks'
import RemoteDirectoryTree from './components/remote-file/RemoteDirectoryTree.vue'
import './style.css'

document.body.dataset.theme = 'light'

mockWindows('main')
mockIPC((cmd, args) => {
  if (cmd !== 'list_sftp_files') return []
  const path = args?.path as string
  const map: Record<string, Array<{ name: string; path: string; is_dir: boolean; is_directory: boolean }>> = {
    '/': [
      { name: 'bin.usr-is-me...', path: '/bin.usr-is-me...', is_dir: true, is_directory: true },
      { name: 'boot', path: '/boot', is_dir: true, is_directory: true },
      { name: 'cdrom', path: '/cdrom', is_dir: true, is_directory: true },
      { name: 'data', path: '/data', is_dir: true, is_directory: true },
      { name: 'dev', path: '/dev', is_dir: true, is_directory: true },
      { name: 'docker', path: '/docker', is_dir: true, is_directory: true },
      { name: 'etc', path: '/etc', is_dir: true, is_directory: true },
      { name: 'home', path: '/home', is_dir: true, is_directory: true },
      { name: 'lib.usr-is-me...', path: '/lib.usr-is-me...', is_dir: true, is_directory: true },
    ],
    '/dev': [
      { name: 'block', path: '/dev/block', is_dir: true, is_directory: true },
      { name: 'bus', path: '/dev/bus', is_dir: true, is_directory: true },
      { name: 'char', path: '/dev/char', is_dir: true, is_directory: true },
      { name: 'cpu', path: '/dev/cpu', is_dir: true, is_directory: true },
    ],
  }
  return map[path] ?? []
})

const noop = () => {}

createApp({
  render() {
    return h('div', { class: 'remote-tree-debug remote-workbench remote-workbench--aggressive remote-workbench--compact' }, [
      h('div', { class: 'remote-tree-debug__frame' }, [
        h(RemoteDirectoryTree as any, {
          connectionId: 'debug',
          currentPath: '/dev',
          showHidden: false,
          internalDragActive: false,
          internalDragTargetPath: '',
          internalDragSourcePaths: [],
          renameView: '',
          renamePath: '',
          renameValue: '',
          onSelect: noop,
          onInternalDragTargetChange: noop,
          onInternalDragChange: noop,
          onDragMove: noop,
          onContextMenu: noop,
          onRenameValueChange: noop,
          onRenameSubmit: noop,
          onRenameCancel: noop,
        }),
      ]),
    ])
  },
}).mount('#app')

const style = document.createElement('style')
style.textContent = `
  body {
    margin: 0;
    background: #f4f4f2;
  }

  .remote-tree-debug {
    width: 180px;
    min-width: 180px;
    max-width: 180px;
    height: 320px;
  }

  .remote-tree-debug__frame {
    height: 100%;
    display: flex;
    border: 1px solid #e5e7eb;
    background: #fff;
  }
`
document.head.appendChild(style)
