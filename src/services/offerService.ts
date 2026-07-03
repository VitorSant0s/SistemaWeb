import { supabase } from '../lib/supabase'
import type { ServiceOfferDraft, ServiceOfferRecord } from '../types/domain'

const STORAGE_KEY = 'service-offers'

type OfferRow = {
  id: string
  professional_id: string
  title: string
  description: string | null
  base_price: number | string | null
  is_active: boolean
  created_at: string
}

function createId() {
  if ('randomUUID' in crypto) return crypto.randomUUID()
  return `offer-${Date.now()}-${Math.random().toString(16).slice(2)}`
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

function mapOfferRow(row: OfferRow): ServiceOfferRecord {
  return {
    id: row.id,
    professionalId: row.professional_id,
    title: row.title,
    description: row.description,
    basePrice: row.base_price === null ? null : Number(row.base_price),
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

function loadLocalOffers(): ServiceOfferRecord[] {
  return readStoredValue<ServiceOfferRecord[]>(STORAGE_KEY, [])
}

function saveLocalOffers(offers: ServiceOfferRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(offers))
}

export async function loadOffers(professionalId: string): Promise<ServiceOfferRecord[]> {
  if (!supabase) return loadLocalOffers().filter((o) => o.professionalId === professionalId)

  const { data, error } = await supabase
    .from('service_offers')
    .select('*')
    .eq('professional_id', professionalId)
    .order('created_at', { ascending: false })

  if (error || !data) return loadLocalOffers().filter((o) => o.professionalId === professionalId)

  const mapped = (data as OfferRow[]).map(mapOfferRow)
  // Cache — update offers for this professional
  const local = loadLocalOffers()
  const others = local.filter((o) => o.professionalId !== professionalId)
  saveLocalOffers([...others, ...mapped])
  return mapped
}

export async function createOffer(draft: ServiceOfferDraft): Promise<ServiceOfferRecord> {
  if (!supabase) {
    const offer: ServiceOfferRecord = {
      id: createId(),
      professionalId: draft.professionalId,
      title: draft.title,
      description: draft.description,
      basePrice: draft.basePrice,
      isActive: true,
      createdAt: new Date().toISOString(),
    }
    saveLocalOffers([...loadLocalOffers(), offer])
    return offer
  }

  const { data, error } = await supabase
    .from('service_offers')
    .insert({
      professional_id: draft.professionalId,
      title: draft.title,
      description: draft.description,
      base_price: draft.basePrice,
    })
    .select('*')
    .single()

  if (error || !data) return createOffer(draft)
  return mapOfferRow(data as OfferRow)
}

export async function updateOffer(id: string, draft: ServiceOfferDraft): Promise<ServiceOfferRecord | null> {
  if (!supabase) {
    const offers = loadLocalOffers()
    const updated = offers.map((offer) =>
      offer.id === id
        ? { ...offer, title: draft.title, description: draft.description, basePrice: draft.basePrice }
        : offer,
    )
    saveLocalOffers(updated)
    return updated.find((o) => o.id === id) ?? null
  }

  const { data, error } = await supabase
    .from('service_offers')
    .update({
      title: draft.title,
      description: draft.description,
      base_price: draft.basePrice,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) return null
  return mapOfferRow(data as OfferRow)
}

export async function toggleOfferActive(id: string, isActive: boolean): Promise<ServiceOfferRecord | null> {
  if (!supabase) {
    const offers = loadLocalOffers()
    const updated = offers.map((offer) => (offer.id === id ? { ...offer, isActive } : offer))
    saveLocalOffers(updated)
    return updated.find((o) => o.id === id) ?? null
  }

  const { data, error } = await supabase
    .from('service_offers')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) return null
  return mapOfferRow(data as OfferRow)
}
