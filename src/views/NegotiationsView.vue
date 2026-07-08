<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Scaffold from '../components/Scaffold.vue'
import BottomNav from '../components/BottomNav.vue'
import { useAuthStore } from '../stores/auth'
import { useNegociacaoStore } from '../stores/negociacao'
import type { NegotiationWithParties } from '../types/domain'

const auth = useAuthStore()
const negociacao = useNegociacaoStore()
const router = useRouter()

const loading = ref(true)
const activeTab = ref<'ativas' | 'historico'>('ativas')
const selectedNeg = ref<NegotiationWithParties | null>(null)
const proposalFormOpen = ref(false)
const proposalValue = ref(0)
const proposalScope = ref('')
const proposalMessage = ref('')
const proposalDueDays = ref(30)
const proposalSaving = ref(false)

onMounted(async () => {
  await negociacao.init()
  loading.value = false
})

const userId = computed(() => auth.user?.id ?? '')
const role = computed(() => auth.role ?? 'athlete')

const negotiationsWithParties = computed(() => negociacao.negotiationsWithParties)

const activeNegotiations = computed(() =>
  negotiationsWithParties.value.filter((n) => n.status === 'open' || n.status === 'in_review'),
)

const historyNegotiations = computed(() =>
  negotiationsWithParties.value.filter((n) => n.status === 'accepted' || n.status === 'rejected' || n.status === 'cancelled'),
)

const currentNeg = computed(() => {
  if (!selectedNeg.value) return null
  return negotiationsWithParties.value.find((n) => n.id === selectedNeg.value!.id) ?? null
})

const currentProposals = computed(() => {
  if (!currentNeg.value) return []
  return negociacao.proposalsForNegotiation(currentNeg.value.id)
})

const currentContract = computed(() => {
  if (!currentNeg.value) return null
  return negociacao.contractForNegotiation(currentNeg.value.id)
})

const negotiationStatusLabel = computed(() => {
  if (!currentNeg.value) return ''
  const map: Record<string, string> = {
    open: 'Aguardando proposta',
    in_review: 'Proposta recebida',
    accepted: 'Aceita',
    rejected: 'Recusada',
    cancelled: 'Cancelada',
  }
  const label = map[currentNeg.value.status] ?? currentNeg.value.status
  if (currentNeg.value.status === 'rejected' && currentProposals.value.length > 0) {
    return `${label} — ${currentProposals.value.length} proposta${currentProposals.value.length > 1 ? 's' : ''}`
  }
  return label
})

function selectNegotiation(neg: NegotiationWithParties) {
  selectedNeg.value = neg
}

function closeDetail() {
  selectedNeg.value = null
}

function openProposalForm() {
  proposalValue.value = currentNeg.value?.lastProposal?.valueAmount ?? 0
  proposalScope.value = ''
  proposalMessage.value = ''
  proposalDueDays.value = 30
  proposalFormOpen.value = true
}

function closeProposalForm() {
  proposalFormOpen.value = false
}

async function submitProposal() {
  if (!currentNeg.value) return
  proposalSaving.value = true
  await negociacao.sendProposal(currentNeg.value.id, {
    valueAmount: proposalValue.value,
    scope: proposalScope.value,
    message: proposalMessage.value || null,
    dueDays: proposalDueDays.value,
  })
  proposalSaving.value = false
  proposalFormOpen.value = false
}

async function acceptProposal(proposalId: string) {
  if (!currentNeg.value) return
  const proposal = currentProposals.value.find((p) => p.id === proposalId)
  if (!proposal) return
  await negociacao.acceptProposal(currentNeg.value.id, proposal)
}

async function rejectProposal() {
  if (!currentNeg.value) return
  await negociacao.rejectProposal(currentNeg.value.id)
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    open: 'Aguardando',
    in_review: 'Em analise',
    accepted: 'Aceita',
    rejected: 'Recusada',
    cancelled: 'Cancelada',
  }
  return map[status] ?? status
}

async function logout() {
  await auth.signOut()
  await router.push('/entrar')
}
</script>

