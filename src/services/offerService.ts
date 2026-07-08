import { supabase } from '../lib/supabase'
import type { ServiceOfferDraft, ServiceOfferRecord } from '../types/domain'

type OfferRow = {
  id: string
  professional_id: string
  title: string
  description: string | null
  base_price: number | string | null
  is_active: boolean
  created_at: string
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

export async function loadOffers(professionalId: string): Promise<ServiceOfferRecord[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('service_offers')
    .select('*')
    .eq('professional_id', professionalId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return (data as OfferRow[]).map(mapOfferRow)
}

export async function createOffer(draft: ServiceOfferDraft): Promise<ServiceOfferRecord> {
  if (!supabase) throw new Error('Falha ao criar oferta')
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

  if (error || !data) throw new Error('Falha ao criar oferta')
  return mapOfferRow(data as OfferRow)
}

export async function updateOffer(id: string, draft: ServiceOfferDraft): Promise<ServiceOfferRecord | null> {
  if (!supabase) return null
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
  if (!supabase) return null
  const { data, error } = await supabase
    .from('service_offers')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) return null
  return mapOfferRow(data as OfferRow)
}