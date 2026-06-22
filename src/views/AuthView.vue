<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

type Mode = 'login' | 'register'
type Profile = 'athlete' | 'professional'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const mode = ref<Mode>('login')
const profile = ref<Profile>('athlete')
const fullName = ref('')
const email = ref('')
const password = ref('')
const remember = ref(true)
const message = ref('')
const loading = ref(false)
const showPassword = ref(false)

watch(
  () => route.query.perfil,
  (value) => {
    if (value === 'professional') {
      mode.value = 'register'
      profile.value = 'professional'
    }
    if (value === 'athlete') {
      mode.value = 'register'
      profile.value = 'athlete'
    }
  },
  { immediate: true },
)

const title = computed(() =>
  mode.value === 'login' ? 'Entre e continue seu plano' : 'Crie sua conta em poucos passos',
)

async function submit() {
  loading.value = true
  message.value = ''

  if (mode.value === 'login') {
    const { error } = await auth.signIn(email.value, password.value, remember.value)
    if (error) {
      message.value = error.message
    } else {
      message.value = remember.value ? 'Login realizado com sucesso.' : 'Sessao iniciada.'
      router.push('/')
    }
  } else {
    const { error } = await auth.signUp(email.value, password.value, profile.value, fullName.value)
    message.value = error
      ? error.message
      : 'Conta criada. Verifique seu email para concluir o cadastro.'
  }

  loading.value = false
}

function recoverPassword() {
  message.value = 'Recuperacao de senha sera habilitada em breve.'
}
</script>

<template>
  <section class="mobile-page auth-page">
    <div class="auth-hero">
      <h1>{{ title }}</h1>
      <p>Login ou cadastro para acessar atletas, profissionais e treinos.</p>
    </div>

    <div class="auth-sheet">
      <div class="segment-control" role="tablist" aria-label="Alternar entre login e cadastro">
        <button
          :class="{ active: mode === 'login' }"
          role="tab"
          :aria-selected="mode === 'login'"
          @click="mode = 'login'"
        >
          Login
        </button>
        <button
          :class="{ active: mode === 'register' }"
          role="tab"
          :aria-selected="mode === 'register'"
          @click="mode = 'register'"
        >
          Cadastro
        </button>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <Transition name="auth-field" mode="out-in">
          <div :key="mode">
            <label v-if="mode === 'register'" for="fullName">
              Nome completo
              <input id="fullName" v-model="fullName" type="text" placeholder="Seu nome" autocomplete="name" required />
            </label>

            <label v-if="mode === 'register'" for="profile">
              Perfil
              <select id="profile" v-model="profile">
                <option value="athlete">Atleta</option>
                <option value="professional">Profissional</option>
              </select>
            </label>

            <label for="email">
              Email
              <input id="email" v-model="email" type="email" placeholder="voce@email.com" autocomplete="email" required />
            </label>

            <label for="password">
              Senha
              <div class="password-field">
                <input
                  id="password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="******"
                  :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
                  required
                />
                <button
                  type="button"
                  class="toggle-password"
                  :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
                  @click="showPassword = !showPassword"
                >
                  {{ showPassword ? 'Ocultar' : 'Mostrar' }}
                </button>
              </div>
            </label>

            <Transition name="auth-field">
              <div v-if="mode === 'login'" key="auth-row" class="auth-row">
                <label class="inline-check">
                  <input v-model="remember" type="checkbox" />
                  Lembrar de mim
                </label>
                <button type="button" class="helper-link" @click="recoverPassword">Esqueci minha senha</button>
              </div>
            </Transition>

            <button class="btn-primary" type="submit" :disabled="loading">
              {{ loading ? 'Enviando...' : mode === 'login' ? 'Entrar' : 'Criar conta' }}
            </button>
          </div>
        </Transition>
      </form>

      <Transition name="auth-msg">
        <p v-if="message" class="feedback" aria-live="polite">{{ message }}</p>
      </Transition>
    </div>
  </section>
</template>
