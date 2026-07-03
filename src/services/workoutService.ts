import { supabase } from '../lib/supabase'
import type { Workout, WorkoutDraft, WorkoutType } from '../types/domain'

const WORKOUT_STORAGE_KEY = 'agenda-workouts'

type WorkoutRow = {
  id: string
  athlete_id: string
  workout_type: string
  distance_km: number | string
  duration_min: number
  workout_date: string
  contract_id: string | null
  completed: boolean
  created_at: string
}

function createWorkoutId() {
  if ('randomUUID' in crypto) return crypto.randomUUID()
  return `workout-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function dateInCurrentMonth(day: number) {
  const today = new Date()
  const safeDay = Math.min(day, daysInMonth(today.getFullYear(), today.getMonth()))
  return formatDateKey(new Date(today.getFullYear(), today.getMonth(), safeDay))
}

function isWorkoutType(value: string): value is WorkoutType {
  return ['Corrida', 'Musculacao', 'Ciclismo', 'Natacao', 'Yoga', 'Crossfit', 'Outro'].includes(value)
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

function sortWorkouts(workouts: Workout[]) {
  return [...workouts].sort((first, second) => {
    const dateOrder = first.workoutDate.localeCompare(second.workoutDate)
    if (dateOrder !== 0) return dateOrder
    return first.createdAt.localeCompare(second.createdAt)
  })
}

function validUuid(value: string | null) {
  if (!value) return null
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidPattern.test(value) ? value : null
}

function mapWorkoutRow(row: WorkoutRow): Workout {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    workoutType: isWorkoutType(row.workout_type) ? row.workout_type : 'Outro',
    distanceKm: Number(row.distance_km),
    durationMin: row.duration_min,
    workoutDate: row.workout_date,
    contractId: row.contract_id,
    completed: Boolean(row.completed),
    createdAt: row.created_at,
  }
}

function createMockWorkouts(athleteId: string): Workout[] {
  const now = new Date().toISOString()
  const seeds: Array<Omit<Workout, 'id' | 'athleteId' | 'createdAt'>> = [
    {
      workoutType: 'Corrida',
      distanceKm: 5,
      durationMin: 32,
      workoutDate: dateInCurrentMonth(5),
      contractId: null,
      completed: true,
    },
    {
      workoutType: 'Musculacao',
      distanceKm: 0,
      durationMin: 55,
      workoutDate: dateInCurrentMonth(8),
      contractId: 'mock-contract-forca',
      completed: true,
    },
    {
      workoutType: 'Ciclismo',
      distanceKm: 18,
      durationMin: 64,
      workoutDate: dateInCurrentMonth(12),
      contractId: null,
      completed: false,
    },
    {
      workoutType: 'Corrida',
      distanceKm: 8.2,
      durationMin: 47,
      workoutDate: dateInCurrentMonth(15),
      contractId: 'mock-contract-run',
      completed: false,
    },
    {
      workoutType: 'Natacao',
      distanceKm: 1.4,
      durationMin: 38,
      workoutDate: dateInCurrentMonth(18),
      contractId: null,
      completed: true,
    },
    {
      workoutType: 'Yoga',
      distanceKm: 0,
      durationMin: 30,
      workoutDate: dateInCurrentMonth(22),
      contractId: null,
      completed: false,
    },
    {
      workoutType: 'Crossfit',
      distanceKm: 0,
      durationMin: 42,
      workoutDate: dateInCurrentMonth(25),
      contractId: 'mock-contract-forca',
      completed: false,
    },
    {
      workoutType: 'Corrida',
      distanceKm: 10,
      durationMin: 58,
      workoutDate: dateInCurrentMonth(28),
      contractId: null,
      completed: false,
    },
  ]

  return sortWorkouts(
    seeds.map((seed, index) => ({
      ...seed,
      id: `mock-workout-${index + 1}`,
      athleteId,
      createdAt: now,
    })),
  )
}

function loadAllLocalWorkouts(): Workout[] {
  const stored = readStoredValue<Workout[] | null>(WORKOUT_STORAGE_KEY, null)
  if (stored && Array.isArray(stored)) return sortWorkouts(stored)
  return []
}

function saveLocalWorkouts(workouts: Workout[]) {
  localStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify(sortWorkouts(workouts)))
}

function loadLocalWorkouts(athleteId: string) {
  const all = loadAllLocalWorkouts()
  if (all.length > 0) return all

  const seeded = createMockWorkouts(athleteId)
  saveLocalWorkouts(seeded)
  return seeded
}

export async function loadWorkouts(athleteId: string): Promise<Workout[]> {
  if (!supabase) return loadLocalWorkouts(athleteId)

  const { data, error } = await supabase.from('workouts').select('*').eq('athlete_id', athleteId)
  if (error || !data) return loadLocalWorkouts(athleteId)

  const mapped = sortWorkouts((data as WorkoutRow[]).map((row) => mapWorkoutRow(row)))
  saveLocalWorkouts(mapped) // cache
  return mapped
}

export async function createWorkout(athleteId: string, draft: WorkoutDraft): Promise<Workout> {
  if (!supabase) {
    const workout: Workout = {
      ...draft,
      id: createWorkoutId(),
      athleteId,
      completed: false,
      createdAt: new Date().toISOString(),
    }
    saveLocalWorkouts([...loadLocalWorkouts(athleteId), workout])
    return workout
  }

  const { data, error } = await supabase
    .from('workouts')
    .insert({
      athlete_id: athleteId,
      workout_type: draft.workoutType,
      distance_km: draft.distanceKm,
      duration_min: draft.durationMin,
      workout_date: draft.workoutDate,
      contract_id: validUuid(draft.contractId),
      completed: false,
    })
    .select('*')
    .single()

  if (error || !data) return createWorkout(athleteId, { ...draft, contractId: null })
  return mapWorkoutRow(data as WorkoutRow)
}

export async function updateWorkout(id: string, draft: WorkoutDraft, athleteId: string): Promise<Workout | null> {
  if (!supabase) {
    const workouts = loadLocalWorkouts(athleteId)
    const updated = workouts.map((workout) => (workout.id === id ? { ...workout, ...draft } : workout))
    saveLocalWorkouts(updated)
    return updated.find((workout) => workout.id === id) ?? null
  }

  const { data, error } = await supabase
    .from('workouts')
    .update({
      workout_type: draft.workoutType,
      distance_km: draft.distanceKm,
      duration_min: draft.durationMin,
      workout_date: draft.workoutDate,
      contract_id: validUuid(draft.contractId),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) return null
  return mapWorkoutRow(data as WorkoutRow)
}

export async function deleteWorkout(id: string, athleteId: string) {
  if (!supabase) {
    saveLocalWorkouts(loadLocalWorkouts(athleteId).filter((workout) => workout.id !== id))
    return
  }

  await supabase.from('workouts').delete().eq('id', id)
}

export async function loadAthleteWorkouts(athleteId: string): Promise<Workout[]> {
  if (!supabase) {
    const all = loadAllLocalWorkouts()
    return sortWorkouts(all.filter((w) => w.athleteId === athleteId))
  }

  const { data, error } = await supabase.from('workouts').select('*').eq('athlete_id', athleteId)
  if (error || !data) return []

  const mapped = sortWorkouts((data as WorkoutRow[]).map((row) => mapWorkoutRow(row)))
  saveLocalWorkouts(mapped) // cache
  return mapped
}

export async function createAthleteWorkout(athleteId: string, draft: WorkoutDraft): Promise<Workout> {
  if (!supabase) {
    const workout: Workout = {
      ...draft,
      id: createWorkoutId(),
      athleteId,
      completed: false,
      createdAt: new Date().toISOString(),
    }
    saveLocalWorkouts([...loadAllLocalWorkouts(), workout])
    return workout
  }

  const { data, error } = await supabase
    .from('workouts')
    .insert({
      athlete_id: athleteId,
      workout_type: draft.workoutType,
      distance_km: draft.distanceKm,
      duration_min: draft.durationMin,
      workout_date: draft.workoutDate,
      contract_id: validUuid(draft.contractId),
      completed: false,
    })
    .select('*')
    .single()

  if (error || !data) return createAthleteWorkout(athleteId, { ...draft, contractId: null })
  return mapWorkoutRow(data as WorkoutRow)
}

export async function toggleWorkoutCompleted(workout: Workout, athleteId: string): Promise<Workout> {
  const updated = { ...workout, completed: !workout.completed }

  if (!supabase) {
    saveLocalWorkouts(
      loadLocalWorkouts(athleteId).map((storedWorkout) => (storedWorkout.id === workout.id ? updated : storedWorkout)),
    )
    return updated
  }

  await supabase.from('workouts').update({ completed: updated.completed }).eq('id', workout.id)
  return updated
}
