<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Scaffold from '../components/Scaffold.vue'
import { useAuthStore } from '../stores/auth'
import { useNegociacaoStore } from '../stores/negociacao'
import { loadAthleteWorkouts, createAthleteWorkout } from '../services/workoutService'
import { loadAthleteHealthData } from '../services/profileService'
import { getDirectoryEntry } from '../services/messageService'
import { workoutTypes } from '../types/domain'
import type { Workout, WorkoutDraft, WorkoutType } from '../types/domain'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const negociacao = useNegociacaoStore()

const athleteId = computed(() => (route.params.id as string) || 'mock-athlete-1')
const workouts = ref<Workout[]>([])
const healthData = ref<{ notes: string; exams: Array<{ id: string; title: string; date: string; imageDataUrl: string; notes: string; createdAt: string }>; shareWithProfessional: boolean } | null>(null)
const loading = ref(true)

const athleteInfo = computed(() => getDirectoryEntry(athleteId.value) ?? { id: athleteId.value, name: 'Atleta', role: 'athlete' as const })
const contract = computed(() => negociacao.contractsWithParties.find((c) => c.athleteId === athleteId.value && c.status === 'active'))
const userId = computed(() => auth.user?.id ?? 'dev-user')
const isContractor = computed(() => contract.value?.professionalId === userId.value)

// Stats
const totalWorkouts = computed(() => workouts.value.length)
const completedWorkouts = computed(() => workouts.value.filter((w) => w.completed).length)
const completionRate = computed(() => totalWorkouts.value === 0 ? 0 : Math.round((completedWorkouts.value / totalWorkouts.value) * 100))
const totalDistance = computed(() => workouts.value.reduce((s, w) => s + w.distanceKm, 0))
const totalDuration = computed(() => workouts.value.reduce((s, w) => s + w.durationMin, 0))

const typeBreakdown = computed(() => {
  return workoutTypes.map((type) => {
    const filtered = workouts.value.filter((w) => w.workoutType === type)
    if (!filtered.length) return null
    return {
      type,
      count: filtered.length,
      avgDistance: filtered.reduce((s, w) => s + w.distanceKm, 0) / filtered.length,
      avgDuration: Math.round(filtered.reduce((s, w) => s + w.durationMin, 0) / filtered.length),
      completedCount: filtered.filter((w) => w.completed).length,
    }
  }).filter(Boolean) as Array<{ type: string; count: number; avgDistance: number; avgDuration: number; completedCount: number }>
})

const healthShared = computed(() => healthData.value?.shareWithProfessional === true)

// Workout creation
const formOpen = ref(false)
const newType = ref<WorkoutType>('Corrida')
const newDistance = ref(5)
const newDuration = ref(40)
const newDate = ref('')
const newSaving = ref(false)

const recentWorkouts = computed(() => [...workouts.value].sort((a, b) => b.workoutDate.localeCompare(a.workoutDate)).slice(0, 20))

