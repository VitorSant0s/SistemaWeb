<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Scaffold from '../components/Scaffold.vue'
import { useAuthStore } from '../stores/auth'
import { useNegociacaoStore } from '../stores/negociacao'
import { listProfessionals } from '../services/professionalDirectoryService'
import type { ProfessionalWithProfile } from '../types/domain'

const auth = useAuthStore()
const negociacao = useNegociacaoStore()
const router = useRouter()

const userId = computed(() => auth.user?.id ?? 'dev-user')
const professionals = ref<ProfessionalWithProfile[]>([])
const loading = ref(true)
const negotiatingId = ref<string | null>(null)

onMounted(async () => {
  await negociacao.init()
  professionals.value = await listProfessionals()
  loading.value = false
})

async function startNegotiation(proId: string, offerId: string) {
  negotiatingId.value = proId
  await negociacao.startNegotiation(proId, offerId)
  negotiatingId.value = null
  router.push('/negociacoes')
}

function formatCurrency(value: number | null) {
  if (value === null) return 'A combinar'
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
        <p class="hello-top">Encontre ajuda</p>
        <h1 id="pros-title">Profissionais</h1>
      </div>
    </template>

    <template #drawer-header>
      <p class="sidebar-brand">Raiz Movimento</p>
    </template>

    <template #drawer>
      <RouterLink class="sidebar-item" to="/">Inicio</RouterLink>
      <RouterLink class="sidebar-item" to="/metricas">Metricas</RouterLink>
      <RouterLink class="sidebar-item active" to="/profissionais" aria-current="page">Profissionais</RouterLink>
      <RouterLink class="sidebar-item" to="/negociacoes">Negociacoes</RouterLink>
      <RouterLink class="sidebar-item" to="/contratos">Contratos</RouterLink>
      <RouterLink class="sidebar-item" to="/agenda">Agenda</RouterLink>
      <RouterLink class="sidebar-item" to="/perfil">Perfil</RouterLink>
      <RouterLink class="sidebar-item" to="/mensagens">Mensagens</RouterLink>
    </template>

    <template #drawer-footer>
      <button class="sidebar-item danger" type="button" @click="logout">Sair</button>
    </template>

    <section class="pros-page" aria-labelledby="pros-title">
      <p class="pros-intro">Conheca profissionais prontos para te ajudar a alcancar seus objetivos.</p>

      <div v-if="loading" class="pros-loading">Carregando...</div>

      <div v-else-if="!professionals.length" class="pros-empty">
        <p>Nenhum profissional disponivel no momento.</p>
      </div>

      <div v-else class="pros-grid">
        <article v-for="pro in professionals" :key="pro.id" class="pro-card">
          <div class="pro-card-header">
            <div class="pro-avatar">{{ pro.name.charAt(0).toUpperCase() }}</div>
            <div class="pro-card-title">
              <h2>{{ pro.name }}</h2>
              <span class="pro-specialty">{{ pro.specialty }}</span>
            </div>
            <span class="pro-price">{{ formatCurrency(pro.baseHourlyPrice) }}/h</span>
          </div>

          <p class="pro-bio">{{ pro.bio }}</p>

          <div v-if="pro.offers.length" class="pro-offers">
            <p class="pro-offers-label">Servicos oferecidos:</p>
            <div v-for="offer in pro.offers" :key="offer.id" class="pro-offer-item">
              <div class="pro-offer-copy">
                <strong>{{ offer.title }}</strong>
                <span>{{ offer.description }}</span>
              </div>
              <div class="pro-offer-actions">
                <span class="pro-offer-price">{{ formatCurrency(offer.basePrice) }}</span>
                <button
                  v-if="pro.id !== userId"
                  class="btn-primary btn-sm"
                  type="button"
                  :disabled="negotiatingId === pro.id"
                  @click="startNegotiation(pro.id, offer.id)"
                >
                  {{ negotiatingId === pro.id ? '...' : 'Negociar' }}
                </button>
              </div>
            </div>
          </div>

          <div v-if="pro.id !== userId" class="pro-card-actions">
            <RouterLink class="btn-ghost" :to="'/mensagens?pro=' + pro.id">Conversar</RouterLink>
          </div>
        </article>
      </div>
    </section>

    <template #bottom-nav>
      <RouterLink class="nav-item" to="/">Inicio</RouterLink>
      <RouterLink class="nav-item active" to="/profissionais" aria-current="page">Profissionais</RouterLink>
      <RouterLink class="nav-item" to="/agenda">Agenda</RouterLink>
      <RouterLink class="nav-item" to="/mensagens">Mensagens</RouterLink>
      <RouterLink class="nav-item" to="/perfil">Perfil</RouterLink>
    </template>
  </Scaffold>
</template>
