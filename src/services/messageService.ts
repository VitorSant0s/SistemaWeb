import type { Conversation, ConversationWithProfile, DirectoryEntry, Message } from '../types/domain'
import { supabase } from '../lib/supabase'
import { addNotification } from './notificationService'

const CONVERSATIONS_KEY = 'messages-conversations'
const MESSAGES_PREFIX = 'messages-'
const DIRECTORY_KEY = 'messages-directory'

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

export async function getDirectoryEntryAsync(id: string): Promise<DirectoryEntry | undefined> {
  if (!supabase) return readStoredValue<DirectoryEntry[]>(DIRECTORY_KEY, []).find((e) => e.id === id)
  const cached = readStoredValue<DirectoryEntry[]>(DIRECTORY_KEY, []).find((e) => e.id === id)
  if (cached) return cached
  const { data } = await supabase.from('profiles').select('id, full_name, role').eq('id', id).maybeSingle()
  if (!data) return undefined
  let specialty: string | undefined
  if (data.role === 'professional') {
    const { data: pro } = await supabase.from('professional_profiles').select('specialty').eq('id', id).maybeSingle()
    if (pro) specialty = pro.specialty
  }
  const entry: DirectoryEntry = { id: data.id, name: data.full_name, role: data.role, specialty }
  const dir = readStoredValue<DirectoryEntry[]>(DIRECTORY_KEY, [])
  const idx = dir.findIndex((e) => e.id === id)
  if (idx >= 0) dir[idx] = entry; else dir.push(entry)
  localStorage.setItem(DIRECTORY_KEY, JSON.stringify(dir))
  return entry
}

export async function getConversations(userId: string): Promise<ConversationWithProfile[]> {
  if (!supabase) return readStoredValue<ConversationWithProfile[]>(CONVERSATIONS_KEY, [])
  const [convResult, dirResult] = await Promise.all([
    supabase.from('conversations').select('*').contains('participant_ids', [userId]).order('last_message_at', { ascending: false }),
    loadDirectoryFromSupabase(),
  ])

  const { data, error } = convResult
  const dirCache = dirResult

  if (error || !data) return []

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
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(mapped))
  return mapped
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  if (!supabase) return readStoredValue<Message[]>(MESSAGES_PREFIX + conversationId, [])
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error || !data) return []

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

export async function sendMessage(conversationId: string, senderId: string, text: string): Promise<Message> {
  if (!supabase) {
    const messages = readStoredValue<Message[]>(MESSAGES_PREFIX + conversationId, [])
    const message: Message = {
      id: '',
      conversationId,
      senderId,
      text,
      createdAt: new Date().toISOString(),
    }
    localStorage.setItem(MESSAGES_PREFIX + conversationId, JSON.stringify([...messages, message]))
    const conversations = readStoredValue<Conversation[]>(CONVERSATIONS_KEY, [])
    const updated = conversations.map((c) =>
      c.id === conversationId ? { ...c, lastMessage: text, lastMessageAt: message.createdAt } : c,
    )
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updated))
    addNotification('new_message', 'Nova mensagem', text.length > 60 ? text.slice(0, 60) + '...' : text, conversationId)
    return message
  }
  const { error: msgError } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, text })

  if (msgError) throw new Error('Falha ao enviar mensagem')

  await supabase
    .from('conversations')
    .update({ last_message: text, last_message_at: new Date().toISOString() })
    .eq('id', conversationId)

  const messages = readStoredValue<Message[]>(MESSAGES_PREFIX + conversationId, [])
  const message: Message = {
    id: '',
    conversationId,
    senderId,
    text,
    createdAt: new Date().toISOString(),
  }
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
  if (!supabase) {
    const conv: Conversation = {
      id: '',
      participantIds: [userId, participantId],
      lastMessage: null,
      lastMessageAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }
    const conversations = readStoredValue<Conversation[]>(CONVERSATIONS_KEY, [])
    const exists = conversations.find((c) => c.id === conv.id)
    if (!exists) {
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify([...conversations, conv]))
      localStorage.setItem(MESSAGES_PREFIX + conv.id, JSON.stringify([]))
    }
    return conv
  }
  const { data: dup } = await supabase
    .from('conversations')
    .select('*')
    .contains('participant_ids', [userId, participantId])
    .maybeSingle()

  if (dup) {
    const row = dup as { id: string; participant_ids: string[]; last_message: string | null; last_message_at: string; created_at: string }
    const conv: Conversation = {
      id: row.id,
      participantIds: row.participant_ids,
      lastMessage: row.last_message,
      lastMessageAt: row.last_message_at,
      createdAt: row.created_at,
    }
    const conversations = readStoredValue<Conversation[]>(CONVERSATIONS_KEY, [])
    const exists = conversations.find((c) => c.id === conv.id)
    if (!exists) {
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify([...conversations, conv]))
      localStorage.setItem(MESSAGES_PREFIX + conv.id, JSON.stringify([]))
    }
    return conv
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({ participant_ids: [userId, participantId] })
    .select('*')
    .single()

  if (error || !data) throw new Error('Falha ao criar conversa')

  const row = data as { id: string; participant_ids: string[]; last_message: string | null; last_message_at: string; created_at: string }
  const conv: Conversation = {
    id: row.id,
    participantIds: row.participant_ids,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
  }

  const conversations = readStoredValue<Conversation[]>(CONVERSATIONS_KEY, [])
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify([...conversations, conv]))
  localStorage.setItem(MESSAGES_PREFIX + conv.id, JSON.stringify([]))
  return conv
}

export async function searchDirectory(query: string, userId: string): Promise<DirectoryEntry[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .neq('id', userId)
    .order('full_name')

  if (!data) return []

  const entries: DirectoryEntry[] = data.map((row: { id: string; full_name: string; role: string }) => ({
    id: row.id,
    name: row.full_name,
    role: row.role as 'athlete' | 'professional',
  }))

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

export function getDirectoryEntry(id: string): DirectoryEntry | undefined {
  return readStoredValue<DirectoryEntry[]>(DIRECTORY_KEY, []).find((e) => e.id === id)
}