import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const anonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  ''
).trim()

export const SUPABASE_URL = url
export const isSupabaseConfigured = Boolean(url && anonKey)

// Google and GitHub both require this exact value to be allowlisted in the
// Supabase dashboard, so derive it from the current origin.
export const AUTH_CALLBACK_PATH = '/auth/callback'
export const authCallbackUrl = `${window.location.origin}${AUTH_CALLBACK_PATH}`

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null

// Throws rather than returning null so a missing .env surfaces as a readable
// error instead of a null dereference deep in a component.
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env, then restart the dev server.'
    )
  }
  return supabase
}
