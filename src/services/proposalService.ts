import { supabase } from '../lib/supabase'
import type { ProposalDraft, ProposalRecord } from '../types/domain'

type ProposalRow = {
  id: string
  negotiation_id: string
  author_id: string
  value_amount: number | string
  scope: string
  message: string | null
  due_days: number | null
  created_at: string
}

function mapProposalRow(row: ProposalRow): ProposalRecord {
  return {
    id: row.id,
    negotiationId: row.negotiation_id,
    authorId: row.author_id,
    valueAmount: Number(row.value_amount),
    scope: row.scope,
    message: row.message,
    dueDays: row.due_days,
    createdAt: row.created_at,
  }
}

export async function loadProposals(negotiationId: string): Promise<ProposalRecord[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('negotiation_id', negotiationId)
    .order('created_at', { ascending: true })

  if (error || !data) return []
  return (data as ProposalRow[]).map(mapProposalRow)
}

export async function createProposal(draft: ProposalDraft): Promise<ProposalRecord> {
  if (!supabase) throw new Error('Falha ao criar proposta')
  const { data, error } = await supabase
    .from('proposals')
    .insert({
      negotiation_id: draft.negotiationId,
      author_id: draft.authorId,
      value_amount: draft.valueAmount,
      scope: draft.scope,
      message: draft.message,
      due_days: draft.dueDays,
    })
    .select('*')
    .single()

  if (error || !data) throw new Error('Falha ao criar proposta')
  return mapProposalRow(data as ProposalRow)
}