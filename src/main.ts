import { createApp } from 'vue'
import 'antdv-next/dist/reset.css'
import VxeTable from 'vxe-table'
import 'vxe-table/lib/style.css'
import App from './App.vue'
import './style.css'

const app = createApp(App)
app.use(VxeTable)
app.mount('#app')
