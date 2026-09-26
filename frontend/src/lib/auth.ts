import type { Provider, Session, User } from '@supabase/supabase-js'
import { authCallbackUrl, requireSupabase, supabase } from './supabase'

export type OAuthProvider = 'google' | 'github'

export interface AuthProfile {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  provider: string
  created_at?: string | null
  confirmed_at?: string | null
}

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  last_used_at: string | null
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

export interface SearchHistoryItem {
  id: number
  query: string
  domain: string | null
  result_count: number
  response_ms: number | null
  created_at: string
}

export interface CrawlRunItem {
  id: string
  target: string
  host: string | null
  status: string
  progress: number
  pages_found: number
  pages_stored: number
  message: string
  error: string | null
  created_at: string
  finished_at: string | null
}

export interface AuthConfig {
  configured: boolean
  missing: string[]
  url: string
  storage_ready: boolean
  credential_encryption: boolean
  providers: string[]
  scopes: string[]
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

function messageOf(error: { message: string } | null, fallback: string): string {
  return error?.message || fallback
}

function displayName(user: User): string {
  const metadata = user.user_metadata ?? {}
  return (
    metadata.full_name ||
    metadata.name ||
    metadata.preferred_username ||
    (user.email ? user.email.split('@')[0] : 'Account')
  )
}

export function profileFromUser(user: User): AuthProfile {
  const metadata = user.user_metadata ?? {}
  return {
    id: user.id,
    email: user.email ?? '',
    full_name: displayName(user),
    avatar_url: metadata.avatar_url || metadata.picture || null,
    provider: user.app_metadata?.provider ?? 'email',
  }
}

export function profileFromSession(session: Session | null): AuthProfile | null {
  return session?.user ? profileFromUser(session.user) : null
}

export function getSession(): Promise<Session | null> {
  if (!supabase) return Promise.resolve(null)
  return supabase.auth.getSession().then(({ data }) => data.session)
}

export function onAuthStateChange(
  handler: (session: Session | null) => void
): () => void {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => handler(session))
  return () => data.subscription.unsubscribe()
}

export interface SignUpInput {
  email: string
  password: string
  fullName?: string
  emailRedirectTo?: string
}

export type SignUpResult =
  | { status: 'signed-in' }
  | { status: 'confirmation-required'; email: string }

export async function signUp({
  email,
  password,
  fullName,
  emailRedirectTo,
}: SignUpInput): Promise<SignUpResult> {
  const client = requireSupabase()
  const { data, error } = await client.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: fullName?.trim() ? { full_name: fullName.trim() } : undefined,
      emailRedirectTo: emailRedirectTo ?? authCallbackUrl,
    },
  })
  if (error) throw new AuthError(messageOf(error, 'Could not create that account'))

  if (!data.session) {
    return {
      status: 'confirmation-required',
      email: email.trim().toLowerCase(),
    }
  }
  return { status: 'signed-in' }
}

export async function signIn(email: string, password: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error) throw new AuthError(messageOf(error, 'Could not sign in'))
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw new AuthError(messageOf(error, 'Could not sign out'))
}

export async function resendConfirmation(email: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: authCallbackUrl },
  })
  if (error) throw new AuthError(messageOf(error, 'Could not resend the confirmation email'))
}

export async function requestPasswordReset(email: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: authCallbackUrl,
  })
  if (error) throw new AuthError(messageOf(error, 'Could not send the reset email'))
}

export async function updatePassword(password: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.auth.updateUser({ password })
  if (error) throw new AuthError(messageOf(error, 'Could not update the password'))
}

export async function updateProfileName(fullName: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.auth.updateUser({ data: { full_name: fullName.trim() } })
  if (error) throw new AuthError(messageOf(error, 'Could not update the profile'))
  await syncProfile({ full_name: fullName.trim() })
}

export async function signInWithProvider(
  provider: OAuthProvider,
  options: { redirectTo?: string } = {}
): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.auth.signInWithOAuth({
    provider: provider as Provider,
    options: {
      redirectTo: options.redirectTo ?? authCallbackUrl,
      scopes: provider === 'google' ? 'profile email' : 'read:user user:email',
    },
  })
  if (error) throw new AuthError(messageOf(error, `Could not sign in with ${provider}`))
}

// `detectSessionInUrl` has usually already exchanged the code by the time
// this runs, but not on every path, so handle the raw `code` too.
export async function consumeAuthCallback(): Promise<AuthError | null> {
  if (!supabase) {
    return new AuthError('Supabase is not configured. Check frontend/.env.')
  }
  const params = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))

  const oauthError = params.get('error_description') || hash.get('error_description')
  if (oauthError) return new AuthError(oauthError)

  if (hash.get('error_code') === 'otp_expired' || params.get('error_code') === 'otp_expired') {
    return new AuthError('That sign-in link has expired. Request a new one.')
  }

  const code = params.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return new AuthError(messageOf(error, 'Could not complete sign in'))
    return null
  }

  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    return new AuthError('No session was returned. Start the sign-in again.')
  }
  return null
}

export function isRecoveryLink(): boolean {
  const params = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return (
    hash.get('type') === 'recovery' ||
    params.get('type') === 'recovery' ||
    hash.get('error_code') === 'otp_expired' ||
    params.get('error_code') === 'otp_expired'
  )
}

function accessToken(): Promise<string | null> {
  if (!supabase) return Promise.resolve(null)
  return supabase.auth
    .getSession()
    .then(({ data }) => data.session?.access_token ?? null)
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken()
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(path, { ...init, headers })
  if (!response.ok) {
    throw new AuthError(await readError(response))
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json()
    if (typeof body?.detail === 'string') return body.detail
  } catch {
  }
  return `Request failed (${response.status})`
}

export function getAuthConfig(): Promise<AuthConfig> {
  return apiFetch<AuthConfig>('/api/auth/config')
}

export async function fetchProfile(): Promise<AuthProfile | null> {
  try {
    const { user } = await apiFetch<{ user: AuthProfile }>('/api/me')
    return user
  } catch {
    // A missing migration should not break the page; the session has enough
    // to render.
    return null
  }
}

async function syncProfile(values: Record<string, unknown>): Promise<void> {
  try {
    await apiFetch('/api/me', { method: 'PATCH', body: JSON.stringify(values) })
  } catch {
  }
}

export function fetchApiKeys(): Promise<{ items: ApiKey[] }> {
  return apiFetch<{ items: ApiKey[] }>('/api/me/api-keys')
}

export function fetchHistory(limit = 25): Promise<{ items: SearchHistoryItem[] }> {
  return apiFetch<{ items: SearchHistoryItem[] }>(`/api/me/history?limit=${limit}`)
}

export function fetchCrawlRuns(limit = 25): Promise<{ items: CrawlRunItem[] }> {
  return apiFetch<{ items: CrawlRunItem[] }>(`/api/me/crawls?limit=${limit}`)
}

export interface CreatedApiKey extends ApiKey {
  /** Returned exactly once; the server keeps only a hash. */
  key: string
}

export function createApiKey(
  name: string,
  scopes: string[]
): Promise<{ item: CreatedApiKey; key: string; warning: string }> {
  return apiFetch('/api/me/api-keys', {
    method: 'POST',
    body: JSON.stringify({ name, scopes }),
  })
}

export function revokeApiKey(id: string): Promise<{ status: string }> {
  return apiFetch(`/api/me/api-keys/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
