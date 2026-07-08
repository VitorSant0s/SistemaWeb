import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { supabase } from '../lib/supabase'
import { loadProfile, saveProfile, loadProfessionalProfile, saveProfessionalProfile, saveAthleteHealthData } from '../services/profileService'
import type { ProfileRecord, ProfessionalProfileDraft, UserRole } from '../types/domain'

export type ProfileRole = 'athlete' | 'professional'

export type ProfileData = {
  fullName: string
  city: string
  avatarDataUrl: string | null
}

export type HealthExam = {
  id: string
  title: string
  date: string
  imageDataUrl: string
  notes: string
  createdAt: string
}

export type HealthData = {
  notes: string
  exams: HealthExam[]
  shareWithProfessional: boolean
}

export type ProfessionalData = {
  specialty: string
  bio: string
  baseHourlyPrice: number | null
}

export type ExamDraft = {
  title: string
  date: string
  imageDataUrl: string
  notes: string
}

type PerfilInitPayload = {
  fullName?: string
  role?: ProfileRole | null
}

type PerfilState = {
  profile: ProfileData
  health: HealthData
  professional: ProfessionalData
  initialized: boolean
}

const HEALTH_STORAGE_KEY = 'perfil-health'

function createId(prefix: string) {
  if ('randomUUID' in crypto) return crypto.randomUUID()
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
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

export const usePerfilStore = defineStore('perfil', {
  state: (): PerfilState => ({
    profile: { fullName: '', city: '', avatarDataUrl: null },
    health: { notes: '', exams: [], shareWithProfessional: false },
    professional: { specialty: '', bio: '', baseHourlyPrice: null },
    initialized: false,
  }),
  getters: {
    initials: (state) => {
      const words = state.profile.fullName.trim().split(/\s+/).filter(Boolean)
      if (words.length === 0) return 'RM'
      return words
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? '')
        .join('')
    },
    examCount: (state) => state.health.exams.length,
  },
  actions: {
    syncHealth() {
      const auth = useAuthStore()
      const userId = auth.user?.id ?? ''
      localStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(this.health))
      saveAthleteHealthData(userId, this.health)
    },
    async init(payload: PerfilInitPayload = {}) {
      if (this.initialized) return
      this.initialized = true

      const auth = useAuthStore()
      const userId = auth.user?.id ?? ''
      const role = (payload.role ?? auth.role ?? 'athlete') as UserRole

      this.health = readStoredValue(HEALTH_STORAGE_KEY, { notes: '', exams: [], shareWithProfessional: false })

      if (!supabase) return

      try {
        const profileRecord = await loadProfile({ userId, role, fullName: payload.fullName })
        if (profileRecord) {
          this.profile.fullName = profileRecord.fullName
          this.profile.city = profileRecord.city ?? ''
          if (profileRecord.avatarDataUrl) this.profile.avatarDataUrl = profileRecord.avatarDataUrl
        }
      } catch {
        console.error('Falha ao carregar perfil do servidor')
      }

      try {
        if (role === 'professional') {
          const professionalRecord = await loadProfessionalProfile(userId)
          if (professionalRecord) {
            this.professional.specialty = professionalRecord.specialty
            this.professional.bio = professionalRecord.bio ?? ''
            this.professional.baseHourlyPrice = professionalRecord.baseHourlyPrice
          }
        }
      } catch {
        console.error('Falha ao carregar perfil profissional do servidor')
      }
    },
    async saveProfile(data: { fullName: string; city: string; avatarDataUrl: string | null }) {
      const auth = useAuthStore()
      const userId = auth.user?.id ?? ''
      const role = (auth.role ?? 'athlete') as UserRole
      const record: ProfileRecord = {
        id: userId,
        fullName: data.fullName.trim() || 'Atleta Raiz',
        role,
        city: data.city || null,
        avatarDataUrl: data.avatarDataUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const saved = await saveProfile(record)
      this.profile = {
        fullName: saved.fullName,
        city: saved.city ?? '',
        avatarDataUrl: saved.avatarDataUrl,
      }
    },
    async saveAvatar(avatarDataUrl: string | null) {
      await this.saveProfile({
        fullName: this.profile.fullName,
        city: this.profile.city,
        avatarDataUrl,
      })
    },
    toggleHealthSharing(enabled: boolean) {
      this.health.shareWithProfessional = enabled
      this.syncHealth()
    },
    saveHealthNotes(notes: string) {
      this.health.notes = notes
      this.syncHealth()
    },
    addExam(draft: ExamDraft) {
      const exam: HealthExam = {
        ...draft,
        id: createId('exam'),
        createdAt: new Date().toISOString(),
      }
      this.health.exams = [exam, ...this.health.exams]
      this.syncHealth()
    },
    updateExam(id: string, draft: ExamDraft) {
      this.health.exams = this.health.exams.map((exam) => (exam.id === id ? { ...exam, ...draft } : exam))
      this.syncHealth()
    },
    deleteExam(id: string) {
      this.health.exams = this.health.exams.filter((exam) => exam.id !== id)
      this.syncHealth()
    },
    async saveProfessional(data: ProfessionalData) {
      const auth = useAuthStore()
      const userId = auth.user?.id ?? ''
      const draft: ProfessionalProfileDraft = {
        specialty: data.specialty.trim() || 'Especialista esportivo',
        bio: data.bio.trim(),
        baseHourlyPrice: data.baseHourlyPrice,
      }
      const saved = await saveProfessionalProfile(userId, draft)
      this.professional = {
        specialty: saved.specialty,
        bio: saved.bio ?? '',
        baseHourlyPrice: saved.baseHourlyPrice,
      }
    },
  },
})