import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
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

          if (id.includes('antdv-next') || id.includes('@antdv-next')) {
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
})
