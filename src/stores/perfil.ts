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

const PROFILE_STORAGE_KEY = 'perfil-profile'
const HEALTH_STORAGE_KEY = 'perfil-health'
const PROFESSIONAL_STORAGE_KEY = 'perfil-professional'

function todayDateKey() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

function placeholderExamImage(title: string, fill: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="280" viewBox="0 0 420 280"><rect width="420" height="280" rx="30" fill="${fill}"/><circle cx="90" cy="90" r="44" fill="#dcff3d" opacity="0.92"/><path d="M155 86h178M155 124h132M70 194h280" stroke="#f7f9ff" stroke-width="18" stroke-linecap="round" opacity="0.74"/><text x="42" y="246" fill="#f7f9ff" font-family="Arial, sans-serif" font-size="26" font-weight="700">${title}</text></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function createDefaultHealth(): HealthData {
  const exams = import.meta.env.DEV
    ? [
        {
          id: 'mock-exam-joelho',
          title: 'Ressonancia joelho',
          date: todayDateKey(),
          imageDataUrl: placeholderExamImage('Joelho', '#243048'),
          notes: 'Imagem mock para testar anexos de exames.',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'mock-exam-postural',
          title: 'Avaliacao postural',
          date: todayDateKey(),
          imageDataUrl: placeholderExamImage('Postural', '#1f3c34'),
          notes: 'Registro inicial para acompanhamento de postura e mobilidade.',
          createdAt: new Date().toISOString(),
        },
      ]
    : []

  return {
    notes: '',
    shareWithProfessional: false,
    exams,
  }
}

function createDefaultProfessional(): ProfessionalData {
  return {
    specialty: 'Especialista esportivo',
    bio: 'Conte sua abordagem, metodologia e quais atletas voce acompanha.',
    baseHourlyPrice: null,
  }
}

export const usePerfilStore = defineStore('perfil', {
  state: (): PerfilState => ({
    profile: { fullName: 'Atleta Raiz', city: '', avatarDataUrl: null },
    health: createDefaultHealth(),
    professional: createDefaultProfessional(),
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
      const userId = auth.user?.id ?? 'dev-user'
      localStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(this.health))
      saveAthleteHealthData(userId, this.health)
    },
    async init(payload: PerfilInitPayload = {}) {
      if (this.initialized) return
      this.initialized = true

      const auth = useAuthStore()
      const userId = auth.user?.id ?? 'dev-user'
      const role = (payload.role ?? auth.role ?? 'athlete') as UserRole

      // Read localStorage synchronously first — UI gets data immediately
      const localProfile = readStoredValue<ProfileData | null>(PROFILE_STORAGE_KEY, null)
      if (localProfile) {
        this.profile = { fullName: localProfile.fullName, city: localProfile.city, avatarDataUrl: localProfile.avatarDataUrl }
      } else {
        this.profile = { fullName: payload.fullName?.trim() || 'Atleta Raiz', city: '', avatarDataUrl: null }
      }

      if (role === 'professional') {
        const localPro = readStoredValue<ProfessionalData | null>(PROFESSIONAL_STORAGE_KEY, null)
        if (localPro) {
          this.professional = { specialty: localPro.specialty, bio: localPro.bio, baseHourlyPrice: localPro.baseHourlyPrice }
        }
      }

      this.health = readStoredValue(HEALTH_STORAGE_KEY, createDefaultHealth())

      // Dev mode — done, localStorage has the data
      if (!supabase) return

      // Production mode — sync with Supabase async
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
      const userId = auth.user?.id ?? 'dev-user'
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
      const userId = auth.user?.id ?? 'dev-user'
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
