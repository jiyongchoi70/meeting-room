import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

let supabase: SupabaseClient
try {
  supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder')
} catch {
  supabase = createClient('https://placeholder.supabase.co', 'placeholder')
}

export { supabase }
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
