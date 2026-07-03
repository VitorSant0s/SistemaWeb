<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, nextTick, ref, watch } from 'vue'
import { workoutTypes } from '../stores/agenda'
import { useNegociacaoStore } from '../stores/negociacao'
import type { Workout, WorkoutDraft, WorkoutType } from '../stores/agenda'

const props = defineProps<{
  workout: Workout | null
  selectedDate: string
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'save', payload: WorkoutDraft): void
}>()

const negociacao = useNegociacaoStore()
negociacao.init()

const workoutType = ref<WorkoutType>('Corrida')
const distanceKm = ref(5)
const durationMin = ref(40)
const workoutDate = ref(props.selectedDate)
const selectedContractId = ref<string | null>(null)
const error = ref('')

const isEditing = computed(() => Boolean(props.workout))
const title = computed(() => (isEditing.value ? 'Editar treino' : 'Novo treino'))

const activeContracts = computed(() => negociacao.contractsWithParties.filter((c) => c.status === 'active'))

function syncForm() {
  if (!props.workout) {
    workoutType.value = 'Corrida'
    distanceKm.value = 5
    durationMin.value = 40
    workoutDate.value = props.selectedDate
    selectedContractId.value = null
    error.value = ''
    return
  }

  workoutType.value = props.workout.workoutType
  distanceKm.value = props.workout.distanceKm
  durationMin.value = props.workout.durationMin
  workoutDate.value = props.workout.workoutDate
  selectedContractId.value = props.workout.contractId
  error.value = ''
}

watch(() => props.workout, syncForm, { immediate: true })
watch(
  () => props.selectedDate,
  (date) => {
    if (!props.workout) workoutDate.value = date
  },
)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  nextTick(() => {
    const first = document.querySelector<HTMLElement>('#workout-type')
    first?.focus()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

function close() {
  emit('close')
}

function submit() {
  error.value = ''

  if (!workoutDate.value) {
    error.value = 'Escolha uma data para o treino.'
    return
  }

  if (durationMin.value <= 0) {
    error.value = 'Informe uma duracao maior que zero.'
    return
  }

  if (distanceKm.value < 0) {
    error.value = 'A distancia nao pode ser negativa.'
    return
  }

  emit('save', {
    workoutType: workoutType.value,
    distanceKm: Number(distanceKm.value),
    durationMin: Number(durationMin.value),
    workoutDate: workoutDate.value,
    contractId: selectedContractId.value,
  })
}
</script>

<template>
  <div class="workout-form-overlay" @click.self="close">
    <section class="workout-form-sheet" role="dialog" aria-modal="true" aria-labelledby="workout-form-title">
      <header class="workout-form-header">
        <div>
          <p class="agenda-kicker">Treino</p>
          <h2 id="workout-form-title">{{ title }}</h2>
        </div>
        <button class="workout-form-close" type="button" aria-label="Fechar formulario" @click="close">x</button>
      </header>

      <form class="workout-form" @submit.prevent="submit">
        <label for="workout-type">
          Tipo de treino
          <select id="workout-type" v-model="workoutType">
            <option v-for="type in workoutTypes" :key="type" :value="type">{{ type }}</option>
          </select>
        </label>

        <div class="workout-form-row">
          <label for="workout-distance">
            Distancia (km)
            <input id="workout-distance" v-model.number="distanceKm" type="number" min="0" step="0.1" inputmode="decimal" />
          </label>

          <label for="workout-duration">
            Duracao (min)
            <input id="workout-duration" v-model.number="durationMin" type="number" min="1" step="1" inputmode="numeric" />
          </label>
        </div>

        <label for="workout-date">
          Data
          <input id="workout-date" v-model="workoutDate" type="date" required />
        </label>

        <label for="workout-contract">
          Acompanhamento profissional
          <select id="workout-contract" v-model="selectedContractId">
            <option :value="null">Treino livre (sem acompanhamento)</option>
            <option v-for="c in activeContracts" :key="c.id" :value="c.id">
              {{ c.professionalName }} — {{ c.professionalSpecialty }}
            </option>
          </select>
        </label>

        <p v-if="!activeContracts.length" class="workout-form-helper">
          Nenhum contrato ativo. Vincule treinos a contratos para receber acompanhamento profissional.
        </p>

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

        <div class="workout-form-actions">
          <button class="btn-ghost" type="button" @click="close">Cancelar</button>
          <button class="btn-primary" type="submit">{{ isEditing ? 'Salvar alteracoes' : 'Criar treino' }}</button>
        </div>
      </form>
    </section>
  </div>
</template>
