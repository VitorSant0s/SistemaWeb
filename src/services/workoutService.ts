import { supabase } from '../lib/supabase'
import type { Workout, WorkoutDraft, WorkoutType } from '../types/domain'

type WorkoutRow = {
  id: string
  athlete_id: string
  workout_type: string
  distance_km: number | string
  duration_min: number
  workout_date: string
  contract_id: string | null
  completed?: boolean
  created_at: string
}

function isWorkoutType(value: string): value is WorkoutType {
  return ['Corrida', 'Musculacao', 'Ciclismo', 'Natacao', 'Yoga', 'Crossfit', 'Outro'].includes(value)
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
    completed: row.completed ?? false,
    createdAt: row.created_at,
  }
}

export async function loadWorkouts(athleteId: string): Promise<Workout[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('workouts').select('*').eq('athlete_id', athleteId)
  if (error || !data) return []
  return sortWorkouts((data as WorkoutRow[]).map((row) => mapWorkoutRow(row)))
}

export async function createWorkout(athleteId: string, draft: WorkoutDraft): Promise<Workout> {
  if (!supabase) throw new Error('Falha ao criar treino')
  const { data, error } = await supabase
    .from('workouts')
    .insert({
      athlete_id: athleteId,
      workout_type: draft.workoutType,
      distance_km: draft.distanceKm,
      duration_min: draft.durationMin,
      workout_date: draft.workoutDate,
      contract_id: validUuid(draft.contractId),
    })
    .select('id, athlete_id, workout_type, distance_km, duration_min, workout_date, contract_id, created_at')
    .single()

  if (error) {
    console.error('[workoutService] createWorkout error:', error)
    throw new Error(`Falha ao criar treino: ${error.message}`)
  }
  if (!data) throw new Error('Falha ao criar treino: dados nao retornados')
  return mapWorkoutRow(data as WorkoutRow)
}

export async function updateWorkout(id: string, draft: WorkoutDraft): Promise<Workout | null> {
  if (!supabase) return null
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

export async function deleteWorkout(id: string) {
  if (!supabase) return
  await supabase.from('workouts').delete().eq('id', id)
}

export async function loadAthleteWorkouts(athleteId: string): Promise<Workout[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('workouts').select('*').eq('athlete_id', athleteId)
  if (error || !data) return []
  return sortWorkouts((data as WorkoutRow[]).map((row) => mapWorkoutRow(row)))
}

export async function createAthleteWorkout(athleteId: string, draft: WorkoutDraft): Promise<Workout> {
  if (!supabase) throw new Error('Falha ao criar treino')
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

  if (error || !data) throw new Error('Falha ao criar treino')
  return mapWorkoutRow(data as WorkoutRow)
}

export async function toggleWorkoutCompleted(workout: Workout): Promise<Workout> {
  if (!supabase) return { ...workout, completed: !workout.completed }
  const updated = { ...workout, completed: !workout.completed }
  await supabase.from('workouts').update({ completed: updated.completed }).eq('id', workout.id)
  return updated
}