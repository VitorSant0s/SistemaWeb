import { defineStore } from 'pinia'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type Role = 'athlete' | 'professional'

const STORAGE_KEY = 'raiz_sb_session'

function saveToStorage(session: Session | null) {
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      user: session.user,
    }))
    console.log('[AuthStore] Sessao salva no localStorage')
  } else {
    localStorage.removeItem(STORAGE_KEY)
    console.log('[AuthStore] Sessao removida do localStorage')
  }
}

function loadFromStorage(): { access_token: string; refresh_token: string; user: User } | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.access_token && parsed?.user) return parsed
  } catch {}
  return null
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    session: null as Session | null,
    loading: true,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user),
    role: (state): Role | null => {
      const role = state.user?.user_metadata?.role
      if (role === 'athlete' || role === 'professional') return role
      return null
    },
  },
  actions: {
    async init() {
      console.log('[Auth] init() iniciado')
      if (!supabase) {
        console.warn('[Auth] Supabase nao disponivel')
        this.loading = false
        return
      }
      try {
        const { data } = await supabase.auth.getSession()
        console.log('[Auth] getSession retornou:', data.session ? 'sessao encontrada' : 'sem sessao')
        if (data.session) {
          this.session = data.session
          this.user = data.session.user
          saveToStorage(data.session)
          this.loading = false
          return
        }
      } catch (e) {
        console.error('[Auth] getSession lancou excecao:', e)
      }

      const stored = loadFromStorage()
      if (stored) {
        console.log('[Auth] Tentando setSession com dados do localStorage')
        try {
          const { data } = await supabase.auth.setSession({
            access_token: stored.access_token,
            refresh_token: stored.refresh_token,
          })
          if (data.session) {
            console.log('[Auth] setSession bem-sucedido via localStorage')
            this.session = data.session
            this.user = data.session.user
          } else {
            console.warn('[Auth] setSession retornou sem sessao — token pode ter expirado')
            localStorage.removeItem(STORAGE_KEY)
          }
        } catch (e) {
          console.error('[Auth] setSession lancou excecao:', e)
          localStorage.removeItem(STORAGE_KEY)
        }
      } else {
        console.log('[Auth] Nenhum dado salvo no localStorage')
      }

      this.loading = false
      console.log('[Auth] init() finalizado. user:', !!this.user)

      supabase.auth.onAuthStateChange((event, session) => {
        console.log('[Auth] onAuthStateChange:', event, !!session)
        this.session = session
        this.user = session?.user ?? null
        if (session) {
          saveToStorage(session)
        } else {
          saveToStorage(null)
        }
      })
    },

    async signIn(email: string, password: string) {
      console.log('[Auth] signIn chamado para:', email)
      if (!supabase) throw new Error('Supabase nao disponivel')
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error && data?.session) {
        console.log('[Auth] signIn bem-sucedido')
        this.session = data.session
        this.user = data.session.user
        saveToStorage(data.session)
      } else {
        console.warn('[Auth] signIn falhou:', error?.message)
      }
      return { data, error }
    },

    async signUp(email: string, password: string, role: Role, fullName: string, phone?: string, cip?: string) {
      console.log('[Auth] signUp chamado para:', email)
      if (!supabase) throw new Error('Supabase nao disponivel')
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            full_name: fullName,
            phone: phone || '',
            cip: cip || '',
          },
        },
      })
      if (!error && data?.session) {
        console.log('[Auth] signUp bem-sucedido')
        this.session = data.session
        this.user = data.session.user
        saveToStorage(data.session)
      } else {
        console.warn('[Auth] signUp falhou:', error?.message)
      }
      return { data, error }
    },

    async signOut() {
      console.log('[Auth] signOut chamado')
      if (!supabase) return { error: null }
      const { error } = await supabase.auth.signOut()
      if (!error) {
        this.session = null
        this.user = null
        saveToStorage(null)
        console.log('[Auth] signOut concluido')
      } else {
        console.warn('[Auth] signOut falhou:', error?.message)
      }
      return { error }
    },
  },
})
