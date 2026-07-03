import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseEnabled) {
  console.warn('Supabase disabled: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY not found.')
}

export const supabase = isSupabaseEnabled ? createClient(supabaseUrl, supabaseAnonKey) : null