onMounted(async () => {
  await negociacao.init()
  workouts.value = await loadAthleteWorkouts(athleteId.value)
  healthData.value = loadAthleteHealthData(athleteId.value) as typeof healthData.value
  loading.value = false
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

function formatDate(dateKey: string) {
  return new Date(dateKey + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function openCreateForm() {
  newType.value = 'Corrida'
  newDistance.value = 5
  newDuration.value = 40
  newDate.value = new Date().toISOString().slice(0, 10)
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
}

async function submitWorkout() {
  if (!newDate.value || newDuration.value <= 0) return
  newSaving.value = true
  const draft: WorkoutDraft = {
    workoutType: newType.value,
    distanceKm: newDistance.value,
    durationMin: newDuration.value,
    workoutDate: newDate.value,
    contractId: contract.value?.id ?? null,
  }
  const created = await createAthleteWorkout(athleteId.value, draft)
  workouts.value = [...workouts.value, created]
  newSaving.value = false
  formOpen.value = false
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
        <p class="hello-top">Atleta</p>
        <h1 id="athlete-title">{{ athleteInfo.name }}</h1>
      </div>
    </template>

    <template #appbar-actions>
      <span v-if="contract" class="perfil-role-pill">Contrato ativo</span>
    </template>

    <template #drawer-header>
      <p class="sidebar-brand">Raiz Movimento</p>
    </template>

    <template #drawer>
      <RouterLink class="sidebar-item" to="/">Inicio</RouterLink>
      <RouterLink class="sidebar-item" to="/metricas">Metricas</RouterLink>
      <RouterLink class="sidebar-item" to="/profissionais">Profissionais</RouterLink>
      <RouterLink class="sidebar-item" to="/negociacoes">Negociacoes</RouterLink>
      <RouterLink class="sidebar-item" to="/contratos">Contratos</RouterLink>
      <RouterLink class="sidebar-item" to="/agenda">Agenda</RouterLink>
      <RouterLink class="sidebar-item" to="/perfil">Perfil</RouterLink>
      <RouterLink class="sidebar-item" to="/mensagens">Mensagens</RouterLink>
    </template>

    <template #drawer-footer>
      <button class="sidebar-item danger" type="button" @click="logout">Sair</button>
    </template>

    <div v-if="loading" class="athlete-loading">Carregando...</div>

    <section v-else class="athlete-page" aria-labelledby="athlete-title">
      <!-- Stats hero -->
      <section class="athlete-hero-grid" aria-label="Resumo do atleta">
        <article class="metric-card">
          <span class="metric-label">Treinos</span>
          <strong class="metric-value">{{ totalWorkouts }}</strong>
        </article>
        <article class="metric-card lime">
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

      <!-- Contract quick actions (professional only) -->
      <section v-if="contract && isContractor" class="athlete-section" aria-label="Contrato">
        <header class="agenda-section-header">
          <div>
            <p class="agenda-kicker">Contrato</p>
            <h2>Contrato ativo</h2>
          </div>
        </header>
        <div class="athlete-contract-actions">
          <button class="btn-primary btn-sm" type="button" @click="negociacao.completeContract(contract.id)">Finalizar contrato</button>
          <button class="btn-ghost btn-sm" type="button" @click="negociacao.cancelContract(contract.id)">Cancelar contrato</button>
        </div>
      </section>

      <!-- Actions -->
      <div class="athlete-actions">
        <button class="btn-primary" type="button" @click="openCreateForm">Atribuir treino</button>
        <RouterLink class="btn-ghost" :to="'/mensagens?pro=' + athleteId">Conversar</RouterLink>
      </div>

      <!-- Workout breakdown -->
      <section v-if="typeBreakdown.length" class="athlete-section" aria-label="Por tipo de treino">
        <header class="agenda-section-header">
          <div>
            <p class="agenda-kicker">Desempenho</p>
            <h2>Por tipo de treino</h2>
          </div>
        </header>
        <div class="athlete-type-grid">
          <article v-for="item in typeBreakdown" :key="item.type" class="athlete-type-tile">
            <div class="athlete-type-header">
              <strong>{{ item.type }}</strong>
              <span class="athlete-type-count">{{ item.count }}x</span>
            </div>
            <div class="athlete-type-stats">
              <span v-if="item.avgDistance > 0">{{ formatDistance(item.avgDistance) }} km medio</span>
              <span>{{ formatDuration(item.avgDuration) }} medio</span>
            </div>
            <div class="athlete-type-bar">
              <div class="athlete-type-fill" :style="{ width: (item.completedCount / item.count) * 100 + '%' }"></div>
            </div>
            <span class="athlete-type-completion">{{ item.completedCount }}/{{ item.count }} concluidos</span>
          </article>
        </div>
      </section>

      <!-- Recent workouts -->
      <section class="athlete-section" aria-label="Ultimos treinos">
        <header class="agenda-section-header">
          <div>
            <p class="agenda-kicker">Registros</p>
            <h2>Ultimos treinos</h2>
          </div>
        </header>
        <div v-if="recentWorkouts.length" class="athlete-workout-list">
          <article v-for="w in recentWorkouts" :key="w.id" class="athlete-workout-item">
            <div class="athlete-workout-status" :class="{ done: w.completed }" aria-hidden="true">
              {{ w.completed ? 'OK' : '' }}
            </div>
            <div class="athlete-workout-copy">
              <strong>{{ w.workoutType }}</strong>
              <span>{{ formatDate(w.workoutDate) }} — {{ formatDuration(w.durationMin) }}{{ w.distanceKm > 0 ? ', ' + formatDistance(w.distanceKm) + ' km' : '' }}</span>
            </div>
          </article>
        </div>
        <div v-else class="athlete-empty">
          <p>Nenhum treino registrado para este atleta.</p>
        </div>
      </section>

      <!-- Health data (if shared) -->
      <section v-if="healthShared && healthData" class="athlete-section" aria-label="Dados de saude">
        <header class="agenda-section-header">
          <div>
            <p class="agenda-kicker">Saude</p>
            <h2>Dados compartilhados</h2>
          </div>
        </header>

        <article class="athlete-card">
          <h3>Anotacoes do atleta</h3>
          <p class="athlete-health-notes">{{ healthData.notes }}</p>
        </article>

        <article v-if="healthData.exams.length" class="athlete-card">
          <h3>Exames ({{ healthData.exams.length }})</h3>
          <div class="athlete-exam-grid">
            <div v-for="exam in healthData.exams" :key="exam.id" class="athlete-exam-item">
              <img class="athlete-exam-thumb" :src="exam.imageDataUrl" :alt="'Imagem: ' + exam.title" />
              <div class="athlete-exam-copy">
                <strong>{{ exam.title }}</strong>
                <span>{{ formatDate(exam.date) }}</span>
                <p>{{ exam.notes || 'Sem observacoes.' }}</p>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section v-else-if="healthData && !healthShared" class="athlete-section">
        <p class="athlete-hint">Atleta nao compartilhou dados de saude.</p>
      </section>
    </section>

    <template #bottom-nav>
      <RouterLink class="nav-item" to="/">Inicio</RouterLink>
      <RouterLink class="nav-item" to="/profissionais">Profissionais</RouterLink>
      <RouterLink class="nav-item" to="/agenda">Agenda</RouterLink>
      <RouterLink class="nav-item" to="/mensagens">Mensagens</RouterLink>
      <RouterLink class="nav-item" to="/perfil">Perfil</RouterLink>
    </template>
  </Scaffold>

  <!-- Create workout modal -->
  <div v-if="formOpen" class="athlete-form-overlay" @click.self="closeForm">
    <section class="athlete-form-sheet" role="dialog" aria-modal="true" aria-labelledby="athlete-form-title">
      <header class="athlete-form-header">
        <div>
          <p class="agenda-kicker">Atribuir treino</p>
          <h2 id="athlete-form-title">Novo treino para {{ athleteInfo.name }}</h2>
        </div>
        <button class="athlete-form-close" type="button" aria-label="Fechar" @click="closeForm">x</button>
      </header>

      <form class="athlete-form" @submit.prevent="submitWorkout">
        <label for="aw-type">
          Tipo de treino
          <select id="aw-type" v-model="newType">
            <option v-for="t in workoutTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>

        <div class="athlete-form-row">
          <label for="aw-distance">
            Distancia (km)
            <input id="aw-distance" v-model.number="newDistance" type="number" min="0" step="0.1" />
          </label>
          <label for="aw-duration">
            Duracao (min)
            <input id="aw-duration" v-model.number="newDuration" type="number" min="1" step="1" />
          </label>
        </div>

        <label for="aw-date">
          Data
          <input id="aw-date" v-model="newDate" type="date" required />
        </label>

        <p v-if="contract" class="athlete-form-hint">Vinculado ao contrato ativo automaticamente.</p>

        <div class="athlete-form-actions">
          <button class="btn-ghost" type="button" @click="closeForm">Cancelar</button>
          <button class="btn-primary" type="submit" :disabled="newSaving || !newDate">
            {{ newSaving ? 'Salvando...' : 'Atribuir treino' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
