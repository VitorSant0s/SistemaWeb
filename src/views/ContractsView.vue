<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Scaffold from '../components/Scaffold.vue'
import { useAuthStore } from '../stores/auth'
import { useNegociacaoStore } from '../stores/negociacao'
import type { ContractWithParties } from '../types/domain'

const auth = useAuthStore()
const negociacao = useNegociacaoStore()
const router = useRouter()

const loading = ref(true)
const activeTab = ref<'ativos' | 'concluidos'>('ativos')
const selectedContract = ref<ContractWithParties | null>(null)

onMounted(async () => {
  await negociacao.init()
  loading.value = false
})

const userId = computed(() => auth.user?.id ?? 'dev-user')
const contractsWithParties = computed(() => negociacao.contractsWithParties)

const activeContracts = computed(() => contractsWithParties.value.filter((c) => c.status === 'active'))
const completedContracts = computed(() => contractsWithParties.value.filter((c) => c.status !== 'active'))

const currentContract = computed(() => selectedContract.value)

function selectContract(c: ContractWithParties) {
  selectedContract.value = c
}

function closeDetail() {
  selectedContract.value = null
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function statusLabel(status: string) {
  const map: Record<string, string> = { active: 'Ativo', completed: 'Concluido', cancelled: 'Cancelado' }
  return map[status] ?? status
}

async function completeContract() {
  if (!currentContract.value) return
  await negociacao.completeContract(currentContract.value.id)
}

async function cancelContract() {
  if (!currentContract.value) return
  await negociacao.cancelContract(currentContract.value.id)
}

async function logout() {
  await auth.signOut()
  await router.push('/entrar')
}
</script>

<template>
  <Scaffold>
    <template #appbar-title>
      <div v-if="currentContract" class="hello-block">
        <button class="scaffold-back-btn" type="button" aria-label="Voltar" @click="closeDetail">&larr;</button>
        <div>
          <p class="hello-top">Contrato</p>
          <h1 id="contract-detail-title">{{ currentContract.athleteName }} &times; {{ currentContract.professionalName }}</h1>
        </div>
      </div>
      <div v-else class="hello-block">
        <p class="hello-top">Seus contratos</p>
        <h1 id="contracts-title">Contratos</h1>
      </div>
    </template>

    <template #drawer-header>
      <p class="sidebar-brand">Raiz Movimento</p>
    </template>

    <template #drawer>
      <RouterLink class="sidebar-item" to="/">Inicio</RouterLink>
      <RouterLink class="sidebar-item" to="/metricas">Metricas</RouterLink>
      <RouterLink class="sidebar-item" to="/profissionais">Profissionais</RouterLink>
      <RouterLink class="sidebar-item" to="/negociacoes">Negociacoes</RouterLink>
      <RouterLink class="sidebar-item active" to="/contratos" aria-current="page">Contratos</RouterLink>
      <RouterLink class="sidebar-item" to="/agenda">Agenda</RouterLink>
      <RouterLink class="sidebar-item" to="/perfil">Perfil</RouterLink>
      <RouterLink class="sidebar-item" to="/mensagens">Mensagens</RouterLink>
    </template>

    <template #drawer-footer>
      <button class="sidebar-item danger" type="button" @click="logout">Sair</button>
    </template>

    <section class="contracts-page" aria-labelledby="contracts-title">
      <div v-if="loading" class="pros-loading">Carregando...</div>
      <template v-if="!loading && currentContract">
        <div class="contract-detail">
          <div class="contract-detail-header">
            <span class="contract-status-badge" :class="currentContract.status">{{ statusLabel(currentContract.status) }}</span>
          </div>

          <div class="contract-detail-info">
            <div class="contract-info-row">
              <span class="contract-info-label">Profissional</span>
              <strong>{{ currentContract.professionalName }}</strong>
              <span>{{ currentContract.professionalSpecialty }}</span>
            </div>
            <div class="contract-info-row">
              <span class="contract-info-label">Atleta</span>
              <strong>{{ currentContract.athleteName }}</strong>
              <RouterLink :to="'/atleta/' + currentContract.athleteId" class="helper-link">Ver perfil do atleta</RouterLink>
            </div>
            <div class="contract-info-row">
              <span class="contract-info-label">Valor</span>
              <strong>{{ formatCurrency(currentContract.finalAmount) }}</strong>
            </div>
            <div class="contract-info-row">
              <span class="contract-info-label">Inicio</span>
              <span>{{ formatDate(currentContract.startedAt) }}</span>
            </div>
            <div v-if="currentContract.finishedAt" class="contract-info-row">
              <span class="contract-info-label">Fim</span>
              <span>{{ formatDate(currentContract.finishedAt) }}</span>
            </div>
          </div>

          <div class="contract-detail-actions">
            <RouterLink class="btn-ghost" :to="'/agenda?contrato=' + currentContract.id">Ver treinos vinculados</RouterLink>
            <RouterLink class="btn-ghost" to="/mensagens">Conversar</RouterLink>
          </div>

          <div v-if="currentContract.status === 'active'" class="contract-detail-actions">
            <button class="btn-primary" type="button" @click="completeContract">Finalizar contrato</button>
            <button class="btn-ghost danger" type="button" @click="cancelContract">Cancelar contrato</button>
          </div>
        </div>
      </template>

      <template v-if="!loading && !currentContract">
        <div class="contracts-tabs" role="tablist" aria-label="Alternar contratos">
          <button
            class="contracts-tab"
            :class="{ active: activeTab === 'ativos' }"
            type="button"
            role="tab"
            :aria-selected="activeTab === 'ativos'"
            @click="activeTab = 'ativos'"
          >Ativos</button>
          <button
            class="contracts-tab"
            :class="{ active: activeTab === 'concluidos' }"
            type="button"
            role="tab"
            :aria-selected="activeTab === 'concluidos'"
            @click="activeTab = 'concluidos'"
          >Concluidos / Cancelados</button>
        </div>

        <section v-if="activeTab === 'ativos'" class="contracts-list" aria-label="Contratos ativos">
          <button
            v-for="c in activeContracts"
            :key="c.id"
            class="contract-item"
            type="button"
            @click="selectContract(c)"
          >
            <div class="contract-item-avatar">{{ (c.athleteId === userId ? c.professionalName : c.athleteName).charAt(0).toUpperCase() }}</div>
            <div class="contract-item-copy">
              <strong>{{ c.athleteId === userId ? c.professionalName : c.athleteName }}</strong>
              <span>{{ c.professionalSpecialty || 'Acompanhamento' }}</span>
              <span class="contract-item-value">{{ formatCurrency(c.finalAmount) }}</span>
            </div>
            <span class="contract-item-status active">Ativo</span>
          </button>
          <div v-if="!activeContracts.length" class="contracts-empty">
            <p>Nenhum contrato ativo.</p>
            <RouterLink class="btn-ghost" to="/profissionais">Buscar profissionais</RouterLink>
          </div>
        </section>

        <section v-else class="contracts-list" aria-label="Contratos concluidos">
          <button
            v-for="c in completedContracts"
            :key="c.id"
            class="contract-item"
            type="button"
            @click="selectContract(c)"
          >
            <div class="contract-item-avatar">{{ (c.athleteId === userId ? c.professionalName : c.athleteName).charAt(0).toUpperCase() }}</div>
            <div class="contract-item-copy">
              <strong>{{ c.athleteId === userId ? c.professionalName : c.athleteName }}</strong>
              <span>{{ c.professionalSpecialty || 'Acompanhamento' }}</span>
              <span class="contract-item-value">{{ formatCurrency(c.finalAmount) }}</span>
            </div>
            <span class="contract-item-status" :class="c.status">{{ statusLabel(c.status) }}</span>
          </button>
          <div v-if="!completedContracts.length" class="contracts-empty">
            <p>Nenhum contrato concluido ou cancelado.</p>
          </div>
        </section>
      </template>
    </section>

    <template #bottom-nav>
      <RouterLink class="nav-item" to="/">Inicio</RouterLink>
      <RouterLink class="nav-item" to="/profissionais">Profissionais</RouterLink>
      <RouterLink class="nav-item" to="/agenda">Agenda</RouterLink>
      <RouterLink class="nav-item" to="/mensagens">Mensagens</RouterLink>
      <RouterLink class="nav-item" to="/perfil">Perfil</RouterLink>
    </template>
  </Scaffold>
</template>
