import { supabase } from '../lib/supabase'
import type { ContractDraft, ContractRecord, ContractStatus } from '../types/domain'

const STORAGE_KEY = 'contracts'

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

function createId() {
  if ('randomUUID' in crypto) return crypto.randomUUID()
  return `contract-${Date.now()}-${Math.random().toString(16).slice(2)}`
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

function loadLocalContracts(): ContractRecord[] {
  return readStoredValue<ContractRecord[]>(STORAGE_KEY, [])
}

function saveLocalContracts(contracts: ContractRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts))
}

export async function loadContracts(profileId: string): Promise<ContractRecord[]> {
  if (!supabase) return loadLocalContracts().filter((c) => c.athleteId === profileId || c.professionalId === profileId)

  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .or(`athlete_id.eq.${profileId},professional_id.eq.${profileId}`)
    .order('started_at', { ascending: false })

  if (error || !data) return loadLocalContracts().filter((c) => c.athleteId === profileId || c.professionalId === profileId)
  return (data as ContractRow[]).map(mapContractRow)
}

export async function createContract(draft: ContractDraft): Promise<ContractRecord> {
  if (!supabase) {
    const contract: ContractRecord = {
      id: createId(),
      negotiationId: draft.negotiationId,
      athleteId: draft.athleteId,
      professionalId: draft.professionalId,
      finalAmount: draft.finalAmount,
      status: 'active',
      startedAt: new Date().toISOString(),
      finishedAt: null,
    }
    saveLocalContracts([...loadLocalContracts(), contract])
    return contract
  }

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

  if (error || !data) return createContract(draft)
  return mapContractRow(data as ContractRow)
}

export async function updateContractStatus(id: string, status: ContractStatus): Promise<ContractRecord | null> {
  if (!supabase) {
    const contracts = loadLocalContracts()
    const updated = contracts.map((c) => {
      if (c.id !== id) return c
      return {
        ...c,
        status,
        finishedAt: status === 'completed' || status === 'cancelled' ? new Date().toISOString() : c.finishedAt,
      }
    })
    saveLocalContracts(updated)
    return updated.find((c) => c.id === id) ?? null
  }

  const payload: Partial<ContractRow> = { status }
  if (status === 'completed' || status === 'cancelled') {
    payload.finished_at = new Date().toISOString()
  }

  const { data, error } = await supabase.from('contracts').update(payload).eq('id', id).select('*').single()
  if (error || !data) return null
  return mapContractRow(data as ContractRow)
}
