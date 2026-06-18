import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey || url.includes('YOUR-PROJECT-REF')) {
  // Surfaces a clear error in the browser console instead of a cryptic
  // network failure if someone forgets to fill in .env.
  console.error(
    'Supabase is not configured. Copy .env.example to .env and fill in ' +
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project (Settings -> API).'
  )
}

export const supabase = createClient(url, anonKey)
