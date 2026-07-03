import { supabase } from '../lib/supabase'
import type { ProposalDraft, ProposalRecord } from '../types/domain'

const STORAGE_KEY = 'proposals'

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

function createId() {
  if ('randomUUID' in crypto) return crypto.randomUUID()
  return `prop-${Date.now()}-${Math.random().toString(16).slice(2)}`
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

function loadLocalProposals(): ProposalRecord[] {
  return readStoredValue<ProposalRecord[]>(STORAGE_KEY, [])
}

function saveLocalProposals(proposals: ProposalRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(proposals))
}

export async function loadProposals(negotiationId: string): Promise<ProposalRecord[]> {
  if (!supabase) return loadLocalProposals().filter((p) => p.negotiationId === negotiationId)

  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('negotiation_id', negotiationId)
    .order('created_at', { ascending: true })

  if (error || !data) return loadLocalProposals().filter((p) => p.negotiationId === negotiationId)

  const mapped = (data as ProposalRow[]).map(mapProposalRow)
  // Cache — replace all proposals for this negotiation
  const local = loadLocalProposals()
  const others = local.filter((p) => p.negotiationId !== negotiationId)
  saveLocalProposals([...others, ...mapped])
  return mapped
}

export async function createProposal(draft: ProposalDraft): Promise<ProposalRecord> {
  if (!supabase) {
    const proposal: ProposalRecord = {
      id: createId(),
      negotiationId: draft.negotiationId,
      authorId: draft.authorId,
      valueAmount: draft.valueAmount,
      scope: draft.scope,
      message: draft.message,
      dueDays: draft.dueDays,
      createdAt: new Date().toISOString(),
    }
    saveLocalProposals([...loadLocalProposals(), proposal])
    return proposal
  }

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

  if (error || !data) return createProposal(draft)
  return mapProposalRow(data as ProposalRow)
}
