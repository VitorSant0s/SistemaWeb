import type { Conversation, ConversationWithProfile, DirectoryEntry, Message } from '../types/domain'
import { supabase } from '../lib/supabase'
import { addNotification } from './notificationService'

const CONVERSATIONS_KEY = 'messages-conversations'
const MESSAGES_PREFIX = 'messages-'
const DIRECTORY_KEY = 'messages-directory'
const SEED_KEY = 'messages-seeded'

function createId() {
  if ('randomUUID' in crypto) return crypto.randomUUID()
  return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function now() {
  return new Date().toISOString()
}

function readStoredValue<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    localStorage.removeItem(key)
    return fallback
  }
}

function seedDirectory() {
  if (!import.meta.env.DEV) return readStoredValue<DirectoryEntry[]>(DIRECTORY_KEY, [])
  const existing = readStoredValue<DirectoryEntry[]>(DIRECTORY_KEY, [])
  if (existing.length > 0) return existing

  const directory: DirectoryEntry[] = [
    { id: 'dev-user', name: 'Vitor', role: 'athlete' },
    { id: 'mock-pro-1', name: 'Dra. Carla Mendes', role: 'professional', specialty: 'Fisioterapia esportiva' },
    { id: 'mock-pro-2', name: 'Prof. Ricardo Oliveira', role: 'professional', specialty: 'Preparacao fisica' },
    { id: 'mock-pro-3', name: 'Ana Costa', role: 'professional', specialty: 'Nutricao esportiva' },
    { id: 'mock-athlete-1', name: 'Lucas Silva', role: 'athlete' },
    { id: 'mock-athlete-2', name: 'Marina Rocha', role: 'athlete' },
  ]

  localStorage.setItem(DIRECTORY_KEY, JSON.stringify(directory))
  localStorage.setItem(SEED_KEY, 'true')
  return directory
}

function seedConversations(userId: string) {
  if (!import.meta.env.DEV) return
  seedDirectory()
  const existing = readStoredValue<Conversation[]>(CONVERSATIONS_KEY, [])
  if (existing.some((c) => c.participantIds.includes(userId))) return

  const timestamp = now()
  const conversations: Conversation[] = [
    {
      id: 'mock-conv-1',
      participantIds: [userId, 'mock-pro-1'],
      lastMessage: 'Otimo, aguardo seu retorno nos treinos!',
      lastMessageAt: timestamp,
      createdAt: timestamp,
    },
    {
      id: 'mock-conv-2',
      participantIds: [userId, 'mock-pro-2'],
      lastMessage: 'Podemos ajustar a carga na proxima sessao.',
      lastMessageAt: timestamp,
      createdAt: timestamp,
    },
  ]

  const all = [...existing, ...conversations]
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(all))

  const pro1Messages: Message[] = [
    { id: createId(), conversationId: 'mock-conv-1', senderId: 'mock-pro-1', text: 'Ola! Como esta se sentindo apos o ultimo treino?', createdAt: timestamp },
    { id: createId(), conversationId: 'mock-conv-1', senderId: userId, text: 'Melhor! A dor no joelho diminuiu bastante.', createdAt: timestamp },
    { id: createId(), conversationId: 'mock-conv-1', senderId: 'mock-pro-1', text: 'Otimo, aguardo seu retorno nos treinos!', createdAt: timestamp },
  ]
  localStorage.setItem(MESSAGES_PREFIX + 'mock-conv-1', JSON.stringify(pro1Messages))

  const pro2Messages: Message[] = [
    { id: createId(), conversationId: 'mock-conv-2', senderId: 'mock-pro-2', text: 'Seu desempenho no ciclismo melhorou 15% esta semana.', createdAt: timestamp },
    { id: createId(), conversationId: 'mock-conv-2', senderId: userId, text: 'Que otimo! Senti que estava mais firme nos sprints.', createdAt: timestamp },
    { id: createId(), conversationId: 'mock-conv-2', senderId: 'mock-pro-2', text: 'Podemos ajustar a carga na proxima sessao.', createdAt: timestamp },
  ]
  localStorage.setItem(MESSAGES_PREFIX + 'mock-conv-2', JSON.stringify(pro2Messages))
}

function getPartnerId(conversation: Conversation, userId: string): string {
  return conversation.participantIds.find((id) => id !== userId) ?? conversation.participantIds[0]
}

function findPartner(partnerId: string): DirectoryEntry | undefined {
  return seedDirectory().find((e) => e.id === partnerId)
}

function mapConversationWithProfile(c: Conversation, userId: string): ConversationWithProfile {
  const partnerId = getPartnerId(c, userId)
  const partner = findPartner(partnerId)
  return {
    ...c,
    partnerName: partner?.name ?? 'Desconhecido',
    partnerRole: partner?.role ?? 'athlete',
  }
}

export async function loadDirectoryFromSupabase(): Promise<DirectoryEntry[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .order('full_name')

  if (error || !data) return []

  const { data: proData } = await supabase
    .from('professional_profiles')
    .select('id, specialty')

  const proMap = new Map(proData?.map((p) => [p.id, p.specialty]) ?? [])

  return data.map((row: { id: string; full_name: string; role: string }) => ({
    id: row.id,
    name: row.full_name,
    role: row.role as 'athlete' | 'professional',
    specialty: proMap.get(row.id),
  }))
}

