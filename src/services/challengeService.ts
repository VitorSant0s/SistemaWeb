import { supabase } from '../lib/supabase'
import type { Workout } from '../types/domain'
import type { DailyChallenge, ChallengeTemplateType, ChallengeFeedback, ChallengeRating } from '../types/domain'

const workoutTypes = ['Corrida', 'Musculacao', 'Ciclismo', 'Natacao', 'Yoga', 'Crossfit', 'Outro'] as const

function dayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function pickTemplate(date: Date): { templateType: ChallengeTemplateType; target: number; meta?: string } {
  const day = dayOfYear(date)
  const index = day % 8
  if (index === 0) return { templateType: 'workout_count', target: 2 }
  if (index === 1) return { templateType: 'running_distance', target: 5 }
  if (index === 2) return { templateType: 'total_duration', target: 45 }
  if (index === 3) return { templateType: 'specific_type', target: 1, meta: workoutTypes[day % workoutTypes.length] }
  if (index === 4) return { templateType: 'workout_count', target: 3 }
  if (index === 5) return { templateType: 'running_distance', target: 3 }
  if (index === 6) return { templateType: 'total_duration', target: 30 }
  return { templateType: 'completion_rate', target: 100 }
}

function buildChallenge(template: ReturnType<typeof pickTemplate>, todayWorkouts: Workout[]): DailyChallenge {
  const date = formatDateKey(new Date())

  let current = 0
  let completed = false
  let title = ''
  let description = ''

  switch (template.templateType) {
    case 'workout_count':
      current = todayWorkouts.length
      completed = current >= template.target
      title = `Complete ${template.target} treinos hoje`
      description = completed
        ? `Voce completou ${current} treinos. Mandou bem!`
        : `Registre ${template.target - current} treino${template.target - current > 1 ? 's' : ''} para completar o desafio.`
      break
    case 'running_distance':
      current = Math.round(todayWorkouts.filter((w) => w.workoutType === 'Corrida').reduce((s, w) => s + w.distanceKm, 0) * 10) / 10
      completed = current >= template.target
      title = `Corra ${template.target} km hoje`
      description = completed
        ? `${current} km percorridos. Otimo trabalho!`
        : `Faltam ${(template.target - current).toFixed(1)} km para completar o desafio.`
      break
    case 'total_duration':
      current = todayWorkouts.reduce((s, w) => s + w.durationMin, 0)
      completed = current >= template.target
      title = `Treine por ${template.target} min hoje`
      description = completed
        ? `${current} minutos de treino. Excelente!`
        : `Faltam ${template.target - current} min para completar o desafio.`
      break
    case 'specific_type': {
      const type = template.meta ?? 'Corrida'
      current = todayWorkouts.filter((w) => w.workoutType === type).length
      completed = current >= template.target
      title = `Faca um treino de ${type} hoje`
      description = completed
        ? `Treino de ${type} registrado. Boa!`
        : `Ainda nao fez ${type} hoje. Que tal agora?`
      break
    }
    case 'completion_rate':
      current = todayWorkouts.length > 0
        ? Math.round((todayWorkouts.filter((w) => w.completed).length / todayWorkouts.length) * 100)
        : 0
      completed = current >= template.target
      title = 'Complete todos os treinos de hoje'
      description = todayWorkouts.length === 0
        ? 'Registre e conclua treinos para completar o desafio.'
        : completed
          ? `${todayWorkouts.filter((w) => w.completed).length}/${todayWorkouts.length} treinos concluidos. Perfeito!`
          : `${todayWorkouts.filter((w) => w.completed).length}/${todayWorkouts.length} treinos concluidos.`
      break
  }

  return { date, title, description, templateType: template.templateType, target: template.target, current, completed }
}

export function generateChallenge(workouts: Workout[]): DailyChallenge {
  const today = new Date()
  const todayKey = formatDateKey(today)
  const todayWorkouts = workouts.filter((w) => w.workoutDate === todayKey)
  const template = pickTemplate(today)
  return buildChallenge(template, todayWorkouts)
}

function getFeedbackKey(athleteId: string, date: string) {
  return `challenge-feedback-${athleteId}-${date}`
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

export async function loadFeedback(athleteId: string, date: string): Promise<ChallengeFeedback | null> {
  if (!supabase) return readStoredValue(getFeedbackKey(athleteId, date), null)

  const { data, error } = await supabase
    .from('daily_challenges')
    .select('rating, feedback')
    .eq('athlete_id', athleteId)
    .eq('date', date)
    .maybeSingle()

  if (error || !data || !data.rating) return readStoredValue(getFeedbackKey(athleteId, date), null)

  return {
    rating: data.rating as ChallengeRating,
    feedback: data.feedback ?? '',
  }
}

export async function saveFeedback(
  athleteId: string,
  date: string,
  feedback: ChallengeFeedback,
): Promise<void> {
  const localKey = getFeedbackKey(athleteId, date)
  localStorage.setItem(localKey, JSON.stringify(feedback))

  if (!supabase) return

  await supabase
    .from('daily_challenges')
    .upsert(
      { athlete_id: athleteId, date, rating: feedback.rating, feedback: feedback.feedback },
      { onConflict: 'athlete_id, date' },
    )
}
