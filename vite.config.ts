import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import type { ComponentResolver } from 'unplugin-vue-components'

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
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
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

          if (id.includes('vxe-table') || id.includes('vxe-pc-ui')) {
            return 'vxe-vendor'
          }

          if (
            id.includes('antdv-next')
            || id.includes('@antdv-next')
            || id.includes('dayjs')
            || id.includes('rc-picker')
          ) {
            return 'antdv-vendor'
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
}))
