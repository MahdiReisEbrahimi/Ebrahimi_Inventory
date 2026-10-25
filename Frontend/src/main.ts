import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './styles/main.css'
import { initializeTheme } from './composables/useTheme'

// Apply the saved theme before Vue renders to prevent a light-theme flash.
initializeTheme()

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.mount('#app')
