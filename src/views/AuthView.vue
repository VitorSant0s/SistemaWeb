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
const phone = ref('55')

function formatPhoneBR(value: string): string {
  const d = value.replace(/\D/g, '')
  if (!d || d.length === 0) return '+55'
  if (d.length <= 2) return `+${d}`
  if (d.length <= 4) return `+${d.slice(0, 2)} (${d.slice(2)}`
  if (d.length <= 9) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4)}`
  return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9, 13)}`
}

function onPhoneInput(event: Event) {
  const input = event.target as HTMLInputElement
  let digits = input.value.replace(/\D/g, '')
  if (!digits.startsWith('55')) digits = '55' + digits
  phone.value = digits.slice(0, 13)
  const formatted = formatPhoneBR(phone.value)
  if (input.value !== formatted) input.value = formatted
}
const cip = ref('')
const email = ref('')
const password = ref('')
const remember = ref(true)
const message = ref('')
const loading = ref(false)
const showPassword = ref(false)
const errorDialog = ref(false)
const errorMessage = ref('')

const REMEMBER_EMAIL_KEY = 'saved-email'
const REMEMBER_PASS_KEY = 'saved-password'

function loadSavedCredentials() {
  const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY)
  const savedPass = localStorage.getItem(REMEMBER_PASS_KEY)
  if (savedEmail) {
    email.value = savedEmail
    remember.value = true
  }
  if (savedPass) password.value = savedPass
}

function saveCredentials() {
  if (remember.value) {
    localStorage.setItem(REMEMBER_EMAIL_KEY, email.value)
    localStorage.setItem(REMEMBER_PASS_KEY, password.value)
  } else {
    localStorage.removeItem(REMEMBER_EMAIL_KEY)
    localStorage.removeItem(REMEMBER_PASS_KEY)
  }
}

loadSavedCredentials()

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
  mode.value === 'login' ? 'Bem-vindo de volta' : 'Criar conta',
)

async function submit() {
  loading.value = true
  message.value = ''

  if (mode.value === 'login') {
    const { error } = await auth.signIn(email.value, password.value)
    if (error) {
      errorMessage.value = error.message
      errorDialog.value = true
    } else {
      saveCredentials()
      message.value = remember.value ? 'Login realizado com sucesso.' : 'Sessao iniciada.'
      router.push('/')
    }
  } else {
    const { error } = await auth.signUp(email.value, password.value, profile.value, fullName.value, phone.value, cip.value)
    if (error) {
      message.value = error.message
    } else {
      const { error: loginError } = await auth.signIn(email.value, password.value)
      if (loginError) {
        message.value = loginError.message
      } else {
        message.value = 'Sendo redirecionado para home...'
        setTimeout(() => router.push('/'), 1000)
      }
    }
  }

  loading.value = false
}

function recoverPassword() {
  message.value = 'Recuperacao de senha sera habilitada em breve.'
}

function closeErrorDialog() {
  errorDialog.value = false
}
</script>

<template>
  <section class="auth-view">
    <div class="auth-header">
      <div class="auth-logo">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
          <rect width="36" height="36" rx="10" fill="#d9f2d8"/>
          <path d="M10 18c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8" stroke="#111827" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="18" cy="18" r="3" fill="#111827"/>
        </svg>
        <span class="auth-logo-text">Raiz</span>
      </div>
      <h1 class="auth-heading">{{ title }}</h1>
      <p class="auth-sub">
        {{ mode === 'login' ? 'Acesse sua conta para continuar.' : 'Preencha os dados para se cadastrar.' }}
      </p>
    </div>

    <div class="auth-switch">
      <div class="auth-slider" :class="mode" />
      <button
        :class="{ active: mode === 'login' }"
        @click="mode = 'login'"
      >Login</button>
      <button
        :class="{ active: mode === 'register' }"
        @click="mode = 'register'"
      >Cadastro</button>
    </div>

    <form class="auth-card" @submit.prevent="submit">
      <div v-if="mode === 'register'" class="auth-fld">
        <input id="fullName" v-model="fullName" type="text" placeholder="Nome completo" autocomplete="name" required />
      </div>

      <div v-if="mode === 'register'" class="auth-fld">
        <input id="phone" :value="formatPhoneBR(phone)" @input="onPhoneInput" type="tel" placeholder="+55 (DD) XXXXX-XXXX" autocomplete="tel" />
      </div>

      <div v-if="mode === 'register'" class="auth-fld">
        <select id="profile" v-model="profile">
          <option value="athlete">Atleta</option>
          <option value="professional">Profissional</option>
        </select>
      </div>

      <div v-if="mode === 'register' && profile === 'professional'" class="auth-fld">
        <input id="cip" v-model="cip" type="text" placeholder="CIP (registro profissional)" autocomplete="off" />
      </div>

      <div class="auth-fld">
        <input id="email" v-model="email" type="email" placeholder="Email" autocomplete="email" required />
      </div>

      <div class="auth-fld">
        <div class="auth-pw">
          <input
            id="password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Senha"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            required
          />
          <button
            type="button"
            class="auth-pw-btn"
            @click="showPassword = !showPassword"
            :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
          >
            <svg v-if="showPassword" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>

      <div v-if="mode === 'login'" class="auth-opt">
        <label class="auth-rem">
          <input v-model="remember" type="checkbox" />
          Lembrar
        </label>
        <button type="button" class="auth-link" @click="recoverPassword">Esqueci a senha</button>
      </div>

      <button class="auth-btn" type="submit" :disabled="loading">
        {{ loading ? 'Enviando...' : mode === 'login' ? 'Entrar' : 'Criar conta' }}
      </button>
    </form>

    <Transition name="auth-msg">
      <p v-if="message" class="auth-msg" aria-live="polite">{{ message }}</p>
    </Transition>

    <Transition name="explosion">
      <div v-if="errorDialog" class="explosion-overlay" @click.self="closeErrorDialog">
        <div class="explosion-dialog">
          <div class="explosion-particles">
            <span v-for="i in 12" :key="i" class="particle" :style="{ '--i': i }" />
          </div>
          <div class="explosion-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="#dc2626" stroke-width="3" />
              <path d="M16 16l16 16M32 16l-16 16" stroke="#dc2626" stroke-width="3" stroke-linecap="round" />
            </svg>
          </div>
          <p class="explosion-title">Falha no login</p>
          <p class="explosion-msg">{{ errorMessage }}</p>
          <button class="explosion-btn" @click="closeErrorDialog">OK</button>
        </div>
      </div>
    </Transition>
  </section>
</template>
