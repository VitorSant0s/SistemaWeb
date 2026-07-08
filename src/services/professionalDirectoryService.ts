import { supabase } from '../lib/supabase'
import { loadOffers } from './offerService'
import type { ProfessionalWithProfile } from '../types/domain'

const DIRECTORY_KEY = 'messages-directory'

type DirectoryEntryRaw = {
  id: string
  name: string
  role: string
  specialty?: string
}

type ProfileRow = { id: string; full_name: string; role: string }
type ProProfileRow = { id: string; specialty: string; bio: string | null; base_hourly_price: number | null }

export async function listProfessionals(): Promise<ProfessionalWithProfile[]> {
  if (!supabase) {
    const raw = localStorage.getItem(DIRECTORY_KEY)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw) as DirectoryEntryRaw[]
      return parsed.map((e) => ({
        id: e.id,
        name: e.name,
        role: 'professional' as const,
        specialty: e.specialty ?? '',
        bio: '',
        baseHourlyPrice: null,
        offers: [],
      }))
    } catch {
      return []
    }
  }
  const [profilesRes, proProfilesRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role').eq('role', 'professional'),
    supabase.from('professional_profiles').select('*'),
  ])

  if (profilesRes.error || !profilesRes.data) return []

  const profiles = profilesRes.data as ProfileRow[]
  const proProfiles = (proProfilesRes.data as ProProfileRow[]) ?? []
  const proMap = new Map(proProfiles.map((p) => [p.id, p]))

  const results: ProfessionalWithProfile[] = []
  for (const profile of profiles) {
    const pro = proMap.get(profile.id)
    const offers = await loadOffers(profile.id)
    results.push({
      id: profile.id,
      name: profile.full_name,
      role: 'professional',
      specialty: pro?.specialty ?? '',
      bio: pro?.bio ?? '',
      baseHourlyPrice: pro?.base_hourly_price ?? null,
      offers,
    })
  }

  const dir: DirectoryEntryRaw[] = results.map((r) => ({
    id: r.id, name: r.name, role: r.role, specialty: r.specialty,
  }))
  localStorage.setItem(DIRECTORY_KEY, JSON.stringify(dir))

  return results
}

export async function getProfessionalProfile(id: string): Promise<ProfessionalWithProfile | null> {
  if (!supabase) return null
  const [profileRes, proRes, offers] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('id', id).maybeSingle(),
    supabase.from('professional_profiles').select('*').eq('id', id).maybeSingle(),
    loadOffers(id),
  ])

  if (profileRes.error || !profileRes.data) return null

  const p = profileRes.data as { id: string; full_name: string }
  const pro = proRes.data as ProProfileRow | null

  return {
    id: p.id,
    name: p.full_name,
    role: 'professional',
    specialty: pro?.specialty ?? '',
    bio: pro?.bio ?? '',
    baseHourlyPrice: pro?.base_hourly_price ?? null,
    offers,
  }
}