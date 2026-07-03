<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Scaffold from '../components/Scaffold.vue'
import BottomNav from '../components/BottomNav.vue'
import WorkoutForm from '../components/WorkoutForm.vue'
import { formatDateKey, useAgendaStore } from '../stores/agenda'
import { useAuthStore } from '../stores/auth'
import type { Workout, WorkoutDraft } from '../stores/agenda'

type AgendaTab = 'treinos' | 'acompanhamento'
type CalendarCell = {
  key: string
  day: number | null
  dateKey: string
  isToday: boolean
  isSelected: boolean
  workoutCount: number
  completedCount: number
}

const agenda = useAgendaStore()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

agenda.init()

const activeTab = ref<AgendaTab>(
  typeof route.query.contrato === 'string' && route.query.contrato ? 'acompanhamento' : 'treinos',
)
const formOpen = ref(false)
const editingWorkout = ref<Workout | null>(null)
const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

const monthLabel = computed(() => {
  const date = new Date(agenda.currentYear, agenda.currentMonth, 1)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
})

const selectedDateLabel = computed(() => formatLongDate(agenda.selectedDate))
const selectedWorkouts = computed(() => agenda.workoutsForDate(agenda.selectedDate))
const monthlyWorkoutCount = computed(() => agenda.workoutsForMonth(agenda.currentYear, agenda.currentMonth).length)
const historyWorkouts = computed(() => agenda.historyWorkouts.slice(0, 8))
const contractFilter = computed(() => {
  const id = route.query.contrato
  return typeof id === 'string' && id ? id : null
})
const filteredContractWorkouts = computed(() => {
  const all = agenda.contractWorkouts
  if (!contractFilter.value) return all.slice(0, 6)
  return all.filter((w) => w.contractId === contractFilter.value).slice(0, 6)
})
const completionRate = computed(() => {
  if (agenda.stats.totalWorkouts === 0) return 0
  return Math.round((agenda.stats.completedWorkouts / agenda.stats.totalWorkouts) * 100)
})
const totalDurationLabel = computed(() => formatDuration(agenda.stats.totalDuration))

const calendarCells = computed<CalendarCell[]>(() => {
  const firstDay = new Date(agenda.currentYear, agenda.currentMonth, 1)
  const totalDays = new Date(agenda.currentYear, agenda.currentMonth + 1, 0).getDate()
  const todayKey = formatDateKey(new Date())
  const cells: CalendarCell[] = []

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    cells.push({
      key: `empty-${index}`,
      day: null,
      dateKey: '',
      isToday: false,
      isSelected: false,
      workoutCount: 0,
      completedCount: 0,
    })
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const dateKey = formatDateKey(new Date(agenda.currentYear, agenda.currentMonth, day))
    const workouts = agenda.workoutsForDate(dateKey)
    cells.push({
      key: dateKey,
      day,
      dateKey,
      isToday: dateKey === todayKey,
      isSelected: dateKey === agenda.selectedDate,
      workoutCount: workouts.length,
      completedCount: workouts.filter((workout) => workout.completed).length,
    })
  }

  return cells
})

function formatLongDate(dateKey: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date(`${dateKey}T00:00:00`))
}

function formatDistance(distance: number) {
  return distance.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours === 0) return `${remainingMinutes}min`
  if (remainingMinutes === 0) return `${hours}h`
  return `${hours}h ${remainingMinutes}min`
}

function formatWorkoutMeta(workout: Workout) {
  if (workout.distanceKm <= 0) return formatDuration(workout.durationMin)
  return `${formatDistance(workout.distanceKm)} km - ${formatDuration(workout.durationMin)}`
}

function selectDay(cell: CalendarCell) {
  if (!cell.day) return
  agenda.selectDate(cell.dateKey)
}

function openCreateForm() {
  editingWorkout.value = null
  formOpen.value = true
}

function editWorkout(workout: Workout) {
  editingWorkout.value = workout
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
  editingWorkout.value = null
}

async function saveWorkout(draft: WorkoutDraft) {
  try {
    if (editingWorkout.value) {
      await agenda.updateWorkout(editingWorkout.value.id, draft)
    } else {
      await agenda.addWorkout(draft)
    }
    closeForm()
  } catch (e) {
    console.error('Falha ao salvar treino', e)
  }
}

