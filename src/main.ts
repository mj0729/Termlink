import { createApp } from 'vue'
import AntdvNext from 'antdv-next'
import 'antdv-next/dist/reset.css'
import App from './App.vue'
import './style.css'

const app = createApp(App)

app.use(AntdvNext)
app.mount('#app')
