<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import ExamForm from '../components/ExamForm.vue'
import Scaffold from '../components/Scaffold.vue'
import { useAuthStore } from '../stores/auth'
import { usePerfilStore } from '../stores/perfil'
import { loadOffers, createOffer, updateOffer, toggleOfferActive } from '../services/offerService'
import type { ExamDraft, HealthExam } from '../stores/perfil'
import type { ServiceOfferRecord, ServiceOfferDraft } from '../types/domain'
import BottomNav from '../components/BottomNav.vue'

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
if (role.value === 'professional') loadMyOffers()

const activeTab = ref<PerfilTab>('dados')

const fullName = computed({
  get: () => perfil.profile.fullName,
  set: (v) => { perfil.profile.fullName = v },
})
const city = computed({
  get: () => perfil.profile.city,
  set: (v) => { perfil.profile.city = v },
})
const healthNotes = computed({
  get: () => perfil.health.notes,
  set: (v) => { perfil.health.notes = v },
})
const specialty = computed({
  get: () => perfil.professional.specialty,
  set: (v) => { perfil.professional.specialty = v },
})
const bio = computed({
  get: () => perfil.professional.bio,
  set: (v) => { perfil.professional.bio = v },
})
const baseHourlyPrice = computed({
  get: () => perfil.professional.baseHourlyPrice ?? 0,
  set: (v) => { perfil.professional.baseHourlyPrice = v },
})
const profileMessage = ref('')
const healthMessage = ref('')
const professionalMessage = ref('')
const avatarError = ref('')
const avatarInput = ref<HTMLInputElement | null>(null)
const examFormOpen = ref(false)
const editingExam = ref<HealthExam | null>(null)

const offers = ref<ServiceOfferRecord[]>([])
const offerFormOpen = ref(false)
const editingOffer = ref<ServiceOfferRecord | null>(null)
const offerTitle = ref('')
const offerDesc = ref('')
const offerPrice = ref(0)

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

async function loadMyOffers() {
  const uid = auth.user?.id ?? ''
  offers.value = await loadOffers(uid)
}

function openCreateOffer() {
  editingOffer.value = null
  offerTitle.value = ''
  offerDesc.value = ''
  offerPrice.value = 0
  offerFormOpen.value = true
}

function openEditOffer(offer: ServiceOfferRecord) {
  editingOffer.value = offer
  offerTitle.value = offer.title
  offerDesc.value = offer.description ?? ''
  offerPrice.value = offer.basePrice ?? 0
  offerFormOpen.value = true
}

function closeOfferForm() {
  offerFormOpen.value = false
  editingOffer.value = null
}

async function saveOffer() {
  if (!offerTitle.value.trim()) return
  const uid = auth.user?.id ?? ''
  const draft: ServiceOfferDraft = {
    professionalId: uid,
    title: offerTitle.value.trim(),
    description: offerDesc.value.trim() || null,
    basePrice: offerPrice.value > 0 ? offerPrice.value : null,
  }
  if (editingOffer.value) {
    const updated = await updateOffer(editingOffer.value.id, draft)
    if (updated) {
      offers.value = offers.value.map((o) => (o.id === editingOffer.value!.id ? updated : o))
    }
  } else {
    const created = await createOffer(draft)
    offers.value = [...offers.value, created]
  }
  closeOfferForm()
}

async function toggleOffer(offer: ServiceOfferRecord) {
  const updated = await toggleOfferActive(offer.id, !offer.isActive)
  if (updated) {
    offers.value = offers.value.map((o) => (o.id === offer.id ? updated : o))
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

            <label class="inline-check">
              <input type="checkbox" :checked="perfil.health.shareWithProfessional" @change="perfil.toggleHealthSharing(($event.target as HTMLInputElement).checked)" />
              Compartilhar dados de saude com profissional vinculado
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

      <section v-if="role === 'professional'" class="perfil-card">
        <header class="agenda-section-header">
          <div>
            <p class="agenda-kicker">Servicos</p>
            <h2>Ofertas de servico ({{ offers.length }})</h2>
          </div>
          <button class="agenda-add-inline" type="button" @click="openCreateOffer">Adicionar</button>
        </header>

        <div v-if="offers.length" class="perfil-offers-list">
          <article v-for="offer in offers" :key="offer.id" class="perfil-offer-item">
            <div class="perfil-offer-copy">
              <strong :class="{ inactive: !offer.isActive }">{{ offer.title }}</strong>
              <span>{{ offer.description || 'Sem descricao' }}</span>
              <span class="perfil-offer-price">{{ offer.basePrice ? 'R$ ' + offer.basePrice.toFixed(2) : 'Gratuito' }}</span>
            </div>
            <div class="agenda-item-actions">
              <button type="button" @click="toggleOffer(offer)">{{ offer.isActive ? 'Desativar' : 'Ativar' }}</button>
              <button type="button" @click="openEditOffer(offer)">Editar</button>
            </div>
          </article>
        </div>
        <div v-else class="perfil-offers-empty">
          <p>Nenhuma oferta de servico cadastrada.</p>
        </div>
      </section>
    </section>

    <template #bottom-nav>
      <BottomNav />
    </template>
  </Scaffold>

  <ExamForm v-if="examFormOpen" :exam="editingExam" :athlete-id="auth.user?.id ?? ''" @close="closeExamForm" @save="saveExam" />

  <div v-if="offerFormOpen" class="offer-form-overlay" @click.self="closeOfferForm">
    <section class="offer-form-sheet" role="dialog" aria-modal="true" aria-labelledby="offer-form-title">
      <header class="offer-form-header">
        <div>
          <p class="agenda-kicker">Oferta</p>
          <h2 id="offer-form-title">{{ editingOffer ? 'Editar oferta' : 'Nova oferta' }}</h2>
        </div>
        <button class="offer-form-close" type="button" aria-label="Fechar" @click="closeOfferForm">x</button>
      </header>

      <form class="offer-form" @submit.prevent="saveOffer">
        <label for="offer-title">
          Titulo
          <input id="offer-title" v-model="offerTitle" type="text" placeholder="Ex: Periodizacao de treinos" required />
        </label>

        <label for="offer-desc">
          Descricao
          <textarea id="offer-desc" v-model="offerDesc" rows="3" placeholder="Descreva o que esta incluso..." />
        </label>

        <label for="offer-price">
          Preco (R$)
          <input id="offer-price" v-model.number="offerPrice" type="number" min="0" step="1" />
        </label>

        <div class="offer-form-actions">
          <button class="btn-ghost" type="button" @click="closeOfferForm">Cancelar</button>
          <button class="btn-primary" type="submit" :disabled="!offerTitle.trim()">
            {{ editingOffer ? 'Salvar alteracoes' : 'Criar oferta' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
