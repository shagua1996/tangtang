import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import './style.css'
import App from './App.vue'
import PrintView from './PrintView.vue'
createApp(new URLSearchParams(location.search).has('print') ? PrintView : App)
  .use(ElementPlus, { size: 'small', locale: zhCn })
  .mount('#app')
