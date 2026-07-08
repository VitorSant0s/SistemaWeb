import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const isEnabled = Boolean(supabaseUrl && supabaseAnonKey)

if (!isEnabled) {
  console.warn('Supabase desabilitado: VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY nao configurados')
}

export const supabase = isEnabled
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