<template>
  <Scaffold>
    <template #appbar-title>
      <div v-if="currentNeg" class="hello-block">
        <button class="scaffold-back-btn" type="button" aria-label="Voltar" @click="closeDetail">&larr;</button>
        <div>
          <p class="hello-top">Negociacao</p>
          <h1 id="neg-detail-title">{{ currentNeg.athleteName }} &times; {{ currentNeg.professionalName }}</h1>
        </div>
      </div>
      <div v-else class="hello-block">
        <p class="hello-top">Suas negociacoes</p>
        <h1 id="neg-title">Negociacoes</h1>
      </div>
    </template>

    <template #drawer-header>
      <p class="sidebar-brand">Raiz Movimento</p>
    </template>

    <template #drawer>
      <RouterLink class="sidebar-item" to="/">Inicio</RouterLink>
      <RouterLink class="sidebar-item" to="/metricas">Metricas</RouterLink>
      <RouterLink v-if="auth.role !== 'professional'" class="sidebar-item" to="/profissionais">Profissionais</RouterLink>
      <RouterLink class="sidebar-item active" to="/negociacoes" aria-current="page">Negociacoes</RouterLink>
      <RouterLink class="sidebar-item" to="/contratos">Contratos</RouterLink>
      <RouterLink class="sidebar-item" to="/agenda">Agenda</RouterLink>
      <RouterLink class="sidebar-item" to="/perfil">Perfil</RouterLink>
      <RouterLink class="sidebar-item" to="/mensagens">Mensagens</RouterLink>
    </template>

    <template #drawer-footer>
      <button class="sidebar-item danger" type="button" @click="logout">Sair</button>
    </template>

    <section class="neg-page" aria-labelledby="neg-title">
      <div v-if="loading" class="pros-loading">Carregando...</div>
      <template v-if="!loading && currentNeg">
        <div class="neg-detail">
          <div class="neg-detail-header">
            <span class="neg-status-badge" :class="currentNeg.status">{{ negotiationStatusLabel }}</span>
            <p class="neg-detail-date">Iniciada em {{ formatDate(currentNeg.createdAt) }}</p>
          </div>

          <div class="neg-detail-section">
            <h2>Propostas</h2>
            <div v-if="!currentProposals.length" class="neg-empty-proposal">
              <p>Nenhuma proposta ainda.</p>
              <p v-if="role === 'professional'" class="neg-hint">Clique em "Criar proposta" para enviar uma.</p>
              <p v-else class="neg-hint">Aguardando o profissional enviar uma proposta.</p>
            </div>

            <div v-for="prop in currentProposals" :key="prop.id" class="neg-proposal-card">
              <div class="neg-proposal-header">
                <strong>{{ formatCurrency(prop.valueAmount) }}</strong>
                <span v-if="prop.dueDays">{{ prop.dueDays }} dias de vigencia</span>
              </div>
              <p class="neg-proposal-scope">{{ prop.scope }}</p>
              <p v-if="prop.message" class="neg-proposal-msg">{{ prop.message }}</p>
              <p class="neg-proposal-date">Enviada em {{ formatDate(prop.createdAt) }}</p>

              <div v-if="role === 'athlete' && currentNeg.status === 'in_review'" class="neg-proposal-actions">
                <button class="btn-primary" type="button" :disabled="!!currentContract" @click="acceptProposal(prop.id)">
                  {{ currentContract ? 'Contrato criado' : 'Aceitar proposta' }}
                </button>
                <button class="btn-ghost danger" type="button" @click="rejectProposal">Recusar</button>
              </div>
            </div>
          </div>

          <div v-if="currentContract" class="neg-detail-section">
            <h2>Contrato</h2>
            <div class="neg-contract-card">
              <p>Contrato <strong>{{ currentContract.status }}</strong></p>
              <p>Valor: {{ formatCurrency(currentContract.finalAmount) }}</p>
              <p>Inicio: {{ formatDate(currentContract.startedAt) }}</p>
              <RouterLink class="btn-ghost" to="/contratos">Ver contrato</RouterLink>
            </div>
          </div>

          <div v-if="role === 'professional' && (currentNeg.status === 'open' || currentNeg.status === 'rejected')" class="neg-detail-actions">
            <button class="btn-primary" type="button" @click="openProposalForm">
              {{ currentNeg.status === 'rejected' ? 'Reenviar proposta' : 'Criar proposta' }}
            </button>
            <button class="btn-ghost danger" type="button" @click="negociacao.cancelNegotiation(currentNeg.id)">Cancelar negociacao</button>
          </div>
          <div v-else-if="currentNeg.status === 'in_review' || currentNeg.status === 'open'">
            <button class="btn-ghost danger" type="button" @click="negociacao.cancelNegotiation(currentNeg.id)">Cancelar negociacao</button>
          </div>
        </div>
      </template>

      <template v-if="!loading && !currentNeg">
        <div class="neg-tabs" role="tablist" aria-label="Alternar negociacoes">
          <button
            class="neg-tab"
            :class="{ active: activeTab === 'ativas' }"
            type="button"
            role="tab"
            :aria-selected="activeTab === 'ativas'"
            @click="activeTab = 'ativas'"
          >Ativas</button>
          <button
            class="neg-tab"
            :class="{ active: activeTab === 'historico' }"
            type="button"
            role="tab"
            :aria-selected="activeTab === 'historico'"
            @click="activeTab = 'historico'"
          >Historico</button>
        </div>

        <section v-if="activeTab === 'ativas'" class="neg-list" aria-label="Negociacoes ativas">
          <button
            v-for="neg in activeNegotiations"
            :key="neg.id"
            class="neg-item"
            type="button"
            @click="selectNegotiation(neg)"
          >
            <div class="neg-item-avatar">{{ (neg.athleteId === userId ? neg.professionalName : neg.athleteName).charAt(0).toUpperCase() }}</div>
            <div class="neg-item-copy">
              <strong>{{ neg.athleteId === userId ? neg.professionalName : neg.athleteName }}</strong>
              <span>{{ neg.offerTitle }}</span>
              <span class="neg-item-status" :class="neg.status">{{ statusBadge(neg.status) }}</span>
            </div>
          </button>
          <div v-if="!activeNegotiations.length" class="neg-empty">
            <p>Nenhuma negociacao ativa.</p>
            <RouterLink v-if="auth.role !== 'professional'" class="btn-ghost" to="/profissionais">Buscar profissionais</RouterLink>
          </div>
        </section>

        <section v-else class="neg-list" aria-label="Historico de negociacoes">
          <button
            v-for="neg in historyNegotiations"
            :key="neg.id"
            class="neg-item"
            type="button"
            @click="selectNegotiation(neg)"
          >
            <div class="neg-item-avatar">{{ (neg.athleteId === userId ? neg.professionalName : neg.athleteName).charAt(0).toUpperCase() }}</div>
            <div class="neg-item-copy">
              <strong>{{ neg.athleteId === userId ? neg.professionalName : neg.athleteName }}</strong>
              <span>{{ neg.offerTitle }}</span>
              <span class="neg-item-status" :class="neg.status">{{ statusBadge(neg.status) }}</span>
            </div>
          </button>
          <div v-if="!historyNegotiations.length" class="neg-empty">
            <p>Nenhuma negociacao concluida.</p>
          </div>
        </section>
      </template>
    </section>

    <template #bottom-nav>
      <BottomNav />
    </template>
  </Scaffold>

  <div v-if="proposalFormOpen" class="neg-proposal-overlay" @click.self="closeProposalForm">
    <section class="neg-proposal-sheet" role="dialog" aria-modal="true" aria-labelledby="proposal-form-title">
      <header class="neg-proposal-header">
        <div>
          <p class="agenda-kicker">Proposta</p>
          <h2 id="proposal-form-title">Criar proposta</h2>
        </div>
        <button class="neg-proposal-close" type="button" aria-label="Fechar" @click="closeProposalForm">x</button>
      </header>

      <form class="neg-proposal-form" @submit.prevent="submitProposal">
        <label for="prop-value">
          Valor (R$)
          <input id="prop-value" v-model.number="proposalValue" type="number" min="0" step="1" required />
        </label>

        <label for="prop-scope">
          Escopo do servico
          <textarea id="prop-scope" v-model="proposalScope" rows="4" placeholder="Descreva o que esta incluido..." required />
        </label>

        <label for="prop-message">
          Mensagem (opcional)
          <textarea id="prop-message" v-model="proposalMessage" rows="2" placeholder="Observacoes adicionais..." />
        </label>

        <label for="prop-days">
          Dias de vigencia
          <input id="prop-days" v-model.number="proposalDueDays" type="number" min="1" step="1" />
        </label>

        <div class="neg-proposal-actions">
          <button class="btn-ghost" type="button" @click="closeProposalForm">Cancelar</button>
          <button class="btn-primary" type="submit" :disabled="proposalSaving || !proposalValue || !proposalScope">
            {{ proposalSaving ? 'Enviando...' : 'Enviar proposta' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
