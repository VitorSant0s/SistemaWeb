import type { Conversation, ConversationWithProfile, DirectoryEntry, Message } from '../types/domain'

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
    {
      id: createId(),
      conversationId: 'mock-conv-1',
      senderId: 'mock-pro-1',
      text: 'Ola! Como esta se sentindo apos o ultimo treino?',
      createdAt: timestamp,
    },
    {
      id: createId(),
      conversationId: 'mock-conv-1',
      senderId: userId,
      text: 'Melhor! A dor no joelho diminuiu bastante.',
      createdAt: timestamp,
    },
    {
      id: createId(),
      conversationId: 'mock-conv-1',
      senderId: 'mock-pro-1',
      text: 'Otimo, aguardo seu retorno nos treinos!',
      createdAt: timestamp,
    },
  ]
  localStorage.setItem(MESSAGES_PREFIX + 'mock-conv-1', JSON.stringify(pro1Messages))

  const pro2Messages: Message[] = [
    {
      id: createId(),
      conversationId: 'mock-conv-2',
      senderId: 'mock-pro-2',
      text: 'Seu desempenho no ciclismo melhorou 15% esta semana.',
      createdAt: timestamp,
    },
    {
      id: createId(),
      conversationId: 'mock-conv-2',
      senderId: userId,
      text: 'Que otimo! Senti que estava mais firme nos sprints.',
      createdAt: timestamp,
    },
    {
      id: createId(),
      conversationId: 'mock-conv-2',
      senderId: 'mock-pro-2',
      text: 'Podemos ajustar a carga na proxima sessao.',
      createdAt: timestamp,
    },
  ]
  localStorage.setItem(MESSAGES_PREFIX + 'mock-conv-2', JSON.stringify(pro2Messages))
}

function getDirectory(): DirectoryEntry[] {
  return seedDirectory()
}

function getPartnerId(conversation: Conversation, userId: string): string {
  return conversation.participantIds.find((id) => id !== userId) ?? conversation.participantIds[0]
}

function findPartner(partnerId: string): DirectoryEntry | undefined {
  return getDirectory().find((e) => e.id === partnerId)
}

export function getConversations(userId: string): ConversationWithProfile[] {
  seedConversations(userId)
  const all = readStoredValue<Conversation[]>(CONVERSATIONS_KEY, [])
  const userConversations = all.filter((c) => c.participantIds.includes(userId))

  return userConversations
    .map((c) => {
      const partnerId = getPartnerId(c, userId)
      const partner = findPartner(partnerId)
      return {
        ...c,
        partnerName: partner?.name ?? 'Desconhecido',
        partnerRole: partner?.role ?? 'athlete',
      }
    })
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
}

export function getMessages(conversationId: string): Message[] {
  return readStoredValue<Message[]>(MESSAGES_PREFIX + conversationId, [])
}

export function sendMessage(conversationId: string, senderId: string, text: string): Message {
  const messages = getMessages(conversationId)
  const message: Message = {
    id: createId(),
    conversationId,
    senderId,
    text,
    createdAt: now(),
  }
  localStorage.setItem(MESSAGES_PREFIX + conversationId, JSON.stringify([...messages, message]))

  const conversations = readStoredValue<Conversation[]>(CONVERSATIONS_KEY, [])
  const updated = conversations.map((c) =>
    c.id === conversationId ? { ...c, lastMessage: text, lastMessageAt: message.createdAt } : c,
  )
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updated))

  return message
}

export function createConversation(userId: string, participantId: string): Conversation {
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
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify([...conversations, conversation]))
  localStorage.setItem(MESSAGES_PREFIX + conversation.id, JSON.stringify([]))
  return conversation
}

export function searchDirectory(query: string): DirectoryEntry[] {
  const directory = getDirectory()
  if (!query.trim()) return directory.filter((e) => e.id !== 'dev-user')

  const lower = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return directory.filter((e) => {
    if (e.id === 'dev-user') return false
    const name = e.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const specialty = (e.specialty ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return name.includes(lower) || specialty.includes(lower)
  })
}

export function getDirectoryEntry(id: string): DirectoryEntry | undefined {
  return getDirectory().find((e) => e.id === id)
}
