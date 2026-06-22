<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, nextTick, ref, watch } from 'vue'
import type { ExamDraft, HealthExam } from '../stores/perfil'

const props = defineProps<{
  exam: HealthExam | null
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'save', payload: ExamDraft): void
}>()

const title = ref('')
const date = ref(defaultDate())
const imageDataUrl = ref('')
const notes = ref('')
const error = ref('')

const isEditing = computed(() => Boolean(props.exam))
const heading = computed(() => (isEditing.value ? 'Editar exame' : 'Adicionar exame'))

function defaultDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function syncForm() {
  if (!props.exam) {
    title.value = ''
    date.value = defaultDate()
    imageDataUrl.value = ''
    notes.value = ''
    error.value = ''
    return
  }

  title.value = props.exam.title
  date.value = props.exam.date
  imageDataUrl.value = props.exam.imageDataUrl
  notes.value = props.exam.notes
  error.value = ''
}

watch(() => props.exam, syncForm, { immediate: true })

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  nextTick(() => {
    const first = document.querySelector<HTMLElement>('#exam-title')
    first?.focus()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

function close() {
  emit('close')
}

function handleImageChange(event: Event) {
  error.value = ''
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (file.size > 1_500_000) {
    error.value = 'Use uma imagem com ate 1.5 MB para salvar no modo local.'
    input.value = ''
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') imageDataUrl.value = reader.result
  }
  reader.onerror = () => {
    error.value = 'Nao foi possivel carregar a imagem.'
  }
  reader.readAsDataURL(file)
}

function submit() {
  error.value = ''

  if (!title.value.trim()) {
    error.value = 'Informe o titulo do exame.'
    return
  }

  if (!date.value) {
    error.value = 'Informe a data do exame.'
    return
  }

  if (!imageDataUrl.value) {
    error.value = 'Adicione uma imagem do exame.'
    return
  }

  emit('save', {
    title: title.value.trim(),
    date: date.value,
    imageDataUrl: imageDataUrl.value,
    notes: notes.value.trim(),
  })
}
</script>

<template>
  <div class="exam-form-overlay" @click.self="close">
    <section class="exam-form-sheet" role="dialog" aria-modal="true" aria-labelledby="exam-form-title">
      <header class="workout-form-header">
        <div>
          <p class="agenda-kicker">Exame</p>
          <h2 id="exam-form-title">{{ heading }}</h2>
        </div>
        <button class="workout-form-close" type="button" aria-label="Fechar formulario" @click="close">x</button>
      </header>

      <form class="exam-form" @submit.prevent="submit">
        <label for="exam-title">
          Titulo
          <input id="exam-title" v-model="title" type="text" placeholder="Ex: Hemograma, ressonancia, avaliacao" />
        </label>

        <label for="exam-date">
          Data
          <input id="exam-date" v-model="date" type="date" />
        </label>

        <label for="exam-image">
          Imagem do exame
          <input id="exam-image" type="file" accept="image/*" @change="handleImageChange" />
        </label>

        <img v-if="imageDataUrl" class="exam-form-preview" :src="imageDataUrl" alt="Previa do exame" />

        <label for="exam-notes">
          Observacoes
          <textarea id="exam-notes" v-model="notes" rows="4" placeholder="Inclua observacoes importantes para acompanhamento." />
        </label>

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

        <div class="workout-form-actions">
          <button class="btn-ghost" type="button" @click="close">Cancelar</button>
          <button class="btn-primary" type="submit">Salvar exame</button>
        </div>
      </form>
    </section>
  </div>
</template>
