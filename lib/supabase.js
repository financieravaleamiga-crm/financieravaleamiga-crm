import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || supabaseUrl.includes('your-project')) {
  console.error('ERROR: VITE_SUPABASE_URL no está configurada correctamente en .env.local')
}

if (!supabaseAnonKey || supabaseAnonKey.includes('your-anon-key')) {
  console.error('ERROR: VITE_SUPABASE_ANON_KEY no está configurada correctamente en .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
