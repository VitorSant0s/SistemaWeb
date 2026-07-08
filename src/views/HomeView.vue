<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Scaffold from '../components/Scaffold.vue'
import { useAuthStore } from '../stores/auth'
import { usePerfilStore } from '../stores/perfil'
import { useAgendaStore, formatDateKey } from '../stores/agenda'
import { useNegociacaoStore } from '../stores/negociacao'
import { generateChallenge, loadFeedback, saveFeedback } from '../services/challengeService'
import { loadAthleteWorkouts } from '../services/workoutService'
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '../services/notificationService'
import BottomNav from '../components/BottomNav.vue'
import type { AppNotification } from '../services/notificationService'
import type { ChallengeRating } from '../types/domain'

const auth = useAuthStore()
const agendaStore = useAgendaStore()
const negociacao = useNegociacaoStore()
const router = useRouter()
const userId = computed(() => auth.user?.id ?? '')

const today = formatDateKey(new Date())
const savedFeedback = ref<{ rating: ChallengeRating; feedback: string } | null>(null)
const selectedRating = ref<ChallengeRating | null>(null)
const feedbackText = ref('')
const feedbackSaving = ref(false)
const notifOpen = ref(false)
const notifList = ref<AppNotification[]>([])
const unreadCount = ref(0)

function refreshNotifs() {
  notifList.value = getNotifications()
  unreadCount.value = getUnreadCount()
}

function toggleNotifs() {
  notifOpen.value = !notifOpen.value
  if (notifOpen.value) refreshNotifs()
}

function handleMarkRead(id: string) {
  markAsRead(id)
  refreshNotifs()
}

function handleMarkAllRead() {
  markAllAsRead()
  refreshNotifs()
}

function formatNotifTime(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < 60000) return 'agora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const perfilStore = usePerfilStore()
const userName = computed(() => {
  return perfilStore.profile.fullName || auth.user?.user_metadata?.full_name || ''
})

const role = computed(() => auth.role ?? 'athlete')

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
})

const selectedDay = ref('')

const weekDays = computed(() => {
  const todayDate = new Date()
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
  const days: { label: string; dateKey: string; isToday: boolean }[] = []
  for (let i = 0; i < 6; i++) {
    const date = new Date(todayDate)
    date.setDate(todayDate.getDate() + i)
    const dateKey = formatDateKey(date)
    days.push({
      label: `${dayNames[date.getDay()]} ${date.getDate()}`,
      dateKey,
      isToday: i === 0,
    })
  }
  return days
})

const dayWorkouts = computed(() => {
  if (!selectedDay.value) return []
  return agendaStore.workouts
    .filter((w) => w.workoutDate === selectedDay.value)
    .sort((a, b) => a.workoutDate.localeCompare(b.workoutDate))
})

function selectDay(dateKey: string) {
  selectedDay.value = dateKey
}

const challenge = computed(() => generateChallenge(agendaStore.workouts))

onMounted(() => {
  selectedDay.value = formatDateKey(new Date())
})

const stats = computed(() => agendaStore.stats)

const ratingLabel = computed(() => {
  if (!savedFeedback.value) return ''
  const map: Record<ChallengeRating, string> = { completed: 'Conclui', partial: 'Parcial', missed: 'Nao consegui' }
  return map[savedFeedback.value.rating]
})

type AthletePerf = {
  loading: boolean
  totalWorkouts: number
  completedWorkouts: number
  totalDistance: number
  totalDuration: number
  latestFeedback: { rating: ChallengeRating; feedback: string } | null
}

const contractsWithParties = computed(() => negociacao.contractsWithParties)
const activeContracts = computed(() => contractsWithParties.value.filter((c) => c.status === 'active'))
const proAthletes = computed(() => {
  if (role.value !== 'professional') return []
  return activeContracts.value.map((c) => ({
    contractId: c.id,
    athleteName: c.athleteName,
    athleteId: c.athleteId,
    value: c.finalAmount,
  }))
})

const athletePerformances = ref<Record<string, AthletePerf>>({})

const athleteStats = computed(() => {
  const perfs = Object.values(athletePerformances.value).filter((p) => !p.loading)
  const totalWorkouts = perfs.reduce((s, p) => s + p.totalWorkouts, 0)
  const completedWorkouts = perfs.reduce((s, p) => s + p.completedWorkouts, 0)
  return {
    totalAthletes: proAthletes.value.length,
    totalWorkouts,
    completedWorkouts,
    completionPercent: totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0,
  }
})