function deleteWorkout(workout: Workout) {
  if (window.confirm(`Excluir treino de ${workout.workoutType}?`)) {
    agenda.deleteWorkout(workout.id)
  }
}

async function logout() {
  await auth.signOut()
  await router.push('/entrar')
}
</script>

<template>
  <Scaffold fab-icon="+" @fab-click="openCreateForm">
    <template #appbar-title>
      <div class="hello-block">
        <p class="hello-top">Seu calendario</p>
        <h1 id="agenda-title">Agenda</h1>
      </div>
    </template>

    <template #appbar-actions>
      <button class="agenda-today-btn" type="button" @click="agenda.goToToday">Hoje</button>
    </template>

    <template #drawer-header>
      <p class="sidebar-brand">Raiz Movimento</p>
    </template>

    <template #drawer>
      <RouterLink class="sidebar-item" to="/">Inicio</RouterLink>
      <RouterLink class="sidebar-item" to="/metricas">Metricas</RouterLink>
      <RouterLink class="sidebar-item active" to="/agenda" aria-current="page">Agenda</RouterLink>
      <RouterLink class="sidebar-item" to="/perfil">Perfil</RouterLink>
      <RouterLink class="sidebar-item" to="/mensagens">Mensagens</RouterLink>
    </template>

    <template #drawer-footer>
      <button class="sidebar-item danger" type="button" @click="logout">Sair</button>
    </template>

    <section class="agenda-page" aria-labelledby="agenda-title">
      <section class="agenda-hero" aria-label="Resumo da agenda">
        <div>
          <p class="agenda-kicker">Agenda ativa</p>
          <h2>Organize, marque e acompanhe seus treinos.</h2>
          <p>{{ monthlyWorkoutCount }} treinos planejados neste mes.</p>
        </div>
        <div class="agenda-hero-stat" aria-label="Treinos concluidos">
          <span>Concluidos</span>
          <strong>{{ completionRate }}%</strong>
        </div>
      </section>

      <div class="agenda-tabs" role="tablist" aria-label="Alternar agenda">
        <button
          class="agenda-tab"
          :class="{ active: activeTab === 'treinos' }"
          type="button"
          role="tab"
          :aria-selected="activeTab === 'treinos'"
          @click="activeTab = 'treinos'"
        >
          Meus treinos
        </button>
        <button
          class="agenda-tab"
          :class="{ active: activeTab === 'acompanhamento' }"
          type="button"
          role="tab"
          :aria-selected="activeTab === 'acompanhamento'"
          @click="activeTab = 'acompanhamento'"
        >
          Acompanhamento
        </button>
      </div>

      <section v-if="activeTab === 'treinos'" class="agenda-content-grid">
        <article class="agenda-calendar-card" aria-label="Calendario mensal">
          <header class="agenda-cal-header">
            <button type="button" aria-label="Mes anterior" @click="agenda.previousMonth">&lt;</button>
            <h2>{{ monthLabel }}</h2>
            <button type="button" aria-label="Proximo mes" @click="agenda.nextMonth">&gt;</button>
          </header>

          <div class="agenda-weekdays" aria-hidden="true">
            <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
          </div>

          <div class="agenda-days-grid">
            <button
              v-for="cell in calendarCells"
              :key="cell.key"
              class="agenda-day"
              :class="{
                empty: !cell.day,
                today: cell.isToday,
                selected: cell.isSelected,
                'has-workout': cell.workoutCount > 0,
              }"
              type="button"
              :disabled="!cell.day"
              :aria-label="cell.day ? `${cell.day}, ${cell.workoutCount} treinos` : 'Dia vazio'"
              @click="selectDay(cell)"
            >
              <span>{{ cell.day }}</span>
              <small v-if="cell.workoutCount > 0">{{ cell.completedCount }}/{{ cell.workoutCount }}</small>
            </button>
          </div>
        </article>

        <article class="agenda-day-detail">
          <header class="agenda-section-header">
            <div>
              <p class="agenda-kicker">Dia selecionado</p>
              <h2>{{ selectedDateLabel }}</h2>
            </div>
            <button class="agenda-add-inline" type="button" @click="openCreateForm">Adicionar</button>
          </header>

          <div aria-live="polite" aria-atomic="true">
            <div v-if="selectedWorkouts.length" class="agenda-workout-list">
            <article v-for="workout in selectedWorkouts" :key="workout.id" class="agenda-workout-item">
              <button
                class="agenda-workout-check"
                :class="{ done: workout.completed }"
                type="button"
                :aria-label="workout.completed ? 'Marcar como pendente' : 'Marcar como concluido'"
                @click="agenda.toggleCompleted(workout.id)"
              >
                {{ workout.completed ? 'OK' : '' }}
              </button>

              <div class="agenda-workout-copy">
                <strong>{{ workout.workoutType }}</strong>
                <span>{{ formatWorkoutMeta(workout) }}</span>
                <em v-if="workout.contractId">Acompanhamento profissional</em>
              </div>

              <div class="agenda-item-actions">
                <button type="button" @click="editWorkout(workout)">Editar</button>
                <button type="button" @click="deleteWorkout(workout)">Excluir</button>
              </div>
            </article>
          </div>

            <div v-else class="agenda-empty-state">
              <p>Nenhum treino marcado para este dia.</p>
              <button class="btn-ghost" type="button" @click="openCreateForm">Criar treino</button>
            </div>
          </div>
        </article>
      </section>

      <section v-else class="agenda-track-panel">
        <div class="agenda-stats" aria-label="Resumo de acompanhamento">
          <article class="agenda-stat-card">
            <span>Treinos</span>
            <strong>{{ agenda.stats.totalWorkouts }}</strong>
            <small>{{ agenda.stats.completedWorkouts }} concluidos</small>
          </article>
          <article class="agenda-stat-card">
            <span>Distancia</span>
            <strong>{{ formatDistance(agenda.stats.totalDistance) }} km</strong>
            <small>Total registrado</small>
          </article>
          <article class="agenda-stat-card">
            <span>Tempo</span>
            <strong>{{ totalDurationLabel }}</strong>
            <small>Volume acumulado</small>
          </article>
        </div>

        <article class="agenda-track-card">
          <header class="agenda-section-header">
            <div>
              <p class="agenda-kicker">Historico</p>
              <h2>Ultimos registros</h2>
            </div>
          </header>

          <div class="agenda-workout-list compact">
            <article v-for="workout in historyWorkouts" :key="workout.id" class="agenda-workout-item">
              <div class="agenda-status-dot" :class="{ done: workout.completed }" aria-hidden="true"></div>
              <div class="agenda-workout-copy">
                <strong>{{ workout.workoutType }}</strong>
                <span>{{ formatLongDate(workout.workoutDate) }} - {{ formatWorkoutMeta(workout) }}</span>
                <em>{{ workout.completed ? 'Concluido' : 'Pendente' }}</em>
              </div>
            </article>
          </div>
        </article>

        <article class="agenda-track-card">
          <header class="agenda-section-header">
            <div>
              <p class="agenda-kicker">Profissional</p>
              <h2>{{ contractFilter ? 'Treinos do contrato' : 'Treinos com acompanhamento' }}</h2>
            </div>
          </header>

          <div v-if="filteredContractWorkouts.length" class="agenda-workout-list compact">
            <article v-for="workout in filteredContractWorkouts" :key="workout.id" class="agenda-workout-item">
              <div class="agenda-status-dot" :class="{ done: workout.completed }" aria-hidden="true"></div>
              <div class="agenda-workout-copy">
                <strong>{{ workout.workoutType }}</strong>
                <span>{{ formatLongDate(workout.workoutDate) }} - {{ formatWorkoutMeta(workout) }}</span>
                <em>{{ workout.completed ? 'Concluido' : 'Pendente' }}</em>
              </div>
            </article>
          </div>

          <div v-else class="agenda-empty-state compact">
            <p>Nenhum treino vinculado a acompanhamento ainda.</p>
          </div>
        </article>
      </section>
    </section>

    <template #bottom-nav>
      <BottomNav />
    </template>
  </Scaffold>

  <WorkoutForm
    v-if="formOpen"
    :workout="editingWorkout"
    :selected-date="agenda.selectedDate"
    @close="closeForm"
    @save="saveWorkout"
  />
</template>
