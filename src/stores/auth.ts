import { defineStore } from 'pinia'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type Role = 'athlete' | 'professional'
type AuthResult = { error: { message: string } | null }

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
      if (role === 'athlete' || role === 'professional') {
        return role
      }
      return null
    },
  },
  actions: {
    async init() {
      if (!supabase) {
        this.loading = false
        return
      }

      const { data } = await supabase.auth.getSession()
      this.session = data.session
      this.user = data.session?.user ?? null
      this.loading = false

      supabase.auth.onAuthStateChange((_event, session) => {
        this.session = session
        this.user = session?.user ?? null
      })
    },
    async signIn(email: string, password: string) {
      if (!supabase) {
        return { error: { message: 'Supabase desativado no ambiente de desenvolvimento.' } } as AuthResult
      }
      return supabase.auth.signInWithPassword({ email, password })
    },
    async signUp(email: string, password: string, role: Role, fullName: string) {
      if (!supabase) {
        return { error: { message: 'Supabase desativado no ambiente de desenvolvimento.' } } as AuthResult
      }
      return supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            full_name: fullName,
          },
        },
      })
    },
    async signOut() {
      if (!supabase) return
      await supabase.auth.signOut()
    },
  },
})