function getAthletePerf(athleteId: string): AthletePerf | undefined {
  return athletePerformances.value[athleteId]
}

function getFeedbackLabel(rating: ChallengeRating) {
  const map: Record<ChallengeRating, string> = { completed: 'Conclui', partial: 'Parcial', missed: 'Nao consegui' }
  return map[rating]
}

onMounted(async () => {
  agendaStore.init()
  perfilStore.init({ fullName: auth.user?.user_metadata?.full_name, role: auth.role })
  try {
    await negociacao.init()
    savedFeedback.value = await loadFeedback(userId.value, today)

    if (role.value === 'professional') {
      const perfs: Record<string, AthletePerf> = {}
      for (const athlete of proAthletes.value) {
        perfs[athlete.athleteId] = {
          loading: true,
          totalWorkouts: 0,
          completedWorkouts: 0,
          totalDistance: 0,
          totalDuration: 0,
          latestFeedback: null,
        }
      }
      athletePerformances.value = { ...perfs }

      for (const athlete of proAthletes.value) {
        try {
          const workouts = await loadAthleteWorkouts(athlete.athleteId)
          const feedback = await loadFeedback(athlete.athleteId, today)
          perfs[athlete.athleteId] = {
            loading: false,
            totalWorkouts: workouts.length,
            completedWorkouts: workouts.filter((w) => w.completed).length,
            totalDistance: workouts.reduce((s, w) => s + w.distanceKm, 0),
            totalDuration: workouts.reduce((s, w) => s + w.durationMin, 0),
            latestFeedback: feedback,
          }
        } catch (e) {
          console.error('Falha ao carregar dados do atleta', athlete.athleteId, e)
          perfs[athlete.athleteId] = {
            loading: false,
            totalWorkouts: 0,
            completedWorkouts: 0,
            totalDistance: 0,
            totalDuration: 0,
            latestFeedback: null,
          }
        }
      }
      athletePerformances.value = { ...perfs }
    }
  } catch (e) {
    console.error('Falha ao carregar dados iniciais', e)
  }
})

function selectRating(rating: ChallengeRating) {
  selectedRating.value = rating
}

async function submitFeedback() {
  if (!selectedRating.value) return
  feedbackSaving.value = true
  try {
    await saveFeedback(userId.value, today, {
      rating: selectedRating.value,
      feedback: feedbackText.value,
    })
    savedFeedback.value = { rating: selectedRating.value, feedback: feedbackText.value }
    selectedRating.value = null
    feedbackText.value = ''
  } catch (e) {
    console.error('Falha ao salvar feedback', e)
  } finally {
    feedbackSaving.value = false
  }
}

function cancelFeedback() {
  selectedRating.value = null
  feedbackText.value = ''
}

async function logout() {
  await auth.signOut()
  await router.replace('/entrar')
}
</script>

