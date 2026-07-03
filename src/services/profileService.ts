import { supabase } from '../lib/supabase'
import type { ProfessionalProfileDraft, ProfessionalProfileRecord, ProfileRecord, UserRole } from '../types/domain'

const PROFILE_STORAGE_KEY = 'perfil-profile'
const PROFESSIONAL_STORAGE_KEY = 'perfil-professional'

type StoredProfile = {
  fullName: string
  city: string
  avatarDataUrl: string | null
}

type StoredProfessional = {
  specialty: string
  bio: string
  baseHourlyPrice: number | null
}

type ProfileRow = {
  id: string
  full_name: string
  role: UserRole
  city: string | null
  avatar_data_url: string | null
  created_at: string
  updated_at: string
}

type ProfessionalProfileRow = {
  id: string
  specialty: string
  bio: string | null
  base_hourly_price: number | string | null
  created_at: string
}

type LoadProfileParams = {
  userId: string
  role: UserRole
  fullName?: string
}

function now() {
  return new Date().toISOString()
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

function defaultStoredProfile(fullName?: string): StoredProfile {
  return {
    fullName: fullName?.trim() || 'Atleta Raiz',
    city: '',
    avatarDataUrl: null,
  }
}

function defaultStoredProfessional(): StoredProfessional {
  return {
    specialty: 'Especialista esportivo',
    bio: 'Conte sua abordagem, metodologia e quais atletas voce acompanha.',
    baseHourlyPrice: null,
  }
}

function localProfile(params: LoadProfileParams): ProfileRecord {
  const stored = readStoredValue(PROFILE_STORAGE_KEY, defaultStoredProfile(params.fullName))
  return {
    id: params.userId,
    fullName: stored.fullName,
    role: params.role,
    city: stored.city || null,
    avatarDataUrl: stored.avatarDataUrl,
    createdAt: now(),
    updatedAt: now(),
  }
}

function saveLocalProfile(profile: ProfileRecord) {
  const stored: StoredProfile = {
    fullName: profile.fullName,
    city: profile.city ?? '',
    avatarDataUrl: profile.avatarDataUrl,
  }
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(stored))
}

function mapProfileRow(row: ProfileRow, fallbackAvatar: string | null = null): ProfileRecord {
  return {
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    city: row.city,
    avatarDataUrl: row.avatar_data_url ?? fallbackAvatar,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapProfessionalRow(row: ProfessionalProfileRow): ProfessionalProfileRecord {
  return {
    id: row.id,
    specialty: row.specialty,
    bio: row.bio,
    baseHourlyPrice: row.base_hourly_price === null ? null : Number(row.base_hourly_price),
    createdAt: row.created_at,
  }
}

function localProfessional(userId: string): ProfessionalProfileRecord {
  const stored = readStoredValue(PROFESSIONAL_STORAGE_KEY, defaultStoredProfessional())
  return {
    id: userId,
    specialty: stored.specialty,
    bio: stored.bio,
    baseHourlyPrice: stored.baseHourlyPrice,
    createdAt: now(),
  }
}

function saveLocalProfessional(professional: ProfessionalProfileRecord) {
  const stored: StoredProfessional = {
    specialty: professional.specialty,
    bio: professional.bio ?? '',
    baseHourlyPrice: professional.baseHourlyPrice,
  }
  localStorage.setItem(PROFESSIONAL_STORAGE_KEY, JSON.stringify(stored))
}

export async function loadProfile(params: LoadProfileParams): Promise<ProfileRecord> {
  const localAvatar = readStoredValue(PROFILE_STORAGE_KEY, defaultStoredProfile(params.fullName)).avatarDataUrl

  if (!supabase) return localProfile(params)

  const { data, error } = await supabase.from('profiles').select('*').eq('id', params.userId).maybeSingle()

  if (error) return localProfile(params)


  if (data) return mapProfileRow(data as ProfileRow, localAvatar)

  const fallbackName = params.fullName?.trim() || 'Atleta Raiz'
  const { data: inserted } = await supabase
    .from('profiles')
    .upsert({ id: params.userId, full_name: fallbackName, role: params.role, avatar_data_url: localAvatar })
    .select('*')
    .single()

  if (!inserted) return localProfile(params)
  return mapProfileRow(inserted as ProfileRow, localAvatar)
}

export async function saveProfile(profile: ProfileRecord): Promise<ProfileRecord> {
  saveLocalProfile(profile)

  if (!supabase) return profile

  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: profile.fullName,
      city: profile.city,
      avatar_data_url: profile.avatarDataUrl,
      updated_at: now(),
    })
    .eq('id', profile.id)
    .select('*')
    .single()

  if (error || !data) return profile
  return mapProfileRow(data as ProfileRow, profile.avatarDataUrl)
}

export async function loadProfessionalProfile(userId: string): Promise<ProfessionalProfileRecord> {
  if (!supabase) return localProfessional(userId)

  const { data, error } = await supabase.from('professional_profiles').select('*').eq('id', userId).maybeSingle()

  if (error) return localProfessional(userId)
  if (data) return mapProfessionalRow(data as ProfessionalProfileRow)

  const { data: inserted } = await supabase
    .from('professional_profiles')
    .upsert({ id: userId, specialty: 'Especialista esportivo' })
    .select('*')
    .single()

  if (!inserted) return localProfessional(userId)
  return mapProfessionalRow(inserted as ProfessionalProfileRow)
}

export async function uploadExamImage(athleteId: string, examId: string, file: File): Promise<string | null> {
  if (!supabase) return null

  const fileExt = file.name.split('.').pop() || 'jpg'
  const filePath = `${athleteId}/${examId}.${fileExt}`

  const { error: uploadError } = await supabase.storage.from('exam-images').upload(filePath, file, { upsert: true })
  if (uploadError) {
    console.error('Erro ao enviar imagem para o storage', uploadError)
    return null
  }

  const { data: urlData } = supabase.storage.from('exam-images').getPublicUrl(filePath)
  return urlData.publicUrl
}

export async function deleteExamImage(athleteId: string, currentUrl: string | null) {
  if (!supabase || !currentUrl) return
  if (!currentUrl.includes('supabase.co')) return

  const urlPath = currentUrl.split('/').pop()
  if (!urlPath) return

  const filePath = `${athleteId}/${urlPath}`
  await supabase.storage.from('exam-images').remove([filePath])
}

export function saveAthleteHealthData(athleteId: string, healthData: unknown) {
  localStorage.setItem(`athlete-health-${athleteId}`, JSON.stringify(healthData))
}

export function loadAthleteHealthData(athleteId: string): unknown | null {
  const raw = localStorage.getItem(`athlete-health-${athleteId}`)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    localStorage.removeItem(`athlete-health-${athleteId}`)
    return null
  }
}

export async function saveProfessionalProfile(
  userId: string,
  draft: ProfessionalProfileDraft,
): Promise<ProfessionalProfileRecord> {
  const fallback: ProfessionalProfileRecord = {
    id: userId,
    specialty: draft.specialty,
    bio: draft.bio,
    baseHourlyPrice: draft.baseHourlyPrice,
    createdAt: now(),
  }
  saveLocalProfessional(fallback)

  if (!supabase) return fallback

  const { data, error } = await supabase
    .from('professional_profiles')
    .upsert({
      id: userId,
      specialty: draft.specialty,
      bio: draft.bio,
      base_hourly_price: draft.baseHourlyPrice,
    })
    .select('*')
    .single()

  if (error || !data) return fallback
  return mapProfessionalRow(data as ProfessionalProfileRow)
}
