export type UserRole = 'athlete' | 'professional'
export type NegotiationStatus = 'open' | 'in_review' | 'accepted' | 'rejected' | 'cancelled'
export type ContractStatus = 'active' | 'completed' | 'cancelled'

export type ProfileRecord = {
  id: string
  fullName: string
  role: UserRole
  city: string | null
  avatarDataUrl: string | null
  createdAt: string
  updatedAt: string
}

export type ProfessionalProfileRecord = {
  id: string
  specialty: string
  bio: string | null
  baseHourlyPrice: number | null
  createdAt: string
}

export type ProfessionalProfileDraft = {
  specialty: string
  bio: string
  baseHourlyPrice: number | null
}

export type ServiceOfferRecord = {
  id: string
  professionalId: string
  title: string
  description: string | null
  basePrice: number | null
  isActive: boolean
  createdAt: string
}

export type ServiceOfferDraft = {
  professionalId: string
  title: string
  description: string | null
  basePrice: number | null
}

export type NegotiationRecord = {
  id: string
  athleteId: string
  professionalId: string
  serviceOfferId: string
  status: NegotiationStatus
  createdAt: string
}

export type NegotiationDraft = {
  athleteId: string
  professionalId: string
  serviceOfferId: string
}

export type ProposalRecord = {
  id: string
  negotiationId: string
  authorId: string
  valueAmount: number
  scope: string
  message: string | null
  dueDays: number | null
  createdAt: string
}

export type ProposalDraft = {
  negotiationId: string
  authorId: string
  valueAmount: number
  scope: string
  message: string | null
  dueDays: number | null
}

export type ContractRecord = {
  id: string
  negotiationId: string
  athleteId: string
  professionalId: string
  finalAmount: number
  status: ContractStatus
  startedAt: string
  finishedAt: string | null
}

export type ContractDraft = {
  negotiationId: string
  athleteId: string
  professionalId: string
  finalAmount: number
}

export const workoutTypes = ['Corrida', 'Musculacao', 'Ciclismo', 'Natacao', 'Yoga', 'Crossfit', 'Outro'] as const

export type WorkoutType = (typeof workoutTypes)[number]

export type Workout = {
  id: string
  athleteId: string
  workoutType: WorkoutType
  distanceKm: number
  durationMin: number
  workoutDate: string
  contractId: string | null
  completed: boolean
  createdAt: string
}

export type WorkoutDraft = {
  workoutType: WorkoutType
  distanceKm: number
  durationMin: number
  workoutDate: string
  contractId: string | null
}

export type DirectoryEntry = {
  id: string
  name: string
  role: UserRole
  specialty?: string
}

export type Message = {
  id: string
  conversationId: string
  senderId: string
  text: string
  createdAt: string
}

export type Conversation = {
  id: string
  participantIds: string[]
  lastMessage: string | null
  lastMessageAt: string
  createdAt: string
}

export type ConversationWithProfile = Conversation & {
  partnerName: string
  partnerRole: UserRole
}

export type ChallengeTemplateType = 'workout_count' | 'running_distance' | 'total_duration' | 'specific_type' | 'completion_rate'

export type DailyChallenge = {
  date: string
  title: string
  description: string
  templateType: ChallengeTemplateType
  target: number
  current: number
  completed: boolean
}

export type ChallengeRating = 'completed' | 'partial' | 'missed'

export type ChallengeFeedback = {
  rating: ChallengeRating
  feedback: string
}

export type ProfessionalWithProfile = DirectoryEntry & {
  specialty: string
  bio: string
  baseHourlyPrice: number | null
  offers: ServiceOfferRecord[]
}

export type NegotiationWithParties = NegotiationRecord & {
  athleteName: string
  professionalName: string
  offerTitle: string
  lastProposal?: ProposalRecord
}

export type ContractWithParties = ContractRecord & {
  athleteName: string
  professionalName: string
  professionalSpecialty: string
}
