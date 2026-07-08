import { supabase } from '../lib/supabase'
import type { ProfessionalProfileDraft, ProfessionalProfileRecord, ProfileRecord, UserRole } from '../types/domain'

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

export async function loadProfile(params: LoadProfileParams): Promise<ProfileRecord> {
  if (!supabase) return { id: params.userId, fullName: params.fullName?.trim() || 'Atleta Raiz', role: params.role, city: null, avatarDataUrl: null, createdAt: now(), updatedAt: now() }
  const { data, error } = await supabase.from('profiles').select('*').eq('id', params.userId).maybeSingle()

  if (error) {
    return {
      id: params.userId,
      fullName: params.fullName?.trim() || 'Atleta Raiz',
      role: params.role,
      city: null,
      avatarDataUrl: null,
      createdAt: now(),
      updatedAt: now(),
    }
  }

  if (data) return mapProfileRow(data as ProfileRow)

  const fallbackName = params.fullName?.trim() || 'Atleta Raiz'
  const { data: inserted } = await supabase
    .from('profiles')
    .upsert({ id: params.userId, full_name: fallbackName, role: params.role })
    .select('*')
    .single()

  if (!inserted) {
    return {
      id: params.userId,
      fullName: fallbackName,
      role: params.role,
      city: null,
      avatarDataUrl: null,
      createdAt: now(),
      updatedAt: now(),
    }
  }
  return mapProfileRow(inserted as ProfileRow)
}

export async function saveProfile(profile: ProfileRecord): Promise<ProfileRecord> {
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
  if (!supabase) return { id: userId, specialty: 'Especialista esportivo', bio: 'Conte sua abordagem, metodologia e quais atletas voce acompanha.', baseHourlyPrice: null, createdAt: now() }
  const { data, error } = await supabase.from('professional_profiles').select('*').eq('id', userId).maybeSingle()

  if (error) {
    return {
      id: userId,
      specialty: 'Especialista esportivo',
      bio: 'Conte sua abordagem, metodologia e quais atletas voce acompanha.',
      baseHourlyPrice: null,
      createdAt: now(),
    }
  }

  if (data) return mapProfessionalRow(data as ProfessionalProfileRow)

  const { data: inserted } = await supabase
    .from('professional_profiles')
    .upsert({ id: userId, specialty: 'Especialista esportivo' })
    .select('*')
    .single()

  if (!inserted) {
    return {
      id: userId,
      specialty: 'Especialista esportivo',
      bio: 'Conte sua abordagem, metodologia e quais atletas voce acompanha.',
      baseHourlyPrice: null,
      createdAt: now(),
    }
  }
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
  if (!supabase) return
  if (!currentUrl) return
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
  if (!supabase) return { id: userId, specialty: draft.specialty, bio: draft.bio, baseHourlyPrice: draft.baseHourlyPrice, createdAt: now() }
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

  if (error || !data) {
    return {
      id: userId,
      specialty: draft.specialty,
      bio: draft.bio,
      baseHourlyPrice: draft.baseHourlyPrice,
      createdAt: now(),
    }
  }
  return mapProfessionalRow(data as ProfessionalProfileRow)
}