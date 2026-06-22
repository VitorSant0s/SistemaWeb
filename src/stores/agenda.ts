import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { loadWorkouts, createWorkout, updateWorkout, deleteWorkout, toggleWorkoutCompleted } from '../services/workoutService'
import type { Workout, WorkoutDraft, WorkoutType } from '../types/domain'

export type { Workout, WorkoutDraft, WorkoutType }
export { workoutTypes } from '../types/domain'

type AgendaState = {
  workouts: Workout[]
  selectedDate: string
  currentYear: number
  currentMonth: number
  initialized: boolean
}

export function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getAthleteId(): string {
  try {
    const auth = useAuthStore()
    return auth.user?.id ?? 'dev-user'
  } catch {
    return 'dev-user'
  }
}

export const useAgendaStore = defineStore('agenda', {
  state: (): AgendaState => {
    const today = new Date()
    return {
      workouts: [],
      selectedDate: formatDateKey(today),
      currentYear: today.getFullYear(),
      currentMonth: today.getMonth(),
      initialized: false,
    }
  },
  getters: {
    workoutsForDate: (state) => (date: string) => state.workouts.filter((workout) => workout.workoutDate === date),
    workoutsForMonth: (state) => (year: number, month: number) => {
      const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
      return state.workouts.filter((workout) => workout.workoutDate.startsWith(monthPrefix))
    },
    historyWorkouts: (state) => [...state.workouts].sort((first, second) => second.workoutDate.localeCompare(first.workoutDate)),
    contractWorkouts: (state) => state.workouts.filter((workout) => Boolean(workout.contractId)),
    stats: (state) => {
      const completed = state.workouts.filter((workout) => workout.completed)
      const totalDistance = state.workouts.reduce((total, workout) => total + workout.distanceKm, 0)
      const totalDuration = state.workouts.reduce((total, workout) => total + workout.durationMin, 0)
      return {
        totalWorkouts: state.workouts.length,
        completedWorkouts: completed.length,
        totalDistance,
        totalDuration,
      }
    },
  },
  actions: {
    async init() {
      if (this.initialized) return
      this.initialized = true
      this.workouts = await loadWorkouts(getAthleteId())
    },
    selectDate(date: string) {
      this.selectedDate = date
    },
    goToToday() {
      const today = new Date()
      this.selectedDate = formatDateKey(today)
      this.currentYear = today.getFullYear()
      this.currentMonth = today.getMonth()
    },
    previousMonth() {
      const date = new Date(this.currentYear, this.currentMonth - 1, 1)
      this.currentYear = date.getFullYear()
      this.currentMonth = date.getMonth()
    },
    nextMonth() {
      const date = new Date(this.currentYear, this.currentMonth + 1, 1)
      this.currentYear = date.getFullYear()
      this.currentMonth = date.getMonth()
    },
    async addWorkout(draft: WorkoutDraft) {
      const workout = await createWorkout(getAthleteId(), draft)
      this.workouts.push(workout)
      this.selectedDate = workout.workoutDate
      return workout
    },
    async updateWorkout(id: string, draft: WorkoutDraft) {
      const updated = await updateWorkout(id, draft, getAthleteId())
      if (updated) {
        this.workouts = this.workouts.map((workout) => (workout.id === id ? updated : workout))
        this.selectedDate = draft.workoutDate
      }
    },
    async deleteWorkout(id: string) {
      await deleteWorkout(id, getAthleteId())
      this.workouts = this.workouts.filter((workout) => workout.id !== id)
    },
    async toggleCompleted(id: string) {
      const workout = this.workouts.find((w) => w.id === id)
      if (!workout) return
      const updated = await toggleWorkoutCompleted(workout, getAthleteId())
      this.workouts = this.workouts.map((w) => (w.id === id ? updated : w))
    },
  },
})
