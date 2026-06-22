<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import ExamForm from '../components/ExamForm.vue'
import Scaffold from '../components/Scaffold.vue'
import { useAuthStore } from '../stores/auth'
import { usePerfilStore } from '../stores/perfil'
import type { ExamDraft, HealthExam } from '../stores/perfil'

type PerfilTab = 'dados' | 'detalhes'

const auth = useAuthStore()
const perfil = usePerfilStore()
const router = useRouter()

const role = computed(() => auth.role ?? 'athlete')
const authFullName = computed(() => {
  const fullName = auth.user?.user_metadata?.full_name
  return typeof fullName === 'string' ? fullName : undefined
})

perfil.init({ fullName: authFullName.value, role: role.value })

const activeTab = ref<PerfilTab>('dados')
const fullName = ref(perfil.profile.fullName)
const city = ref(perfil.profile.city)
const healthNotes = ref(perfil.health.notes)
const specialty = ref(perfil.professional.specialty)
const bio = ref(perfil.professional.bio)
const baseHourlyPrice = ref(perfil.professional.baseHourlyPrice ?? 0)
const profileMessage = ref('')
const healthMessage = ref('')
const professionalMessage = ref('')
const avatarError = ref('')
const avatarInput = ref<HTMLInputElement | null>(null)
const examFormOpen = ref(false)
const editingExam = ref<HealthExam | null>(null)

const email = computed(() => auth.user?.email ?? 'dev@raiz.local')
const roleLabel = computed(() => (role.value === 'professional' ? 'Profissional' : 'Atleta'))
const detailTabLabel = computed(() => (role.value === 'professional' ? 'Profissional' : 'Saude'))
const avatarLabel = computed(() => (perfil.profile.avatarDataUrl ? 'Trocar foto de perfil' : 'Adicionar foto de perfil'))

function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(
    new Date(`${dateKey}T00:00:00`),
  )
}

function saveProfile() {
  perfil.saveProfile({
    fullName: fullName.value,
    city: city.value,
    avatarDataUrl: perfil.profile.avatarDataUrl,
  })
  profileMessage.value = 'Dados salvos.'
}

function saveHealthNotes() {
  perfil.saveHealthNotes(healthNotes.value)
  healthMessage.value = 'Anotacoes salvas.'
}

function saveProfessional() {
  perfil.saveProfessional({
    specialty: specialty.value,
    bio: bio.value,
    baseHourlyPrice: baseHourlyPrice.value > 0 ? Number(baseHourlyPrice.value) : null,
  })
  professionalMessage.value = 'Dados profissionais salvos.'
}

function openAvatarPicker() {
  avatarInput.value?.click()
}

function handleAvatarChange(event: Event) {
  avatarError.value = ''
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (file.size > 1_200_000) {
    avatarError.value = 'Use uma foto com ate 1.2 MB para salvar no modo local.'
    input.value = ''
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') perfil.saveAvatar(reader.result)
  }
  reader.onerror = () => {
    avatarError.value = 'Nao foi possivel carregar a foto.'
  }
  reader.readAsDataURL(file)
}

function openCreateExam() {
  editingExam.value = null
  examFormOpen.value = true
}

function editExam(exam: HealthExam) {
  editingExam.value = exam
  examFormOpen.value = true
}

function closeExamForm() {
  editingExam.value = null
  examFormOpen.value = false
}

function saveExam(draft: ExamDraft) {
  if (editingExam.value) {
    perfil.updateExam(editingExam.value.id, draft)
  } else {
    perfil.addExam(draft)
  }
  healthMessage.value = 'Exame salvo.'
  closeExamForm()
}

