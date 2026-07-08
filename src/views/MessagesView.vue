<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Scaffold from '../components/Scaffold.vue'
import BottomNav from '../components/BottomNav.vue'
import { useAuthStore } from '../stores/auth'
import {
  getConversations,
  getMessages,
  sendMessage,
  createConversation,
  searchDirectory,
  getDirectoryEntryAsync,
} from '../services/messageService'
import type { ConversationWithProfile, DirectoryEntry, Message } from '../types/domain'
import { supabase } from '../lib/supabase'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const userId = computed(() => auth.user?.id ?? '')

const activeTab = ref<'conversas' | 'buscar'>('conversas')
const conversations = ref<ConversationWithProfile[]>([])
const currentConversation = ref<ConversationWithProfile | null>(null)
const currentMessages = ref<Message[]>([])
const chatInput = ref('')
const searchQuery = ref('')
const searchResults = ref<DirectoryEntry[]>([])

const messagesLoading = ref(true)
let realtimeChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null

async function loadConversations() {
  conversations.value = await getConversations(userId.value)
  messagesLoading.value = false
}

function subscribeRealtime(conversationId: string) {
  if (!supabase) return
  realtimeChannel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const row = payload.new as { id: string; conversation_id: string; sender_id: string; text: string; created_at: string }
        if (row.sender_id === userId.value) return
        const msg: Message = {
          id: row.id,
          conversationId: row.conversation_id,
          senderId: row.sender_id,
          text: row.text,
          createdAt: row.created_at,
        }
        currentMessages.value = [...currentMessages.value, msg]
        conversations.value = conversations.value.map((c) =>
          c.id === conversationId ? { ...c, lastMessage: row.text, lastMessageAt: row.created_at } : c,
        )
      },
    )
    .subscribe()
}

function unsubscribeRealtime() {
  if (realtimeChannel) {
    supabase?.removeChannel(realtimeChannel)
    realtimeChannel = null
  }
}

async function openConversation(conv: ConversationWithProfile) {
  unsubscribeRealtime()
  currentConversation.value = conv
  currentMessages.value = await getMessages(conv.id)
  subscribeRealtime(conv.id)
}

function closeChat() {
  unsubscribeRealtime()
  currentConversation.value = null
  currentMessages.value = []
  chatInput.value = ''
  loadConversations()
}

async function sendChatMessage() {
  const text = chatInput.value.trim()
  if (!text || !currentConversation.value) return
  const message = await sendMessage(currentConversation.value.id, userId.value, text)
  currentMessages.value = [...currentMessages.value, message]
  chatInput.value = ''
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendChatMessage()
  }
}

async function startConversation(entry: DirectoryEntry) {
  const conv = await createConversation(userId.value, entry.id)
  const convWithProfile: ConversationWithProfile = {
    ...conv,
    partnerName: entry.name,
    partnerRole: entry.role,
  }
  currentConversation.value = convWithProfile
  currentMessages.value = []
  chatInput.value = ''
}

const debounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)
watch(searchQuery, (query) => {
  if (debounceTimer.value) clearTimeout(debounceTimer.value)
  debounceTimer.value = setTimeout(async () => {
    searchResults.value = await searchDirectory(query, userId.value)
  }, 200)
})

loadConversations()

// Handle ?pro= query param — auto-open conversation with the given user
if (typeof route.query.pro === 'string') {
  getDirectoryEntryAsync(route.query.pro).then((entry) => {
    if (entry) { startConversation(entry); router.replace({ query: {} }) }
  })
}

// Watch for re-navigation with ?pro= while component is alive
watch(() => route.query.pro, (pro) => {
  if (typeof pro !== 'string') return
  getDirectoryEntryAsync(pro).then((entry) => {
    if (!entry) return
    startConversation(entry)
    router.replace({ query: {} })
  })
})

