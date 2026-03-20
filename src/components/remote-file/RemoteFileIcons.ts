import { defineComponent, h } from 'vue'

function createSvgComponent(name: string, content: string, viewBox = '0 0 24 24') {
  return defineComponent({
    name,
    setup(_, { attrs }) {
      return () => h('svg', {
        viewBox,
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg',
        'aria-hidden': 'true',
        ...attrs,
        innerHTML: content,
      })
    },
  })
}

function createFileIcon(name: string, accent: string) {
  return createSvgComponent(name, `
    <path d="M7 2.75h6.4L18.75 8v12.2a1.8 1.8 0 0 1-1.8 1.8H7a1.8 1.8 0 0 1-1.8-1.8V4.55A1.8 1.8 0 0 1 7 2.75Z" fill="var(--remote-file-paper)" stroke="var(--remote-file-stroke)" stroke-width="1.15" stroke-linejoin="round"/>
    <path d="M13.4 2.75V6.7A1.3 1.3 0 0 0 14.7 8h4.05" fill="var(--remote-file-fold)"/>
    <path d="M13.4 2.75V6.7A1.3 1.3 0 0 0 14.7 8h4.05" stroke="var(--remote-file-stroke)" stroke-width="1.15" stroke-linejoin="round"/>
    <rect x="8.2" y="10.4" width="7.6" height="1.7" rx="0.85" fill="${accent}"/>
    <rect x="8.2" y="13.6" width="6.2" height="1.45" rx="0.72" fill="var(--remote-file-fold)"/>
    <rect x="8.2" y="16.4" width="5.1" height="1.45" rx="0.72" fill="var(--remote-file-fold)"/>
  `)
}

export const FolderTreeIcon = createSvgComponent('FolderTreeIcon', `
  <path d="M3.1 6.35A2.1 2.1 0 0 1 5.2 4.25h4.45l1.55 1.7h7.6a2.1 2.1 0 0 1 2.1 2.1v8.95a2.35 2.35 0 0 1-2.35 2.35H5.45A2.35 2.35 0 0 1 3.1 17V6.35Z" fill="var(--remote-folder-top)"/>
  <path d="M3.1 8.2h17.8v8.8a2.35 2.35 0 0 1-2.35 2.35H5.45A2.35 2.35 0 0 1 3.1 17V8.2Z" fill="var(--remote-folder-body)"/>
  <path d="M3.1 6.35A2.1 2.1 0 0 1 5.2 4.25h4.45l1.55 1.7h7.6a2.1 2.1 0 0 1 2.1 2.1v8.95a2.35 2.35 0 0 1-2.35 2.35H5.45A2.35 2.35 0 0 1 3.1 17V6.35Z" stroke="var(--remote-folder-stroke)" stroke-width="1.05" stroke-linejoin="round"/>
`)

export const FilePageIcon = createFileIcon('FilePageIcon', 'var(--remote-file-accent-generic)')
export const FileTextIcon = createFileIcon('FileTextIcon', 'var(--remote-file-accent-text)')
export const FileImageIcon = createFileIcon('FileImageIcon', 'var(--remote-file-accent-image)')
export const FileArchiveIcon = createFileIcon('FileArchiveIcon', 'var(--remote-file-accent-archive)')
export const FileVideoIcon = createFileIcon('FileVideoIcon', 'var(--remote-file-accent-video)')
export const FileAudioIcon = createFileIcon('FileAudioIcon', 'var(--remote-file-accent-audio)')
