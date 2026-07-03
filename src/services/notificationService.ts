const STORAGE_KEY = 'notifications'

export type NotificationType = 'new_negotiation' | 'proposal_received' | 'proposal_accepted' | 'proposal_rejected' | 'contract_created' | 'new_message'

export type AppNotification = {
  id: string
  type: NotificationType
  title: string
  body: string
  relatedId: string | null
  read: boolean
  createdAt: string
}

function createId() {
  if ('randomUUID' in crypto) return crypto.randomUUID()
  return `notif-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function load(): AppNotification[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return []
  }
}

function save(notifications: AppNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications))
}

export function getNotifications(): AppNotification[] {
  return load().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getUnreadCount(): number {
  return load().filter((n) => !n.read).length
}

export function addNotification(type: NotificationType, title: string, body: string, relatedId: string | null = null): AppNotification {
  const notifications = load()
  const notification: AppNotification = {
    id: createId(),
    type,
    title,
    body,
    relatedId,
    read: false,
    createdAt: new Date().toISOString(),
  }
  save([notification, ...notifications])
  return notification
}

export function markAsRead(id: string) {
  const notifications = load()
  save(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)))
}

export function markAllAsRead() {
  save(load().map((n) => ({ ...n, read: true })))
}

export function clearNotifications() {
  localStorage.removeItem(STORAGE_KEY)
}