function isUUID(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function getConversations(userId: string): Promise<ConversationWithProfile[]> {
  seedConversations(userId)

  // Read from Supabase first
  if (supabase) {
    const [convResult, dirResult] = await Promise.all([
      supabase.from('conversations').select('*').contains('participant_ids', [userId]).order('last_message_at', { ascending: false }),
      loadDirectoryFromSupabase(),
    ])

    const { data, error } = convResult
    const dirCache = dirResult

    if (!error && data) {
      const mapped = (data as Array<{
        id: string; participant_ids: string[]; last_message: string | null;
        last_message_at: string; created_at: string
      }>).map((row) => {
        const partnerId = row.participant_ids.find((id) => id !== userId) ?? row.participant_ids[0]
        const partner = dirCache.find((d) => d.id === partnerId)
        return {
          id: row.id,
          participantIds: row.participant_ids,
          lastMessage: row.last_message,
          lastMessageAt: row.last_message_at,
          createdAt: row.created_at,
          partnerName: partner?.name ?? 'Desconhecido',
          partnerRole: partner?.role ?? 'athlete',
        }
      })
      // Cache in localStorage
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(mapped))
      return mapped
    }
  }

  // Fallback to localStorage cache
  const all = readStoredValue<Conversation[]>(CONVERSATIONS_KEY, [])
  const userConversations = all.filter((c) => c.participantIds.includes(userId))
  return userConversations
    .map((c) => mapConversationWithProfile(c, userId))
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (!error && data) {
      const mapped = (data as Array<{
        id: string; conversation_id: string; sender_id: string;
        text: string; created_at: string
      }>).map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        text: row.text,
        createdAt: row.created_at,
      }))
      localStorage.setItem(MESSAGES_PREFIX + conversationId, JSON.stringify(mapped))
      return mapped
    }
  }

  return readStoredValue<Message[]>(MESSAGES_PREFIX + conversationId, [])
}

export async function sendMessage(conversationId: string, senderId: string, text: string): Promise<Message> {
  const message: Message = {
    id: createId(),
    conversationId,
    senderId,
    text,
    createdAt: now(),
  }

  // Write to Supabase
  if (supabase) {
    const { error: msgError } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: senderId, text })
    if (!msgError) {
      await supabase
        .from('conversations')
        .update({ last_message: text, last_message_at: message.createdAt })
        .eq('id', conversationId)
    }
  }

  // Cache locally
  const messages = readStoredValue<Message[]>(MESSAGES_PREFIX + conversationId, [])
  localStorage.setItem(MESSAGES_PREFIX + conversationId, JSON.stringify([...messages, message]))

  const conversations = readStoredValue<Conversation[]>(CONVERSATIONS_KEY, [])
  const updated = conversations.map((c) =>
    c.id === conversationId ? { ...c, lastMessage: text, lastMessageAt: message.createdAt } : c,
  )
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updated))

  addNotification('new_message', 'Nova mensagem', text.length > 60 ? text.slice(0, 60) + '...' : text, conversationId)

  return message
}

export async function createConversation(userId: string, participantId: string): Promise<Conversation> {
  const conversations = readStoredValue<Conversation[]>(CONVERSATIONS_KEY, [])
  const existing = conversations.find(
    (c) => c.participantIds.includes(userId) && c.participantIds.includes(participantId),
  )
  if (existing) return existing

  const conversation: Conversation = {
    id: createId(),
    participantIds: [userId, participantId],
    lastMessage: null,
    lastMessageAt: now(),
    createdAt: now(),
  }

  // Write to Supabase
  if (supabase && isUUID(userId) && isUUID(participantId)) {
    const { data } = await supabase
      .from('conversations')
      .insert({ participant_ids: [userId, participantId] })
      .select('*')
      .single()

    if (data) {
      conversation.id = (data as { id: string }).id
    }
  }

  // Cache locally
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify([...conversations, conversation]))
  localStorage.setItem(MESSAGES_PREFIX + conversation.id, JSON.stringify([]))
  return conversation
}

export async function searchDirectory(query: string, userId: string): Promise<DirectoryEntry[]> {
  // Try Supabase profiles first
  if (supabase) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .neq('id', userId)
      .order('full_name')

    if (data) {
      const entries: DirectoryEntry[] = data.map((row: { id: string; full_name: string; role: string }) => ({
        id: row.id,
        name: row.full_name,
        role: row.role as 'athlete' | 'professional',
      }))

      // Enrich with specialty from professional_profiles
      const { data: proData } = await supabase
        .from('professional_profiles')
        .select('id, specialty')

      if (proData) {
        const proMap = new Map(proData.map((p) => [p.id, p.specialty]))
        for (const entry of entries) {
          if (proMap.has(entry.id)) entry.specialty = proMap.get(entry.id)
        }
      }

      const lower = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (!query.trim()) return entries
      return entries.filter((e) => {
        const name = e.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const spec = (e.specialty ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        return name.includes(lower) || spec.includes(lower)
      })
    }
  }

  // Fallback to localStorage directory
  const directory = seedDirectory()
  const filtered = directory.filter((e) => e.id !== 'dev-user' && e.id !== userId)

  if (!query.trim()) return filtered

  const lower = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return filtered.filter((e) => {
    const name = e.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const spec = (e.specialty ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return name.includes(lower) || spec.includes(lower)
  })
}

export function getDirectoryEntry(id: string): DirectoryEntry | undefined {
  return seedDirectory().find((e) => e.id === id)
}
