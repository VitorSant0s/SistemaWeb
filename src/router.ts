import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from './stores/auth'
import HomeView from './views/HomeView.vue'
import AuthView from './views/AuthView.vue'
import AgendaView from './views/AgendaView.vue'
import PerfilView from './views/PerfilView.vue'
import MetricasView from './views/MetricasView.vue'
import MessagesView from './views/MessagesView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { requiresAuth: true } },
    { path: '/agenda', name: 'agenda', component: AgendaView, meta: { requiresAuth: true } },
    { path: '/perfil', name: 'perfil', component: PerfilView, meta: { requiresAuth: true } },
    { path: '/metricas', name: 'metricas', component: MetricasView, meta: { requiresAuth: true } },
    { path: '/mensagens', name: 'mensagens', component: MessagesView, meta: { requiresAuth: true } },
    { path: '/entrar', name: 'auth', component: AuthView, meta: { guestOnly: true } },
  ],
})

const routeTitles: Record<string, string> = {
  home: 'Inicio - Raiz Movimento',
  agenda: 'Agenda - Raiz Movimento',
  perfil: 'Perfil - Raiz Movimento',
  metricas: 'Metricas - Raiz Movimento',
  mensagens: 'Mensagens - Raiz Movimento',
  auth: 'Entrar - Raiz Movimento',
}

router.afterEach((to) => {
  document.title = (to.name && routeTitles[to.name as string]) || 'Raiz Movimento'
})

router.beforeEach((to) => {
  // In dev mode we often run without Supabase configured; don't block navigation.
  if (import.meta.env.DEV) return true

  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'auth' }
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'home' }
  }

  return true
})

export default router
