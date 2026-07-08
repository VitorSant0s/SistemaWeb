import { supabase } from '../lib/supabase'
import type { NegotiationDraft, NegotiationRecord, NegotiationStatus } from '../types/domain'

type NegotiationRow = {
  id: string
  athlete_id: string
  professional_id: string
  service_offer_id: string
  status: string
  created_at: string
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

export async function loadNegotiations(profileId: string): Promise<NegotiationRecord[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('negotiations')
    .select('*')
    .or(`athlete_id.eq.${profileId},professional_id.eq.${profileId}`)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return (data as NegotiationRow[]).map(mapNegotiationRow)
}

export async function createNegotiation(draft: NegotiationDraft): Promise<NegotiationRecord> {
  if (!supabase) throw new Error('Falha ao criar negociacao')
  const { data, error } = await supabase
    .from('negotiations')
    .insert({
      athlete_id: draft.athleteId,
      professional_id: draft.professionalId,
      service_offer_id: draft.serviceOfferId,
    })
    .select('*')
    .single()

  if (error || !data) throw new Error('Falha ao criar negociacao')
  return mapNegotiationRow(data as NegotiationRow)
}

export async function updateNegotiationStatus(id: string, status: NegotiationStatus): Promise<NegotiationRecord | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('negotiations')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) return null
  return mapNegotiationRow(data as NegotiationRow)
}