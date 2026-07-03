import { supabase } from '../lib/supabase'
import { loadOffers } from './offerService'
import type { ProfessionalWithProfile } from '../types/domain'

const DIRECTORY_KEY = 'messages-directory'
const SEED_KEY = 'pro-dir-seeded'

type DirectoryEntryRaw = {
  id: string
  name: string
  role: string
  specialty?: string
}

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

function professionalDirectory(): DirectoryEntryRaw[] {
  return readStoredValue<DirectoryEntryRaw[]>(DIRECTORY_KEY, []).filter((e) => e.role === 'professional')
}

async function ensureMockData() {
  if (!import.meta.env.DEV) return
  if (localStorage.getItem(SEED_KEY)) return
  localStorage.setItem(SEED_KEY, 'true')

  const seeds: Array<{
    id: string
    specialty: string
    bio: string
    price: number
    offers: Array<{ title: string; description: string; price: number }>
  }> = [
    {
      id: 'mock-pro-1',
      specialty: 'Fisioterapia esportiva',
      bio: 'Fisioterapeuta especializada em reabilitacao e prevencao de lesoes esportivas. Atendo atletas de corrida, futebol e crossfit ha mais de 10 anos.',
      price: 120,
      offers: [
        { title: 'Avaliacao postural completa', description: 'Analise detalhada da postura e identificacao de desequilibrios musculares.', price: 150 },
        { title: 'Sessao de reabilitacao', description: 'Acompanhamento individual para recuperacao de lesoes.', price: 100 },
      ],
    },
    {
      id: 'mock-pro-2',
      specialty: 'Preparacao fisica',
      bio: 'Preparador fisico com foco em periodizacao de treinos para corrida e ciclismo. Metodologia baseada em evidencia cientifica.',
      price: 90,
      offers: [
        { title: 'Periodizacao de treinos', description: 'Plano de treinos personalizado com periodizacao mensal.', price: 200 },
        { title: 'Avaliacao de desempenho', description: 'Testes de condicionamento fisico e analise de performance.', price: 80 },
      ],
    },
    {
      id: 'mock-pro-3',
      specialty: 'Nutricao esportiva',
      bio: 'Nutricionista esportiva com experiencia em planejamento alimentar para atletas de endurance, emagrecimento e ganho de massa magra.',
      price: 100,
      offers: [
        { title: 'Plano alimentar personalizado', description: 'Dieta elaborada sob medida para seus objetivos e rotina de treinos.', price: 180 },
        { title: 'Acompanhamento nutricional', description: 'Consultas regulares para ajuste do plano e monitoramento de resultados.', price: 90 },
      ],
    },
  ]

  const dir: DirectoryEntryRaw[] = []
  for (const seed of seeds) {
    const nameMap: Record<string, string> = { 'mock-pro-1': 'Dra. Carla Mendes', 'mock-pro-2': 'Prof. Ricardo Oliveira', 'mock-pro-3': 'Ana Costa' }
    dir.push({ id: seed.id, name: nameMap[seed.id] ?? 'Profissional', role: 'professional', specialty: seed.specialty })
    const record = {
      id: seed.id,
      specialty: seed.specialty,
      bio: seed.bio,
      baseHourlyPrice: seed.price,
      createdAt: new Date().toISOString(),
    }
    localStorage.setItem(`pro-profile-${seed.id}`, JSON.stringify(record))

    for (const offer of seed.offers) {
      await createOfferLocal(seed.id, offer)
    }
  }
  localStorage.setItem(DIRECTORY_KEY, JSON.stringify(dir))
}

import type { ServiceOfferRecord } from '../types/domain'

async function createOfferLocal(professionalId: string, offer: { title: string; description: string; price: number }) {
  const offers: ServiceOfferRecord[] = readStoredValue('service-offers', [])
  offers.push({
    id: `offer-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    professionalId,
    title: offer.title,
    description: offer.description,
    basePrice: offer.price,
    isActive: true,
    createdAt: new Date().toISOString(),
  })
  localStorage.setItem('service-offers', JSON.stringify(offers))
}

function loadLocalProfessionalProfile(id: string) {
  const raw = localStorage.getItem(`pro-profile-${id}`)
  if (!raw) return { id, specialty: '', bio: '', baseHourlyPrice: null, createdAt: '' }
  return JSON.parse(raw)
}

type ProfileRow = { id: string; full_name: string; role: string }
type ProProfileRow = { id: string; specialty: string; bio: string | null; base_hourly_price: number | null }

export async function listProfessionals(): Promise<ProfessionalWithProfile[]> {
  if (supabase) {
    const [profilesRes, proProfilesRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role').eq('role', 'professional'),
      supabase.from('professional_profiles').select('*'),
    ])

    if (!profilesRes.error && profilesRes.data) {
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

      // Cache directory in localStorage
      const dir: DirectoryEntryRaw[] = results.map((r) => ({
        id: r.id, name: r.name, role: r.role, specialty: r.specialty,
      }))
      localStorage.setItem(DIRECTORY_KEY, JSON.stringify(dir))

      return results
    }
  }

  // Fallback to localStorage
  await ensureMockData()

  const entries = professionalDirectory()
  const result: ProfessionalWithProfile[] = []

  for (const entry of entries) {
    const profile = loadLocalProfessionalProfile(entry.id)
    const offers = await loadOffers(entry.id)

    result.push({
      id: entry.id,
      name: entry.name,
      role: 'professional',
      specialty: profile.specialty || entry.specialty || '',
      bio: profile.bio || '',
      baseHourlyPrice: profile.baseHourlyPrice,
      offers,
    })
  }

  return result
}

export async function getProfessionalProfile(id: string): Promise<ProfessionalWithProfile | null> {
  if (supabase) {
    const [profileRes, proRes, offers] = await Promise.all([
      supabase.from('profiles').select('id, full_name').eq('id', id).maybeSingle(),
      supabase.from('professional_profiles').select('*').eq('id', id).maybeSingle(),
      loadOffers(id),
    ])

    if (!profileRes.error && profileRes.data) {
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
  }

  // Fallback to localStorage
  await ensureMockData()

  const entry = professionalDirectory().find((e) => e.id === id)
  if (!entry) return null

  const profile = loadLocalProfessionalProfile(id)
  const offers = await loadOffers(id)

  return {
    id: entry.id,
    name: entry.name,
    role: 'professional',
    specialty: profile.specialty || entry.specialty || '',
    bio: profile.bio || '',
    baseHourlyPrice: profile.baseHourlyPrice,
    offers,
  }
}
