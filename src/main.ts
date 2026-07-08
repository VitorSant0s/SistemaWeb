import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import router from './router'
import { useAuthStore } from './stores/auth'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) reg.unregister()
  })
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

const auth = useAuthStore(pinia)
auth.init().finally(() => {
  app.mount('#app')
  if (auth.isAuthenticated && router.currentRoute.value.name === 'auth') {
    router.push({ name: 'home' })
  }
  if (!auth.isAuthenticated && router.currentRoute.value.meta.requiresAuth) {
    router.push({ name: 'auth' })
  }
})
