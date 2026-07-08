<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import Scaffold from '../components/Scaffold.vue'
import { useAuthStore } from '../stores/auth'
import { useAgendaStore } from '../stores/agenda'
import { usePerfilStore } from '../stores/perfil'
import { useNegociacaoStore } from '../stores/negociacao'
import { loadContracts } from '../services/contractService'
import { loadOffers } from '../services/offerService'
import { loadNegotiations } from '../services/negotiationService'
import { loadAthleteWorkouts } from '../services/workoutService'
import { getDirectoryEntry, getDirectoryEntryAsync } from '../services/messageService'
import type { ContractRecord, NegotiationRecord, ServiceOfferRecord, Workout } from '../types/domain'
import BottomNav from '../components/BottomNav.vue'

const auth = useAuthStore()
const agenda = useAgendaStore()
const perfil = usePerfilStore()
const negociacao = useNegociacaoStore()
const router = useRouter()

agenda.init()
perfil.init({ role: auth.role })
negociacao.init()

const role = computed(() => auth.role ?? 'athlete')
const userId = computed(() => auth.user?.id ?? '')

const loading = ref(true)
const loadError = ref(false)
const contracts = ref<ContractRecord[]>([])
const offers = ref<ServiceOfferRecord[]>([])
const negotiations = ref<NegotiationRecord[]>([])
const perAthleteWorkouts = ref<Record<string, Workout[]>>({})

onMounted(async () => {
  try {
    contracts.value = await loadContracts(userId.value)
    if (role.value === 'professional') {
      offers.value = await loadOffers(userId.value)
      negotiations.value = await loadNegotiations(userId.value)
      const active = contracts.value.filter((c) => c.status === 'active')
      for (const c of active) {
        try {
          perAthleteWorkouts.value[c.athleteId] = await loadAthleteWorkouts(c.athleteId)
        } catch {
          perAthleteWorkouts.value[c.athleteId] = []
        }
      }
      await Promise.all(active.map((c) => getDirectoryEntryAsync(c.athleteId)))
    }
  } catch (e) {
    console.error('Falha ao carregar metricas', e)
    loadError.value = true
  } finally {
    loading.value = false
  }
})

const totalWorkouts = computed(() => agenda.stats.totalWorkouts)
const completedWorkouts = computed(() => agenda.stats.completedWorkouts)
const completionRate = computed(() => {
  if (totalWorkouts.value === 0) return 0
  return Math.round((completedWorkouts.value / totalWorkouts.value) * 100)
})
const totalDistance = computed(() => agenda.stats.totalDistance)
const totalDuration = computed(() => agenda.stats.totalDuration)

const workoutTypeNames = ['Corrida', 'Musculacao', 'Ciclismo', 'Natacao', 'Yoga', 'Crossfit', 'Outro'] as const

type TypeBreakdownItem = {
  type: string
  count: number
  avgDistance: number
  avgDuration: number
  completedCount: number
}

const typeBreakdown = computed<TypeBreakdownItem[]>(() => {
  const result: TypeBreakdownItem[] = []
  for (const type of workoutTypeNames) {
    const filtered = agenda.workouts.filter((w) => w.workoutType === type)
    if (filtered.length === 0) continue
    result.push({
      type,
      count: filtered.length,
      avgDistance: filtered.reduce((s, w) => s + w.distanceKm, 0) / filtered.length,
      avgDuration: Math.round(filtered.reduce((s, w) => s + w.durationMin, 0) / filtered.length),
      completedCount: filtered.filter((w) => w.completed).length,
    })
  }
  return result
})

const activeContracts = computed(() => contracts.value.filter((c) => c.status === 'active'))
const completedContracts = computed(() => contracts.value.filter((c) => c.status === 'completed'))
const cancelledContracts = computed(() => contracts.value.filter((c) => c.status === 'cancelled'))
const totalRevenue = computed(() => completedContracts.value.reduce((s, c) => s + c.finalAmount, 0))
const activeOffers = computed(() => offers.value.filter((o) => o.isActive))
const openNegotiations = computed(() => negotiations.value.filter((n) => n.status === 'open'))

