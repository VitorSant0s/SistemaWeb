<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Scaffold from '../components/Scaffold.vue'
import { useAuthStore } from '../stores/auth'
import { useAgendaStore, formatDateKey } from '../stores/agenda'
import { useNegociacaoStore } from '../stores/negociacao'
import { generateChallenge, loadFeedback, saveFeedback } from '../services/challengeService'
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '../services/notificationService'
import BottomNav from '../components/BottomNav.vue'
import type { AppNotification } from '../services/notificationService'
import type { ChallengeRating } from '../types/domain'

const auth = useAuthStore()
const agendaStore = useAgendaStore()
const negociacao = useNegociacaoStore()
const router = useRouter()
const userId = computed(() => auth.user?.id ?? 'dev-user')

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

const userName = computed(() => {
  return auth.user?.user_metadata?.full_name ?? 'Vitor'
})

const role = computed(() => auth.role ?? 'athlete')

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
})

const weekDays = computed(() => {
  const todayDate = new Date()
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
  const days: { label: string; dateKey: string; isToday: boolean }[] = []
  for (let i = 0; i < 6; i++) {
    const date = new Date(todayDate)
    date.setDate(todayDate.getDate() + i)
    days.push({
      label: `${dayNames[date.getDay()]} ${date.getDate()}`,
      dateKey: formatDateKey(date),
      isToday: i === 0,
    })
  }
  return days
})

const challenge = computed(() => generateChallenge(agendaStore.workouts))

const nextWorkout = computed(() => {
  const todayDate = formatDateKey(new Date())
  const upcoming = agendaStore.workouts
    .filter((w) => w.workoutDate >= todayDate)
    .sort((a, b) => a.workoutDate.localeCompare(b.workoutDate))
  return upcoming[0] ?? null
})

const stats = computed(() => agendaStore.stats)

const ratingLabel = computed(() => {
  if (!savedFeedback.value) return ''
  const map: Record<ChallengeRating, string> = { completed: 'Conclui', partial: 'Parcial', missed: 'Nao consegui' }
  return map[savedFeedback.value.rating]
})

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

onMounted(async () => {
  agendaStore.init()
  try {
    await negociacao.init()
    savedFeedback.value = await loadFeedback(userId.value, today)
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
  await router.push('/entrar')
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

    <section class="home-page" aria-labelledby="home-title">
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
          :class="{ active: day.isToday }"
          type="button"
          :aria-current="day.isToday ? 'date' : undefined"
        >{{ day.label }}</button>
      </section>

      <section v-if="nextWorkout" class="workout-card" aria-labelledby="workout-title">
        <p class="workout-time">{{ nextWorkout.workoutDate }} &middot; {{ nextWorkout.durationMin }}min</p>
        <h2 id="workout-title">{{ nextWorkout.workoutType }}</h2>
        <p class="workout-sub">{{ nextWorkout.distanceKm > 0 ? `${nextWorkout.distanceKm} km` : 'Sem distancia' }}</p>
        <RouterLink class="btn-ghost" to="/agenda">Ver na agenda</RouterLink>
      </section>

      <section v-else class="workout-card" aria-labelledby="workout-title">
        <p class="workout-time">Nenhum treino agendado</p>
        <h2 id="workout-title">Vamos comecar?</h2>
        <p class="workout-sub">Crie seu primeiro treino na agenda</p>
        <RouterLink class="btn-ghost" to="/agenda">Ir para agenda</RouterLink>
      </section>

      <section v-if="role === 'professional' && proAthletes.length" class="home-section" aria-label="Meus atletas">
        <header class="home-section-header">
          <h2>Meus atletas</h2>
          <RouterLink class="btn-ghost" to="/contratos">Ver todos</RouterLink>
        </header>
        <div class="home-athlete-grid">
          <RouterLink
            v-for="athlete in proAthletes"
            :key="athlete.contractId"
            :to="'/atleta/' + athlete.athleteId"
            class="home-athlete-card"
          >
            <div class="home-athlete-avatar">{{ athlete.athleteName.charAt(0).toUpperCase() }}</div>
            <div class="home-athlete-copy">
              <strong>{{ athlete.athleteName }}</strong>
              <span>Contrato ativo</span>
            </div>
          </RouterLink>
        </div>
      </section>

      <section v-if="role === 'athlete' && activeContracts.length" class="home-section" aria-label="Contratos ativos">
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
