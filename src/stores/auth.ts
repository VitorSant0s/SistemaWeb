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
        const raw = localStorage.getItem('dev-auth-user')
        if (raw) {
          try {
            this.user = JSON.parse(raw) as User
          } catch {
            localStorage.removeItem('dev-auth-user')
          }
        }
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
    async signIn(email: string, password: string, remember = true) {
      if (!supabase) {
        // Local fallback: accept anything and create a lightweight user.
        const fakeUser = {
          id: 'dev-user',
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          app_metadata: { provider: 'dev', providers: ['dev'] },
          user_metadata: {
            role: 'athlete',
            full_name: email.split('@')[0] || 'Dev User',
          },
          email,
        } as unknown as User

        this.user = fakeUser
        this.session = null

        if (remember) {
          localStorage.setItem('dev-auth-user', JSON.stringify(fakeUser))
        } else {
          localStorage.removeItem('dev-auth-user')
        }

        return { error: null } as AuthResult
      }

      return supabase.auth.signInWithPassword({ email, password })
    },
    async signUp(email: string, password: string, role: Role, fullName: string) {
      if (!supabase) {
        // Local fallback: just create a local user and consider it "registered".
        const fakeUser = {
          id: 'dev-user',
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          app_metadata: { provider: 'dev', providers: ['dev'] },
          user_metadata: { role, full_name: fullName },
          email,
        } as unknown as User

        this.user = fakeUser
        this.session = null
        localStorage.setItem('dev-auth-user', JSON.stringify(fakeUser))

        return { error: null } as AuthResult
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
      if (!supabase) {
        this.user = null
        this.session = null
        localStorage.removeItem('dev-auth-user')
        return
      }

      await supabase.auth.signOut()
    },
  },
})
