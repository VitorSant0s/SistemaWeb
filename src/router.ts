import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from './stores/auth'
import HomeView from './views/HomeView.vue'
import AuthView from './views/AuthView.vue'
import AgendaView from './views/AgendaView.vue'
import PerfilView from './views/PerfilView.vue'
import MetricasView from './views/MetricasView.vue'
import MessagesView from './views/MessagesView.vue'
import ProfissionaisView from './views/ProfissionaisView.vue'
import NegotiationsView from './views/NegotiationsView.vue'
import ContractsView from './views/ContractsView.vue'
import AthleteDetailView from './views/AthleteDetailView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { requiresAuth: true } },
    { path: '/agenda', name: 'agenda', component: AgendaView, meta: { requiresAuth: true } },
    { path: '/perfil', name: 'perfil', component: PerfilView, meta: { requiresAuth: true } },
    { path: '/metricas', name: 'metricas', component: MetricasView, meta: { requiresAuth: true } },
    { path: '/mensagens', name: 'mensagens', component: MessagesView, meta: { requiresAuth: true } },
    { path: '/entrar', name: 'auth', component: AuthView, meta: { guestOnly: true } },
    { path: '/profissionais', name: 'profissionais', component: ProfissionaisView, meta: { requiresAuth: true } },
    { path: '/negociacoes', name: 'negociacoes', component: NegotiationsView, meta: { requiresAuth: true } },
    { path: '/contratos', name: 'contratos', component: ContractsView, meta: { requiresAuth: true } },
    { path: '/atleta/:id', name: 'athlete-detail', component: AthleteDetailView, meta: { requiresAuth: true } },
  ],
})

const routeTitles: Record<string, string> = {
  home: 'Inicio - Raiz Movimento',
  agenda: 'Agenda - Raiz Movimento',
  perfil: 'Perfil - Raiz Movimento',
  metricas: 'Metricas - Raiz Movimento',
  mensagens: 'Mensagens - Raiz Movimento',
  auth: 'Entrar - Raiz Movimento',
  profissionais: 'Profissionais - Raiz Movimento',
  negociacoes: 'Negociacoes - Raiz Movimento',
  contratos: 'Contratos - Raiz Movimento',
  'athlete-detail': 'Atleta - Raiz Movimento',
}

router.afterEach((to) => {
  document.title = (to.name && routeTitles[to.name as string]) || 'Raiz Movimento'
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (auth.loading) return true

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'auth' }
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'home' }
  }

  if (to.name === 'profissionais' && auth.role === 'professional') {
    return { name: 'home' }
  }

  return true
})

export default router