type PerAthleteStats = {
  athleteId: string
  athleteName: string
  totalWorkouts: number
  completedWorkouts: number
  completionRate: number
  totalDistance: number
  totalDuration: number
}

const athleteStats = computed<PerAthleteStats[]>(() => {
  return activeContracts.value.map((c) => {
    const w = perAthleteWorkouts.value[c.athleteId] ?? []
    const total = w.length
    const completed = w.filter((x) => x.completed).length
    return {
      athleteId: c.athleteId,
      athleteName: getDirectoryEntry(c.athleteId)?.name ?? 'Atleta',
      totalWorkouts: total,
      completedWorkouts: completed,
      completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
      totalDistance: w.reduce((s, x) => s + x.distanceKm, 0),
      totalDuration: w.reduce((s, x) => s + x.durationMin, 0),
    }
  })
})

function formatDistance(km: number) {
  return km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  if (hours === 0) return `${remaining}min`
  if (remaining === 0) return `${hours}h`
  return `${hours}h ${remaining}min`
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

async function logout() {
  await auth.signOut()
  await router.push('/entrar')
}
</script>

<template>
  <Scaffold>
    <template #appbar-title>
      <div class="hello-block">
        <p class="hello-top">Analises</p>
        <h1 id="metricas-title">Metricas</h1>
      </div>
    </template>

    <template #drawer-header>
      <p class="sidebar-brand">Raiz Movimento</p>
    </template>

    <template #drawer>
      <RouterLink class="sidebar-item" to="/">Inicio</RouterLink>
      <RouterLink class="sidebar-item active" to="/metricas" aria-current="page">Metricas</RouterLink>
      <RouterLink v-if="auth.role !== 'professional'" class="sidebar-item" to="/profissionais">Profissionais</RouterLink>
      <RouterLink class="sidebar-item" to="/negociacoes">Negociacoes</RouterLink>
      <RouterLink class="sidebar-item" to="/contratos">Contratos</RouterLink>
      <RouterLink class="sidebar-item" to="/agenda">Agenda</RouterLink>
      <RouterLink class="sidebar-item" to="/perfil">Perfil</RouterLink>
      <RouterLink class="sidebar-item" to="/mensagens">Mensagens</RouterLink>
    </template>

    <template #drawer-footer>
      <button class="sidebar-item danger" type="button" @click="logout">Sair</button>
    </template>

    <section class="metricas-page" aria-labelledby="metricas-title">
      <section class="metricas-hero-grid" aria-label="Resumo geral">
        <article class="metric-card">
          <span class="metric-label">Treinos</span>
          <strong class="metric-value">{{ totalWorkouts }}</strong>
        </article>
        <article class="metric-card">
          <span class="metric-label">Concluidos</span>
          <strong class="metric-value">{{ completionRate }}%</strong>
        </article>
        <article class="metric-card">
          <span class="metric-label">Distancia</span>
          <strong class="metric-value">{{ formatDistance(totalDistance) }} km</strong>
        </article>
        <article class="metric-card">
          <span class="metric-label">Tempo</span>
          <strong class="metric-value">{{ formatDuration(totalDuration) }}</strong>
        </article>
      </section>

      <section v-if="role === 'athlete' && typeBreakdown.length" class="metricas-section" aria-label="Por tipo de treino">
        <header class="agenda-section-header">
          <div>
            <p class="agenda-kicker">Desempenho</p>
            <h2>Por tipo de treino</h2>
          </div>
        </header>
        <div class="metric-type-grid">
          <article v-for="item in typeBreakdown" :key="item.type" class="metric-type-tile">
            <div class="metric-type-header">
              <strong>{{ item.type }}</strong>
              <span class="metric-type-count">{{ item.count }}x</span>
            </div>
            <div class="metric-type-stats">
              <span v-if="item.avgDistance > 0">{{ formatDistance(item.avgDistance) }} km medio</span>
              <span>{{ formatDuration(item.avgDuration) }} medio</span>
            </div>
            <div class="metric-type-bar">
              <div
                class="metric-type-fill"
                :style="{ width: (item.completedCount / item.count) * 100 + '%' }"
              ></div>
            </div>
            <span class="metric-type-completion">{{ item.completedCount }}/{{ item.count }} concluidos</span>
          </article>
        </div>
      </section>

      <div v-if="loading" class="pros-loading">Carregando dados...</div>
      <div v-else-if="loadError" class="pros-loading" style="color:var(--danger)">Erro ao carregar dados.</div>

      <template v-if="!loading">
      <section class="metricas-section" aria-label="Contratos">
        <header class="agenda-section-header">
          <div>
            <p class="agenda-kicker">Profissional</p>
            <h2>{{ role === 'professional' ? 'Contratos' : 'Acompanhamento' }}</h2>
          </div>
        </header>
        <div class="metricas-grid">
          <article class="metric-card lime">
            <span class="metric-label">Ativos</span>
            <strong class="metric-value">{{ activeContracts.length }}</strong>
          </article>
          <article v-if="role === 'professional'" class="metric-card">
            <span class="metric-label">Concluidos</span>
            <strong class="metric-value">{{ completedContracts.length }}</strong>
          </article>
          <article v-if="role === 'professional'" class="metric-card">
            <span class="metric-label">Cancelados</span>
            <strong class="metric-value">{{ cancelledContracts.length }}</strong>
          </article>
        </div>
      </section>

      <section v-if="role === 'professional'" class="metricas-section" aria-label="Receita">
        <header class="agenda-section-header">
          <div>
            <p class="agenda-kicker">Financeiro</p>
            <h2>Receita total</h2>
          </div>
        </header>
        <article class="metricas-revenue-card">
          <strong>{{ formatCurrency(totalRevenue) }}</strong>
          <span>de {{ completedContracts.length }} contratos concluidos</span>
        </article>
      </section>

      <section v-if="role === 'professional'" class="metricas-section" aria-label="Atletas">
        <header class="agenda-section-header">
          <div>
            <p class="agenda-kicker">Atletas</p>
            <h2>Meus atletas</h2>
          </div>
        </header>
        <div class="metricas-grid">
          <article class="metric-card">
            <span class="metric-label">Atletas ativos</span>
            <strong class="metric-value">{{ negociacao.activeContracts.length }}</strong>
          </article>
        </div>
        <div v-if="athleteStats.length" class="metricas-table-wrap">
          <table class="metricas-table">
            <thead>
              <tr>
                <th>Atleta</th>
                <th>Treinos</th>
                <th>Conclusao</th>
                <th>Distancia</th>
                <th>Tempo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in athleteStats" :key="s.athleteId">
                <td>
                  <RouterLink class="metricas-table-link" :to="'/atleta/' + s.athleteId">{{ s.athleteName }}</RouterLink>
                </td>
                <td>{{ s.totalWorkouts }}</td>
                <td>{{ s.completionRate }}%</td>
                <td>{{ formatDistance(s.totalDistance) }} km</td>
                <td>{{ formatDuration(s.totalDuration) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="role === 'professional'" class="metricas-grid">
        <article class="metric-card">
          <span class="metric-label">Ofertas ativas</span>
          <strong class="metric-value">{{ activeOffers.length }}</strong>
        </article>
        <article class="metric-card">
          <span class="metric-label">Negociacoes</span>
          <strong class="metric-value">{{ openNegotiations.length }}</strong>
          <span>em aberto</span>
        </article>
      </section>

      <section v-if="role === 'athlete'" class="metricas-section" aria-labelledby="exams-heading">
        <header class="agenda-section-header">
          <div>
            <p class="agenda-kicker">Saude</p>
            <h2 id="exams-heading">Exames</h2>
          </div>
        </header>
        <div class="metricas-grid">
          <article class="metric-card">
            <span class="metric-label">Exames registrados</span>
            <strong class="metric-value">{{ perfil.examCount }}</strong>
          </article>
        </div>
      </section>
      </template>
    </section>

    <template #bottom-nav>
      <BottomNav />
    </template>
  </Scaffold>
</template>