function formatTime(iso: string) {
  const date = new Date(iso)
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return formatTime(iso)
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

async function logout() {
  await auth.signOut()
  await router.push('/entrar')
}
</script>

<template>
  <Scaffold>
    <template #appbar-title>
      <div v-if="currentConversation" class="hello-block">
        <button class="scaffold-back-btn" type="button" aria-label="Voltar" @click="closeChat">&larr;</button>
        <div>
          <p class="hello-top">{{ currentConversation.partnerRole === 'professional' ? 'Profissional' : 'Atleta' }}</p>
          <h1 id="chat-title">{{ currentConversation.partnerName }}</h1>
        </div>
      </div>
      <div v-else class="hello-block">
        <p class="hello-top">Caixa de entrada</p>
        <h1 id="messages-title">Mensagens</h1>
      </div>
    </template>

    <template #drawer-header>
      <p class="sidebar-brand">Raiz Movimento</p>
    </template>

    <template #drawer>
      <RouterLink class="sidebar-item" to="/">Inicio</RouterLink>
      <RouterLink class="sidebar-item" to="/metricas">Metricas</RouterLink>
      <RouterLink class="sidebar-item" to="/agenda">Agenda</RouterLink>
      <RouterLink class="sidebar-item" to="/perfil">Perfil</RouterLink>
      <RouterLink class="sidebar-item active" to="/mensagens" aria-current="page">Mensagens</RouterLink>
    </template>

    <template #drawer-footer>
      <button class="sidebar-item danger" type="button" @click="logout">Sair</button>
    </template>

    <section class="messages-page" :class="{ 'chat-open': currentConversation }" aria-labelledby="messages-title">
      <template v-if="currentConversation">
        <div class="chat-messages" ref="chatRef">
          <article v-for="msg in currentMessages" :key="msg.id" class="chat-row" :class="{ own: msg.senderId === userId }">
            <div class="chat-bubble">
              <p>{{ msg.text }}</p>
              <span class="chat-time">{{ formatTime(msg.createdAt) }}</span>
            </div>
          </article>
          <div v-if="!currentMessages.length" class="chat-empty">
            <p>Nenhuma mensagem ainda. Envie algo para comecar!</p>
          </div>
        </div>
        <div class="chat-input-area">
          <input
            v-model="chatInput"
            type="text"
            placeholder="Digite sua mensagem..."
            aria-label="Mensagem"
            @keydown="handleKeydown"
          />
          <button class="chat-send-btn" type="button" :disabled="!chatInput.trim()" @click="sendChatMessage">Enviar</button>
        </div>
      </template>

      <template v-else>
        <div class="messages-tabs" role="tablist" aria-label="Alternar mensagens">
          <button
            class="messages-tab"
            :class="{ active: activeTab === 'conversas' }"
            type="button"
            role="tab"
            :aria-selected="activeTab === 'conversas'"
            @click="activeTab = 'conversas'"
          >
            Conversas
          </button>
          <button
            class="messages-tab"
            :class="{ active: activeTab === 'buscar' }"
            type="button"
            role="tab"
            :aria-selected="activeTab === 'buscar'"
            @click="activeTab = 'buscar'"
          >
            Buscar
          </button>
        </div>

        <section v-if="activeTab === 'conversas'" class="conversation-list" aria-label="Conversas">
          <button
            v-for="conv in conversations"
            :key="conv.id"
            class="conversation-item"
            type="button"
            @click="openConversation(conv)"
          >
            <div class="conversation-avatar">
              {{ conv.partnerName.charAt(0).toUpperCase() }}
            </div>
            <div class="conversation-copy">
              <div class="conversation-header">
                <strong>{{ conv.partnerName }}</strong>
                <span class="conversation-time">{{ formatDate(conv.lastMessageAt) }}</span>
              </div>
              <span class="conversation-preview">{{ conv.lastMessage || 'Nenhuma mensagem' }}</span>
              <span class="conversation-role">{{ conv.partnerRole === 'professional' ? 'Profissional' : 'Atleta' }}</span>
            </div>
          </button>
          <div v-if="!conversations.length" class="messages-empty">
            <p>Nenhuma conversa ainda. Busque por profissionais ou atletas para iniciar.</p>
          </div>
        </section>

        <section v-else class="search-section" aria-label="Buscar pessoas">
          <div class="search-field">
            <input
              v-model="searchQuery"
              type="search"
              placeholder="Buscar profissional ou atleta..."
              aria-label="Buscar profissional ou atleta"
              autocomplete="off"
            />
          </div>
          <div class="search-results">
            <button
              v-for="entry in searchResults"
              :key="entry.id"
              class="directory-item"
              type="button"
              @click="startConversation(entry)"
            >
              <div class="conversation-avatar">
                {{ entry.name.charAt(0).toUpperCase() }}
              </div>
              <div class="conversation-copy">
                <strong>{{ entry.name }}</strong>
                <span class="conversation-role">{{ entry.role === 'professional' ? 'Profissional' : 'Atleta' }}</span>
                <span v-if="entry.specialty" class="conversation-specialty">{{ entry.specialty }}</span>
              </div>
            </button>
            <div v-if="searchQuery && !searchResults.length" class="messages-empty">
              <p>Nenhum resultado encontrado para "{{ searchQuery }}".</p>
            </div>
            <div v-if="!searchQuery" class="messages-empty">
              <p>Digite o nome de um profissional ou atleta para iniciar uma conversa.</p>
            </div>
          </div>
        </section>
      </template>
    </section>

    <template #bottom-nav>
      <BottomNav />
    </template>
  </Scaffold>
</template>
