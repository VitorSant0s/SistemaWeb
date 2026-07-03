import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import {
  createNegotiation,
  loadNegotiations,
  updateNegotiationStatus,
} from '../services/negotiationService'
import { createProposal, loadProposals } from '../services/proposalService'
import { createContract, loadContracts, updateContractStatus } from '../services/contractService'
import { addNotification } from '../services/notificationService'
import type {
  ContractRecord,
  ContractWithParties,
  NegotiationRecord,
  NegotiationWithParties,
  ProposalRecord,
  ProposalDraft,
} from '../types/domain'

const DIR_KEY = 'messages-directory'

type NegociacaoState = {
  negotiations: NegotiationRecord[]
  proposals: ProposalRecord[]
  contracts: ContractRecord[]
  initialized: boolean
}

export const useNegociacaoStore = defineStore('negociacao', {
  state: (): NegociacaoState => ({
    negotiations: [],
    proposals: [],
    contracts: [],
    initialized: false,
  }),
  getters: {
    negotiationsWithParties: (state) => {
      const dir = readStoredValue<Array<{ id: string; name: string; role: string; specialty?: string }>>(DIR_KEY, [])

      return state.negotiations.map((n) => {
        const athlete = dir.find((d) => d.id === n.athleteId)
        const professional = dir.find((d) => d.id === n.professionalId)
        const lastProposal = state.proposals
          .filter((p) => p.negotiationId === n.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

        return {
          ...n,
          athleteName: athlete?.name ?? 'Atleta',
          professionalName: professional?.name ?? 'Profissional',
          offerTitle: 'Servico contratado',
          lastProposal,
        } as NegotiationWithParties
      })
    },
    contractsWithParties: (state) => {
      const dir = readStoredValue<Array<{ id: string; name: string; role: string; specialty?: string }>>(DIR_KEY, [])

      return state.contracts.map((c) => {
        const athlete = dir.find((d) => d.id === c.athleteId)
        const professional = dir.find((d) => d.id === c.professionalId)
        return {
          ...c,
          athleteName: athlete?.name ?? 'Atleta',
          professionalName: professional?.name ?? 'Profissional',
          professionalSpecialty: professional?.specialty ?? '',
        } as ContractWithParties
      })
    },
    activeContracts: (state) => state.contracts.filter((c) => c.status === 'active'),
  },
  actions: {
    async init() {
      if (this.initialized) return
      this.initialized = true

      const auth = useAuthStore()
      const userId = auth.user?.id ?? 'dev-user'

      try {
        this.negotiations = await loadNegotiations(userId)
      } catch (e) {
        console.error('Falha ao carregar negociacoes', e)
        this.negotiations = []
      }

      const allProposals: ProposalRecord[] = []
      for (const neg of this.negotiations) {
        try {
          const props = await loadProposals(neg.id)
          allProposals.push(...props)
        } catch (e) {
          console.error('Falha ao carregar propostas para', neg.id, e)
        }
      }
      this.proposals = allProposals

      try {
        this.contracts = await loadContracts(userId)
      } catch (e) {
        console.error('Falha ao carregar contratos', e)
        this.contracts = []
      }
    },
    async startNegotiation(professionalId: string, serviceOfferId: string) {
      const auth = useAuthStore()
      const athleteId = auth.user?.id ?? 'dev-user'

      const existing = this.negotiations.find(
        (n) => n.athleteId === athleteId && n.professionalId === professionalId && n.status === 'open',
      )
      if (existing) return existing

      try {
        const neg = await createNegotiation({ athleteId, professionalId, serviceOfferId })
        this.negotiations = [neg, ...this.negotiations]
        addNotification('new_negotiation', 'Nova negociacao', `Negociacao iniciada com sucesso.`, neg.id)
        return neg
      } catch (e) {
        console.error('Falha ao iniciar negociacao', e)
      }
    },
    async sendProposal(negotiationId: string, draft: Omit<ProposalDraft, 'negotiationId' | 'authorId'>) {
      const auth = useAuthStore()
      const authorId = auth.user?.id ?? 'dev-user'

      try {
        const proposal = await createProposal({ ...draft, negotiationId, authorId })
        this.proposals = [...this.proposals, proposal]
        await updateNegotiationStatus(negotiationId, 'in_review')
        this.negotiations = this.negotiations.map((n) => (n.id === negotiationId ? { ...n, status: 'in_review' } : n))
        addNotification('proposal_received', 'Proposta enviada', `Proposta de R$ ${proposal.valueAmount} enviada para o atleta.`, negotiationId)
        return proposal
      } catch (e) {
        console.error('Falha ao enviar proposta', e)
      }
    },
    async acceptProposal(negotiationId: string, proposal: ProposalRecord) {
      const neg = this.negotiations.find((n) => n.id === negotiationId)
      if (!neg) return

      try {
        await updateNegotiationStatus(negotiationId, 'accepted')
        this.negotiations = this.negotiations.map((n) => (n.id === negotiationId ? { ...n, status: 'accepted' } : n))

        const contract = await createContract({
          negotiationId,
          athleteId: neg.athleteId,
          professionalId: neg.professionalId,
          finalAmount: proposal.valueAmount,
        })
        this.contracts = [...this.contracts, contract]
        addNotification('proposal_accepted', 'Proposta aceita', `Proposta de R$ ${proposal.valueAmount} foi aceita.`, contract.id)
        addNotification('contract_created', 'Contrato criado', 'Um novo contrato foi gerado.', contract.id)
        return contract
      } catch (e) {
        console.error('Falha ao aceitar proposta', e)
      }
    },
    async rejectProposal(negotiationId: string) {
      try {
        await updateNegotiationStatus(negotiationId, 'rejected')
        this.negotiations = this.negotiations.map((n) => (n.id === negotiationId ? { ...n, status: 'rejected' } : n))
        addNotification('proposal_rejected', 'Proposta recusada', 'A proposta foi recusada.', negotiationId)
      } catch (e) {
        console.error('Falha ao recusar proposta', e)
      }
    },
    async cancelNegotiation(negotiationId: string) {
      try {
        await updateNegotiationStatus(negotiationId, 'cancelled')
        this.negotiations = this.negotiations.map((n) => (n.id === negotiationId ? { ...n, status: 'cancelled' } : n))
      } catch (e) {
        console.error('Falha ao cancelar negociacao', e)
      }
    },
    async cancelContract(contractId: string) {
      try {
        await updateContractStatus(contractId, 'cancelled')
        this.contracts = this.contracts.map((c) => (c.id === contractId ? { ...c, status: 'cancelled' } : c))
      } catch (e) {
        console.error('Falha ao cancelar contrato', e)
      }
    },
    async completeContract(contractId: string) {
      try {
        await updateContractStatus(contractId, 'completed')
        this.contracts = this.contracts.map((c) => (c.id === contractId ? { ...c, status: 'completed' } : c))
      } catch (e) {
        console.error('Falha ao finalizar contrato', e)
      }
    },
    proposalsForNegotiation(negotiationId: string): ProposalRecord[] {
      return this.proposals.filter((p) => p.negotiationId === negotiationId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    },
    contractForNegotiation(negotiationId: string): ContractRecord | undefined {
      return this.contracts.find((c) => c.negotiationId === negotiationId)
    },
  },
})

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