<template>
  <Scaffold>
    <template #appbar-title>
      <div class="hello-block">
        <p class="hello-top">Ola, {{ userName }}</p>
        <h1 id="home-title">{{ greeting }}</h1>
      </div>
    </template>

    <template #appbar-actions>
      <button class="icon-circle" type="button" aria-label="Notificacoes" @click="toggleNotifs">
        {{ unreadCount > 0 ? unreadCount : '!' }}
      </button>
    </template>

    <template #drawer-header>
      <p class="sidebar-brand">Raiz Movimento</p>
    </template>

    <template #drawer>
      <RouterLink class="sidebar-item active" to="/" aria-current="page">Inicio</RouterLink>
      <RouterLink class="sidebar-item" to="/metricas">Metricas</RouterLink>
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

    <section class="home-page" aria-labelledby="home-title">
      <template v-if="role === 'athlete'">
        <section class="challenge-card" aria-label="Desafio diario">
          <div>
            <p class="challenge-label">Desafio diario</p>
            <p class="challenge-copy">{{ challenge.title }}</p>
            <p class="challenge-desc">{{ challenge.description }}</p>
            <div class="challenge-progress">
              <span class="challenge-progress-text">{{ challenge.current }}/{{ challenge.target }}</span>
              <div class="challenge-progress-bar">
                <div
                  class="challenge-progress-fill"
                  :class="{ done: challenge.completed }"
                  :style="{ width: Math.min((challenge.current / challenge.target) * 100, 100) + '%' }"
                ></div>
              </div>
            </div>
            <div v-if="savedFeedback" class="challenge-feedback">
              <span class="challenge-rating-badge" :class="savedFeedback.rating">{{ ratingLabel }}</span>
              <p v-if="savedFeedback.feedback" class="challenge-feedback-text">{{ savedFeedback.feedback }}</p>
            </div>
            <div v-else-if="selectedRating" class="challenge-feedback-form">
              <div class="challenge-rating-row">
                <button
                  v-for="r in (['completed', 'partial', 'missed'] as ChallengeRating[])"
                  :key="r"
                  class="challenge-rating-btn"
                  :class="{ active: selectedRating === r }"
                  type="button"
                  @click="selectRating(r)"
                >
                  {{ r === 'completed' ? 'Conclui' : r === 'partial' ? 'Parcial' : 'Nao consegui' }}
                </button>
              </div>
              <textarea
                v-model="feedbackText"
                class="challenge-textarea"
                placeholder="Quer deixar um comentario? (opcional)"
                rows="2"
                aria-label="Comentario sobre o desafio"
              ></textarea>
              <div class="challenge-form-actions">
                <button class="challenge-save-btn" type="button" :disabled="feedbackSaving" @click="submitFeedback">
                  {{ feedbackSaving ? 'Salvando...' : 'Salvar feedback' }}
                </button>
                <button class="challenge-cancel-btn" type="button" @click="cancelFeedback">Cancelar</button>
              </div>
            </div>
            <div v-else class="challenge-actions">
              <button class="challenge-action-btn" type="button" @click="selectRating('completed')">Conclui</button>
              <button class="challenge-action-btn" type="button" @click="selectRating('partial')">Parcial</button>
              <button class="challenge-action-btn" type="button" @click="selectRating('missed')">Nao consegui</button>
            </div>
          </div>
          <div class="challenge-avatar" :class="{ done: challenge.completed }" aria-hidden="true">
            {{ challenge.completed ? 'OK' : 'RM' }}
          </div>
        </section>

        <section class="week-row" aria-label="Dias da semana">
          <button
            v-for="day in weekDays"
            :key="day.dateKey"
            class="day-pill"
            :class="{ active: selectedDay === day.dateKey || (!selectedDay && day.isToday) }"
            type="button"
            :aria-current="day.isToday ? 'date' : undefined"
            @click="selectDay(day.dateKey)"
          >{{ day.label }}</button>
        </section>

        <section v-if="dayWorkouts.length" class="workout-day-list" aria-label="Agendamentos do dia">
          <article v-for="w in dayWorkouts" :key="w.id" class="workout-day-item">
            <div class="workout-day-dot" :class="w.completed ? 'done' : 'pending'"></div>
            <div class="workout-day-info">
              <strong>{{ w.workoutType }}</strong>
              <span>{{ w.durationMin }}min{{ w.distanceKm > 0 ? ` \u00b7 ${w.distanceKm} km` : '' }}</span>
            </div>
          </article>
        </section>

        <section v-else class="workout-card" aria-labelledby="workout-day-empty">
          <p class="workout-time">Nenhum treino neste dia</p>
          <h2 id="workout-day-empty">Sem agendamentos</h2>
          <p class="workout-sub">Toque em outro dia ou crie treinos na agenda</p>
          <RouterLink class="btn-ghost" to="/agenda">Ir para agenda</RouterLink>
        </section>

        <section v-if="activeContracts.length" class="home-section" aria-label="Contratos ativos">
          <header class="home-section-header">
            <h2>Acompanhamento</h2>
            <RouterLink class="btn-ghost" to="/contratos">Ver contratos</RouterLink>
          </header>
          <div class="home-athlete-grid">
            <article v-for="c in activeContracts" :key="c.id" class="home-athlete-card">
              <div class="home-athlete-avatar">{{ c.professionalName.charAt(0).toUpperCase() }}</div>
              <div class="home-athlete-copy">
                <strong>{{ c.professionalName }}</strong>
                <span>{{ c.professionalSpecialty }}</span>
              </div>
            </article>
          </div>
        </section>

        <section class="stats-grid" aria-label="Metricas">
          <article class="stat-tile lime">
            <p>Treinos</p>
            <strong>{{ stats.completedWorkouts }}/{{ stats.totalWorkouts }}</strong>
            <span>Completados</span>
          </article>
          <article class="stat-tile blue">
            <p>Distancia</p>
            <strong>{{ stats.totalDistance.toFixed(1) }} km</strong>
            <span>Total acumulado</span>
          </article>
        </section>
      </template>

      <template v-if="role === 'professional'">
        <section v-if="proAthletes.length" class="stats-grid" aria-label="Resumo geral">
          <article class="stat-tile lime">
            <p>Atletas</p>
            <strong>{{ athleteStats.totalAthletes }}</strong>
            <span>Vinculados</span>
          </article>
          <article class="stat-tile blue">
            <p>Treinos</p>
            <strong>{{ athleteStats.totalWorkouts }}</strong>
            <span>Registrados</span>
          </article>
        </section>

        <section v-if="proAthletes.length" class="home-section" aria-label="Desempenho dos atletas">
          <header class="home-section-header">
            <h2>Desempenho dos atletas</h2>
            <RouterLink class="btn-ghost" to="/contratos">Ver todos</RouterLink>
          </header>
          <div class="pros-grid">
            <RouterLink
              v-for="athlete in proAthletes"
              :key="athlete.contractId"
              :to="'/atleta/' + athlete.athleteId"
              class="pro-card"
              style="text-decoration: none; color: inherit; cursor: pointer;"
            >
              <div class="pro-card-header">
                <div class="pro-avatar">{{ athlete.athleteName.charAt(0).toUpperCase() }}</div>
                <div class="pro-card-title">
                  <h2>{{ athlete.athleteName }}</h2>
                  <span class="pro-specialty">Contrato ativo</span>
                </div>
              </div>

              <div v-if="getAthletePerf(athlete.athleteId)?.loading" class="pros-loading">
                Carregando...
              </div>

              <template v-else-if="getAthletePerf(athlete.athleteId)">
                <div style="display: flex; gap: var(--space-4); font-size: 0.85rem;">
                  <span>
                    <strong>{{ getAthletePerf(athlete.athleteId)!.completedWorkouts }}/{{ getAthletePerf(athlete.athleteId)!.totalWorkouts }}</strong>
                    concluidos
                  </span>
                  <span>
                    <strong>{{ getAthletePerf(athlete.athleteId)!.totalDistance.toFixed(1) }} km</strong>
                    total
                  </span>
                </div>

                <div v-if="getAthletePerf(athlete.athleteId)!.latestFeedback" class="challenge-feedback" style="margin-top: 0;">
                  <span class="challenge-rating-badge" :class="getAthletePerf(athlete.athleteId)!.latestFeedback!.rating">
                    {{ getFeedbackLabel(getAthletePerf(athlete.athleteId)!.latestFeedback!.rating) }}
                  </span>
                  <p v-if="getAthletePerf(athlete.athleteId)!.latestFeedback!.feedback" class="challenge-feedback-text">
                    {{ getAthletePerf(athlete.athleteId)!.latestFeedback!.feedback }}
                  </p>
                </div>
                <p v-else class="workout-form-helper">
                  Nenhum feedback hoje.
                </p>
              </template>
            </RouterLink>
          </div>
        </section>

        <section v-else class="workout-card">
          <p class="workout-time">Nenhum atleta vinculado</p>
          <h2>Vamos comecar?</h2>
          <p class="workout-sub">Apos fechar contratos, voce podera acompanhar o desempenho dos seus atletas aqui.</p>
        </section>
      </template>
    </section>

    <template #bottom-nav>
      <BottomNav />
    </template>
  </Scaffold>

  <div v-if="notifOpen" class="notif-overlay" @click.self="notifOpen = false">
    <section class="notif-panel" role="dialog" aria-modal="true" aria-label="Notificacoes">
      <header class="notif-header">
        <h2>Notificacoes</h2>
        <div class="notif-header-actions">
          <button class="btn-ghost btn-sm" type="button" @click="handleMarkAllRead">Marcar todas como lidas</button>
          <button class="notif-close" type="button" aria-label="Fechar" @click="notifOpen = false">x</button>
        </div>
      </header>
      <div v-if="!notifList.length" class="notif-empty">Nenhuma notificacao.</div>
      <div v-else class="notif-list">
        <button
          v-for="n in notifList"
          :key="n.id"
          class="notif-item"
          :class="{ unread: !n.read }"
          type="button"
          @click="handleMarkRead(n.id)"
        >
          <div class="notif-dot" :class="{ unread: !n.read }"></div>
          <div class="notif-copy">
            <strong>{{ n.title }}</strong>
            <p>{{ n.body }}</p>
            <span class="notif-time">{{ formatNotifTime(n.createdAt) }}</span>
          </div>
        </button>
      </div>
    </section>
  </div>
</template>
