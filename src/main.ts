import { createApp } from 'vue'
import 'antdv-next/dist/reset.css'
import VxeTable from 'vxe-table'
import 'vxe-table/lib/style.css'
import App from './App.vue'
import './style.css'

let fatalErrorRendered = false

function formatError(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}${error.stack ? `\n\n${error.stack}` : ''}`
  }

  if (typeof error === 'object') {
    try {
      return JSON.stringify(error, null, 2)
    } catch {
      return String(error)
    }
  }

  return String(error)
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderFatalError(source: string, error: unknown) {
  const detail = formatError(error)
  console.error(`[startup:${source}]`, error)

  if (fatalErrorRendered) {
    return
  }

  fatalErrorRendered = true

  const root = document.getElementById('app')
  if (!root) {
    return
  }

  root.innerHTML = `
    <section style="min-height:100vh;padding:32px;background:#f4f7fb;color:#17212f;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">
      <div style="max-width:960px;margin:0 auto;padding:24px;border:1px solid #d7e1ee;border-radius:18px;background:#ffffff;box-shadow:0 20px 60px rgba(23,33,47,0.08);">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7b92;">Termlink Startup Diagnostics</p>
        <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;">应用启动失败</h1>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#435266;">发布态捕获到了一个未处理错误。请把下面的信息反馈出来，我们就能继续定位。</p>
        <div style="margin-bottom:12px;padding:10px 12px;border-radius:12px;background:#eef4fb;color:#32506f;font-size:13px;">
          <strong>来源：</strong>${source}
        </div>
        <pre style="margin:0;padding:16px;overflow:auto;border-radius:14px;background:#0f1723;color:#e7eef8;font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word;">${escapeHtml(detail)}</pre>
      </div>
    </section>
  `
}

window.addEventListener('error', (event) => {
  renderFatalError('window.error', event.error ?? event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  renderFatalError('window.unhandledrejection', event.reason)
})

const app = createApp(App)

app.config.errorHandler = (error, _instance, info) => {
  renderFatalError(`vue:${info}`, error)
}

try {
  app.use(VxeTable)
  app.mount('#app')
} catch (error) {
  renderFatalError('mount', error)
}
