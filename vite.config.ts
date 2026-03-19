import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import type { ComponentResolver } from 'unplugin-vue-components'

const antdvStyleModules = [
  '@antdv-next/cssinjs',
  'antdv-next/dist/style',
  'antdv-next/dist/theme',
  'antdv-next/dist/config-provider',
  'antdv-next/dist/_util'
]

const antdvDateModules = [
  'dayjs',
  'rc-picker',
  'antdv-next/dist/date-picker',
  'antdv-next/dist/time-picker',
  'antdv-next/dist/calendar',
  'antdv-next/dist/locale'
]

const antdvDataEntryModules = [
  'antdv-next/dist/auto-complete',
  'antdv-next/dist/cascader',
  'antdv-next/dist/form',
  'antdv-next/dist/input',
  'antdv-next/dist/input-number',
  'antdv-next/dist/select',
  'antdv-next/dist/tree-select'
]

const antdvStructureModules = [
  'antdv-next/dist/dropdown',
  'antdv-next/dist/menu',
  'antdv-next/dist/modal',
  'antdv-next/dist/splitter',
  'antdv-next/dist/table',
  'antdv-next/dist/tabs',
  'antdv-next/dist/tree',
  'antdv-next/dist/upload'
]

const antdvFeedbackModules = [
  'antdv-next/dist/alert',
  'antdv-next/dist/badge',
  'antdv-next/dist/button',
  'antdv-next/dist/card',
  'antdv-next/dist/checkbox',
  'antdv-next/dist/descriptions',
  'antdv-next/dist/divider',
  'antdv-next/dist/empty',
  'antdv-next/dist/message',
  'antdv-next/dist/notification',
  'antdv-next/dist/popconfirm',
  'antdv-next/dist/popover',
  'antdv-next/dist/progress',
  'antdv-next/dist/radio',
  'antdv-next/dist/result',
  'antdv-next/dist/segmented',
  'antdv-next/dist/skeleton',
  'antdv-next/dist/space',
  'antdv-next/dist/spin',
  'antdv-next/dist/statistic',
  'antdv-next/dist/steps',
  'antdv-next/dist/switch',
  'antdv-next/dist/tag',
  'antdv-next/dist/tooltip',
  'antdv-next/dist/typography'
]

const antdvComponentResolver: ComponentResolver = (componentName) => {
  if (!/^A[A-Z]/.test(componentName)) {
    return
  }

  const specialNameMap: Record<string, string> = {
    ATextarea: 'TextArea',
    AUploadDragger: 'UploadDragger',
  }

  return {
    name: specialNameMap[componentName] || componentName.slice(1),
    from: 'antdv-next',
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    AutoImport({
      dts: 'src/auto-imports.d.ts',
      imports: [
        {
          'antdv-next': ['Input', 'Modal', 'message'],
        },
      ],
      vueTemplate: true,
    }),
    Components({
      dts: 'src/components.d.ts',
      resolvers: [antdvComponentResolver],
    }),
  ],
  optimizeDeps: {
    include: ['monaco-editor']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('monaco-editor')) {
            return 'monaco-vendor'
          }

          if (id.includes('@xterm')) {
            return 'xterm-vendor'
          }

          if (id.includes('@antdv-next/icons')) {
            return 'antdv-icons-vendor'
          }

          if (antdvStyleModules.some((segment) => id.includes(segment))) {
            return 'antdv-style-vendor'
          }

          if (antdvDateModules.some((segment) => id.includes(segment))) {
            return 'antdv-date-vendor'
          }

          if (id.includes('antdv-next/dist/antd.esm.js')) {
            return 'antdv-entry-vendor'
          }

          if (antdvDataEntryModules.some((segment) => id.includes(segment))) {
            return 'antdv-data-entry-vendor'
          }

          if (antdvStructureModules.some((segment) => id.includes(segment))) {
            return 'antdv-structure-vendor'
          }

          if (antdvFeedbackModules.some((segment) => id.includes(segment))) {
            return 'antdv-feedback-vendor'
          }

          if (id.includes('antdv-next') || id.includes('@antdv-next')) {
            return 'antdv-display-vendor'
          }

          if (id.includes('@tauri-apps')) {
            return 'tauri-vendor'
          }

          if (id.includes('/vue/') || id.includes('@vue/')) {
            return 'vue-vendor'
          }
        }
      }
    }
  }
})
