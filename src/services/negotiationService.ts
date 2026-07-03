import { supabase } from '../lib/supabase'
import type { NegotiationDraft, NegotiationRecord, NegotiationStatus } from '../types/domain'

const STORAGE_KEY = 'negotiations'

type NegotiationRow = {
  id: string
  athlete_id: string
  professional_id: string
  service_offer_id: string
  status: string
  created_at: string
}

function createId() {
  if ('randomUUID' in crypto) return crypto.randomUUID()
  return `neg-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function readStoredValue<T>(key: string, fallback: T) {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    localStorage.removeItem(key)
    return fallback
  }
}

function isNegotiationStatus(value: string): value is NegotiationStatus {
  return ['open', 'in_review', 'accepted', 'rejected', 'cancelled'].includes(value)
}

function mapNegotiationRow(row: NegotiationRow): NegotiationRecord {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    professionalId: row.professional_id,
    serviceOfferId: row.service_offer_id,
    status: isNegotiationStatus(row.status) ? row.status : 'open',
    createdAt: row.created_at,
  }
}

function loadLocalNegotiations(): NegotiationRecord[] {
  return readStoredValue<NegotiationRecord[]>(STORAGE_KEY, [])
}

function saveLocalNegotiations(negotiations: NegotiationRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(negotiations))
}

export async function loadNegotiations(profileId: string): Promise<NegotiationRecord[]> {
  if (!supabase) return loadLocalNegotiations().filter((n) => n.athleteId === profileId || n.professionalId === profileId)

  const { data, error } = await supabase
    .from('negotiations')
    .select('*')
    .or(`athlete_id.eq.${profileId},professional_id.eq.${profileId}`)
    .order('created_at', { ascending: false })

  if (error || !data) return loadLocalNegotiations().filter((n) => n.athleteId === profileId || n.professionalId === profileId)

  const mapped = (data as NegotiationRow[]).map(mapNegotiationRow)
  saveLocalNegotiations(mapped) // cache
  return mapped
}

export async function createNegotiation(draft: NegotiationDraft): Promise<NegotiationRecord> {
  if (!supabase) {
    const negotiation: NegotiationRecord = {
      id: createId(),
      athleteId: draft.athleteId,
      professionalId: draft.professionalId,
      serviceOfferId: draft.serviceOfferId,
      status: 'open',
      createdAt: new Date().toISOString(),
    }
    saveLocalNegotiations([...loadLocalNegotiations(), negotiation])
    return negotiation
  }

  const { data, error } = await supabase
    .from('negotiations')
    .insert({
      athlete_id: draft.athleteId,
      professional_id: draft.professionalId,
      service_offer_id: draft.serviceOfferId,
    })
    .select('*')
    .single()

  if (error || !data) return createNegotiation(draft)
  return mapNegotiationRow(data as NegotiationRow)
}

export async function updateNegotiationStatus(id: string, status: NegotiationStatus): Promise<NegotiationRecord | null> {
  if (!supabase) {
    const negotiations = loadLocalNegotiations()
    const updated = negotiations.map((n) => (n.id === id ? { ...n, status } : n))
    saveLocalNegotiations(updated)
    return updated.find((n) => n.id === id) ?? null
  }

  const { data, error } = await supabase
    .from('negotiations')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) return null
  return mapNegotiationRow(data as NegotiationRow)
}