function deleteExam(exam: HealthExam) {
  if (window.confirm(`Excluir exame "${exam.title}"?`)) {
    perfil.deleteExam(exam.id)
    healthMessage.value = 'Exame excluido.'
  }
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
        <p class="hello-top">Conta e historico</p>
        <h1 id="perfil-title">Perfil</h1>
      </div>
    </template>

    <template #appbar-actions>
      <span class="perfil-role-pill">{{ roleLabel }}</span>
    </template>

    <template #drawer-header>
      <p class="sidebar-brand">Raiz Movimento</p>
    </template>

    <template #drawer>
      <RouterLink class="sidebar-item" to="/">Inicio</RouterLink>
      <RouterLink class="sidebar-item" to="/metricas">Metricas</RouterLink>
      <RouterLink class="sidebar-item" to="/agenda">Agenda</RouterLink>
      <RouterLink class="sidebar-item active" to="/perfil" aria-current="page">Perfil</RouterLink>
      <RouterLink class="sidebar-item" to="/mensagens">Mensagens</RouterLink>
    </template>

    <template #drawer-footer>
      <button class="sidebar-item danger" type="button" @click="logout">Sair</button>
    </template>

    <section class="perfil-page" aria-labelledby="perfil-title">
      <section class="perfil-hero" aria-label="Resumo do perfil">
        <button class="perfil-avatar" type="button" :aria-label="avatarLabel" @click="openAvatarPicker">
          <img v-if="perfil.profile.avatarDataUrl" :src="perfil.profile.avatarDataUrl" alt="Foto de perfil" />
          <span v-else>{{ perfil.initials }}</span>
        </button>
        <input ref="avatarInput" class="perfil-avatar-input" type="file" accept="image/*" @change="handleAvatarChange" />

        <div class="perfil-hero-copy">
          <p class="agenda-kicker">{{ roleLabel }}</p>
          <h2>{{ perfil.profile.fullName }}</h2>
          <p>{{ perfil.profile.city || 'Cidade nao informada' }}</p>
          <small v-if="avatarError" role="alert">{{ avatarError }}</small>
        </div>
      </section>

      <div class="perfil-tabs" role="tablist" aria-label="Alternar perfil">
        <button
          class="perfil-tab"
          :class="{ active: activeTab === 'dados' }"
          type="button"
          role="tab"
          :aria-selected="activeTab === 'dados'"
          @click="activeTab = 'dados'"
        >
          Dados do perfil
        </button>
        <button
          class="perfil-tab"
          :class="{ active: activeTab === 'detalhes' }"
          type="button"
          role="tab"
          :aria-selected="activeTab === 'detalhes'"
          @click="activeTab = 'detalhes'"
        >
          {{ detailTabLabel }}
        </button>
      </div>

      <section v-if="activeTab === 'dados'" class="perfil-card">
        <header class="agenda-section-header">
          <div>
            <p class="agenda-kicker">Usuario</p>
            <h2>Dados basicos</h2>
          </div>
          <span class="perfil-badge">{{ roleLabel }}</span>
        </header>

        <form class="perfil-form" @submit.prevent="saveProfile">
          <label for="profile-name">
            Nome completo
            <input id="profile-name" v-model="fullName" type="text" autocomplete="name" />
          </label>

          <label for="profile-city">
            Cidade
            <input id="profile-city" v-model="city" type="text" autocomplete="address-level2" placeholder="Sua cidade" />
          </label>

          <label for="profile-email">
            Email
            <input id="profile-email" :value="email" type="email" disabled />
          </label>

          <button class="btn-primary" type="submit">Salvar alteracoes</button>
          <p class="feedback" aria-live="polite">{{ profileMessage }}</p>
        </form>
      </section>

      <section v-else-if="role === 'athlete'" class="perfil-health-grid">
        <article class="perfil-card">
          <header class="agenda-section-header">
            <div>
              <p class="agenda-kicker">Saude</p>
              <h2>Anotacoes do atleta</h2>
            </div>
          </header>

          <form class="perfil-form" @submit.prevent="saveHealthNotes">
            <label for="health-notes">
              Historico e observacoes
              <textarea
                id="health-notes"
                v-model="healthNotes"
                rows="7"
                placeholder="Registre alergias, lesoes, restricoes, medicacoes e observacoes relevantes."
              />
            </label>
            <button class="btn-primary" type="submit">Salvar saude</button>
            <p class="feedback" aria-live="polite">{{ healthMessage }}</p>
          </form>
        </article>

        <article class="perfil-card">
          <header class="agenda-section-header">
            <div>
              <p class="agenda-kicker">Exames</p>
              <h2>{{ perfil.examCount }} registros</h2>
            </div>
            <button class="agenda-add-inline" type="button" @click="openCreateExam">Adicionar</button>
          </header>

          <div class="perfil-exam-grid">
            <article v-for="exam in perfil.health.exams" :key="exam.id" class="perfil-exam-card">
              <img class="perfil-exam-thumb" :src="exam.imageDataUrl" :alt="`Imagem do exame ${exam.title}`" />
              <div class="perfil-exam-copy">
                <strong>{{ exam.title }}</strong>
                <span>{{ formatDate(exam.date) }}</span>
                <p>{{ exam.notes || 'Sem observacoes.' }}</p>
              </div>
              <div class="agenda-item-actions">
                <button type="button" @click="editExam(exam)">Editar</button>
                <button type="button" @click="deleteExam(exam)">Excluir</button>
              </div>
            </article>
          </div>
        </article>
      </section>

      <section v-else class="perfil-card">
        <header class="agenda-section-header">
          <div>
            <p class="agenda-kicker">Profissional</p>
            <h2>Dados de atendimento</h2>
          </div>
        </header>

        <form class="perfil-form" @submit.prevent="saveProfessional">
          <label for="professional-specialty">
            Especialidade
            <input id="professional-specialty" v-model="specialty" type="text" placeholder="Ex: Corrida, forca, mobilidade" />
          </label>

          <label for="professional-bio">
            Bio
            <textarea id="professional-bio" v-model="bio" rows="6" placeholder="Descreva sua experiencia e metodologia." />
          </label>

          <label for="professional-price">
            Preco base por hora
            <input id="professional-price" v-model.number="baseHourlyPrice" type="number" min="0" step="1" inputmode="decimal" />
          </label>

          <button class="btn-primary" type="submit">Salvar profissional</button>
          <p class="feedback" aria-live="polite">{{ professionalMessage }}</p>
        </form>
      </section>
    </section>

    <template #bottom-nav>
      <RouterLink class="nav-item" to="/">Inicio</RouterLink>
      <RouterLink class="nav-item" to="/metricas">Metricas</RouterLink>
      <RouterLink class="nav-item" to="/agenda">Agenda</RouterLink>
      <RouterLink class="nav-item active" to="/perfil" aria-current="page">Perfil</RouterLink>
    </template>
  </Scaffold>

  <ExamForm v-if="examFormOpen" :exam="editingExam" @close="closeExamForm" @save="saveExam" />
</template>
