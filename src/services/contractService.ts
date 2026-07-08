import { supabase } from '../lib/supabase'
import type { ContractDraft, ContractRecord, ContractStatus } from '../types/domain'

type ContractRow = {
  id: string
  negotiation_id: string
  athlete_id: string
  professional_id: string
  final_amount: number | string
  status: string
  started_at: string
  finished_at: string | null
}

function isContractStatus(value: string): value is ContractStatus {
  return ['active', 'completed', 'cancelled'].includes(value)
}

function mapContractRow(row: ContractRow): ContractRecord {
  return {
    id: row.id,
    negotiationId: row.negotiation_id,
    athleteId: row.athlete_id,
    professionalId: row.professional_id,
    finalAmount: Number(row.final_amount),
    status: isContractStatus(row.status) ? row.status : 'active',
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }
}

export async function loadContracts(profileId: string): Promise<ContractRecord[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .or(`athlete_id.eq.${profileId},professional_id.eq.${profileId}`)
    .order('started_at', { ascending: false })

  if (error || !data) return []
  return (data as ContractRow[]).map(mapContractRow)
}

export async function createContract(draft: ContractDraft): Promise<ContractRecord> {
  if (!supabase) throw new Error('Falha ao criar contrato')
  const { data, error } = await supabase
    .from('contracts')
    .insert({
      negotiation_id: draft.negotiationId,
      athlete_id: draft.athleteId,
      professional_id: draft.professionalId,
      final_amount: draft.finalAmount,
    })
    .select('*')
    .single()

  if (error || !data) throw new Error('Falha ao criar contrato')
  return mapContractRow(data as ContractRow)
}

export async function updateContractStatus(id: string, status: ContractStatus): Promise<ContractRecord | null> {
  if (!supabase) return null
  const payload: Partial<ContractRow> = { status }
  if (status === 'completed' || status === 'cancelled') {
    payload.finished_at = new Date().toISOString()
  }

  const { data, error } = await supabase.from('contracts').update(payload).eq('id', id).select('*').single()
  if (error || !data) return null
  return mapContractRow(data as ContractRow)
}