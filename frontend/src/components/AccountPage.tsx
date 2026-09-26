import { FormEvent, useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  Clock,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  Moon,
  Plus,
  Search,
  Sun,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { useAppStore } from '../store'
import { FlameMark } from './FlameMark'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  AuthError,
  apiFetch,
  createApiKey,
  fetchApiKeys,
  fetchHistory,
  fetchCrawlRuns,
  isRecoveryLink,
  requestPasswordReset,
  resendConfirmation,
  revokeApiKey,
  signIn,
  signInWithProvider,
  signUp,
  updateProfileName,
  type ApiKey,
  type CrawlRunItem,
  type OAuthProvider,
  type SearchHistoryItem,
} from '../lib/auth'
import { formatDistanceToNow } from 'date-fns'

type Mode = 'signin' | 'signup' | 'account'

const OAUTH_LABELS: Record<OAuthProvider, string> = {
  google: 'Google',
  github: 'GitHub',
}

export function AccountPage({ mode }: { mode: Mode }) {
  const { user, isAuthReady } = useAppStore()

  if (mode === 'account') {
    if (!isAuthReady) return <AccountSkeleton />
    if (!user) {
      return (
        <AuthShell title="You are not signed in">
          <a
            href="/signin"
            className="mt-2 inline-block w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm text-center transition-colors"
          >
            Sign in
          </a>
        </AuthShell>
      )
    }
    return <AccountDashboard />
  }

  return <CredentialsForm key={mode} mode={mode} />
}

function AccountDashboard() {
  const { user, signOut, isDarkMode, toggleDarkMode } = useAppStore()
  const [signingOut, setSigningOut] = useState(false)
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [history, setHistory] = useState<SearchHistoryItem[]>([])
  const [crawls, setCrawls] = useState<CrawlRunItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    // allSettled so one failed panel does not blank the whole page.
    const [keysResult, historyResult, crawlsResult] = await Promise.allSettled([
      fetchApiKeys(),
      fetchHistory(10),
      fetchCrawlRuns(10),
    ])
    if (keysResult.status === 'fulfilled') setKeys(keysResult.value.items)
    if (historyResult.status === 'fulfilled') setHistory(historyResult.value.items)
    if (crawlsResult.status === 'fulfilled') setCrawls(crawlsResult.value.items)
    const failure = [keysResult, historyResult, crawlsResult].find(
      (r) => r.status === 'rejected'
    )
    if (failure && failure.status === 'rejected') {
      const reason = failure.reason
      setError(
        reason instanceof AuthError
          ? reason.message
          : 'Could not load your data from Supabase.'
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      window.location.href = '/'
    } catch {
      setSigningOut(false)
    }
  }

  const displayName = user?.full_name || user?.email || 'Account'

  return (
    <div className="min-h-screen relative bg-[#fafafa] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.12]"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 pt-6 flex items-center justify-between">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Back to search
        </a>
        <button
          onClick={toggleDarkMode}
          type="button"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white/70 dark:bg-zinc-900/70 backdrop-blur-sm transition-colors"
        >
          {isDarkMode ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          {isDarkMode ? 'Light' : 'Dark'}
        </button>
      </div>

      <main className="relative z-10 w-full max-w-4xl mx-auto px-4 py-8 flex-1">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-4">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="size-12 rounded-xl object-cover border border-zinc-200 dark:border-zinc-800"
                />
              ) : (
                <div className="size-12 rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold text-lg border border-violet-500/20">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-violet-600 dark:text-violet-400">
                  {providerLabel(user?.provider)}
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  Welcome, {displayName}
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/playground?endpoint=crawl"
                className="px-3.5 py-2 text-xs font-medium rounded-lg bg-violet-600 hover:bg-violet-700 text-white shadow-sm shadow-violet-500/20 transition-colors"
              >
                Open Playground
              </a>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors disabled:opacity-60"
              >
                <LogOut className="size-3.5" /> {signingOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </div>

          {error && (
            <p className="mt-5 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
              <TriangleAlert className="size-4 shrink-0 mt-px" />
              <span>{error}</span>
            </p>
          )}

          <NameEditor />
          <ApiKeyPanel keys={keys} onChange={load} />
          <CredentialsPanel onChange={load} />

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <HistorySection
              title="Recent search queries"
              items={history.map((item) => ({
                label: item.query,
                href: `/?q=${encodeURIComponent(item.query)}`,
              }))}
              icon={Search}
              loading={loading}
              empty="Searches you run while signed in are stored in Supabase."
            />
            <HistorySection
              title="Crawl runs"
              items={crawls.map((run) => ({
                label: run.target,
                href: `/playground?endpoint=crawl&url=${encodeURIComponent(run.target)}`,
              }))}
              icon={Clock}
              loading={loading}
              empty="Crawls started from the playground appear here."
            />
          </div>
        </div>
      </main>
    </div>
  )
}

function providerLabel(provider?: string): string {
  if (provider === 'google') return 'Google account'
  if (provider === 'github') return 'GitHub account'
  return 'Workspace'
}

function NameEditor() {
  const { user } = useAppStore()
  const [name, setName] = useState(user?.full_name ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setState('saving')
    try {
      await updateProfileName(name)
      setState('saved')
      setTimeout(() => setState('idle'), 2000)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save your name')
      setState('error')
    }
  }

  return (
    <form onSubmit={save} className="mt-6 flex flex-col sm:flex-row sm:items-end gap-3">
      <div className="flex-1">
        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
          Display name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-colors"
        />
      </div>
      <button
        type="submit"
        disabled={state === 'saving' || !name.trim()}
        className="px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors disabled:opacity-60"
      >
        {state === 'saving' ? 'Saving...' : 'Save name'}
      </button>
      {state === 'saved' && <span className="text-xs text-emerald-600 dark:text-emerald-400 self-center">Saved</span>}
      {state === 'error' && <span className="text-xs text-red-600 dark:text-red-400 self-center">{message}</span>}
    </form>
  )
}

function ApiKeyPanel({ keys, onChange }: { keys: ApiKey[]; onChange: () => void }) {
  const [revealed, setRevealed] = useState<{ name: string; key: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = keys.filter((k) => !k.revoked_at)

  async function generate() {
    setBusy(true)
    setError('')
    try {
      const { item, key } = await createApiKey('default', ['search', 'crawl'])
      setRevealed({ name: item.name, key })
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a key')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    setBusy(true)
    setError('')
    try {
      await revokeApiKey(id)
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke the key')
    } finally {
      setBusy(false)
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text)
  }

  return (
    <section className="mt-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-2.5">
          <KeyRound className="size-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Developer API keys</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Send as <code className="text-[11px]">X-API-Key</code>. Only a SHA-256 hash is stored, so
              a key cannot be shown twice.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-60"
        >
          <Plus className="size-3.5" /> New key
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>}

      {revealed && (
        <div className="mt-4 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            Copy this key now. Once you close this, it is unrecoverable.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-2 text-[11px] font-mono">
              {revealed.key}
            </code>
            <button
              type="button"
              onClick={() => copy(revealed.key)}
              className="p-2 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              aria-label="Copy key"
            >
              <Copy className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setRevealed(null)}
              className="px-2 py-1.5 text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {active.length === 0 ? (
        <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
          No keys yet. Create one to call the API from a script or agent.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {active.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3 bg-zinc-50/50 dark:bg-zinc-950/50">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{item.name}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate">
                  {item.key_prefix}...
                </p>
              </div>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 shrink-0">
                {item.last_used_at
                  ? `used ${formatDistanceToNow(new Date(item.last_used_at), { addSuffix: true })}`
                  : 'never used'}
              </span>
              <button
                type="button"
                onClick={() => revoke(item.id)}
                disabled={busy}
                className="p-1.5 rounded text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-60"
                aria-label={`Revoke ${item.name}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

interface StoredCredential {
  id: string
  label: string
  provider: string | null
  username: string | null
  updated_at: string
}

function CredentialsPanel({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<StoredCredential[]>([])
  const [label, setLabel] = useState('')
  const [secret, setSecret] = useState('')
  const [revealed, setRevealed] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<{ items: StoredCredential[] }>('/api/me/credentials')
      setItems(result.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load credentials')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await apiFetch('/api/me/credentials', {
        method: 'POST',
        body: JSON.stringify({ label: label.trim(), secret }),
      })
      setLabel('')
      setSecret('')
      await load()
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the credential')
    } finally {
      setBusy(false)
    }
  }

  async function reveal(id: string) {
    setBusy(true)
    try {
      const { secret: value } = await apiFetch<{ secret: string }>(
        `/api/me/credentials/${id}/secret`
      )
      setRevealed(value)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not decrypt the credential')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    try {
      await apiFetch(`/api/me/credentials/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the credential')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Stored credentials</h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
        Third-party secrets encrypted with pgcrypto inside Postgres. The passphrase never
        leaves the server.
      </p>

      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      {revealed && (
        <div className="mt-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
          <code className="block text-[11px] font-mono break-all">{revealed}</code>
          <button
            type="button"
            onClick={() => setRevealed(null)}
            className="mt-2 text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          >
            Hide
          </button>
        </div>
      )}

      {items.length > 0 && (
        <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3 bg-zinc-50/50 dark:bg-zinc-950/50">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{item.label}</p>
                {item.username && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{item.username}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => reveal(item.id)}
                disabled={busy}
                className="text-[11px] text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400 disabled:opacity-60"
              >
                Reveal
              </button>
              <button
                type="button"
                onClick={() => remove(item.id)}
                disabled={busy}
                className="p-1.5 rounded text-zinc-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-60"
                aria-label={`Delete ${item.label}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={save} className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label, e.g. github PAT"
          required
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
        />
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Secret value"
          required
          autoComplete="off"
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
        />
        <button
          type="submit"
          disabled={busy}
          className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors disabled:opacity-60"
        >
          Save
        </button>
      </form>
    </section>
  )
}

type FormStatus = 'idle' | 'submitting' | 'notice' | 'error'

function CredentialsForm({ mode }: { mode: 'signin' | 'signup' }) {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>(mode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState<FormStatus>('idle')
  const [message, setMessage] = useState('')
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null)
  const [forgotMode, setForgotMode] = useState(false)

  useEffect(() => {
    setActiveTab(mode)
  }, [mode])

  useEffect(() => {
    if (isRecoveryLink()) window.location.replace('/auth/callback')
  }, [])

  const isSignUp = activeTab === 'signup'
  const configured = isSupabaseConfigured

  function handleTabChange(tab: 'signin' | 'signup') {
    setActiveTab(tab)
    setStatus('idle')
    setMessage('')
    setForgotMode(false)
    window.history.replaceState({}, '', tab === 'signup' ? '/signup' : '/signin')
  }

  function report(error: unknown) {
    setStatus('error')
    setMessage(error instanceof Error ? error.message : 'Something went wrong. Try again.')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setStatus('submitting')
    setMessage('')
    try {
      if (forgotMode) {
        await requestPasswordReset(email)
        setStatus('notice')
        setMessage(`If ${email.trim().toLowerCase()} has an account, a reset link is on its way.`)
        return
      }
      if (isSignUp) {
        if (password.length < 8) {
          setStatus('error')
          setMessage('Use at least 8 characters.')
          return
        }
        const result = await signUp({ email, password, fullName: name })
        if (result.status === 'confirmation-required') {
          setStatus('notice')
          setMessage(
            `Check ${result.email} for a confirmation link, then come back and sign in.`
          )
          return
        }
      } else {
        await signIn(email, password)
      }
      window.location.href = '/account'
    } catch (error) {
      report(error)
    }
  }

  async function handleResend(event: FormEvent) {
    event.preventDefault()
    try {
      await resendConfirmation(email)
      setStatus('notice')
      setMessage('Confirmation email sent. Check your inbox.')
    } catch (error) {
      report(error)
    }
  }

  async function handleOAuth(provider: OAuthProvider) {
    setOauthBusy(provider)
    try {
      await signInWithProvider(provider)
      // On success the browser is already navigating away.
    } catch (error) {
      report(error)
      setOauthBusy(null)
    }
  }

  if (!configured) {
    return (
      <AuthShell title="Supabase is not configured">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Add these to <code className="text-xs">frontend/.env</code>, then restart the dev server:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3 text-[11px] font-mono">
{`VITE_SUPABASE_URL=https://iobihxckllduufthmybi.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_yrzcjhcqBOitHalJhYuAAw_d_Wkw3E3`}
        </pre>
        <a
          href="/"
          className="mt-5 inline-block text-xs text-violet-600 dark:text-violet-400 hover:underline"
        >
          Back to search
        </a>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div className="relative border border-zinc-200 dark:border-zinc-800 bg-[#fafafa] dark:bg-[#09090b] px-6 py-8 flex flex-col items-center justify-center transition-colors">
        <Crosshair position="top-left" />
        <Crosshair position="top-right" />
        <Crosshair position="bottom-left" />
        <Crosshair position="bottom-right" />
        <a href="/" className="inline-flex items-center gap-2.5 group">
          <span className="text-violet-600 dark:text-violet-400 transition-transform group-hover:scale-105 duration-200">
            <FlameMark className="size-8" />
          </span>
          <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            WebCrawler
          </span>
        </a>
      </div>

      <div className="relative border-x border-y border-zinc-200 dark:border-zinc-800 bg-[#fafafa] dark:bg-[#09090b] grid grid-cols-2 p-1 transition-colors">
        {(['signin', 'signup'] as const).map((tab) => (
          <div
            key={tab}
            className={`flex items-center justify-center p-1.5 ${
              tab === 'signup' ? 'border-l border-zinc-200 dark:border-zinc-800' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => handleTabChange(tab)}
              className={`w-full py-2.5 text-sm font-medium rounded-lg transition-all duration-150 ${
                activeTab === tab
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/80 dark:border-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              {tab === 'signin' ? 'Log In' : 'Sign Up'}
            </button>
          </div>
        ))}
      </div>

      <div className="relative border-x border-b border-zinc-200 dark:border-zinc-800 bg-[#fafafa] dark:bg-[#09090b] px-6 py-7 sm:px-8 transition-colors">
        <Crosshair position="bottom-left" />
        <Crosshair position="bottom-right" />

        <form onSubmit={handleSubmit} className="space-y-4">
          {forgotMode ? (
            <>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Enter your email and we will send a link to set a new password.
              </p>
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  autoComplete="email"
                  className={inputClass}
                />
              </Field>
              <button type="submit" disabled={busy(status)} className={primaryClass}>
                {status === 'submitting' ? 'Sending...' : 'Send reset link'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgotMode(false)
                  setStatus('idle')
                  setMessage('')
                }}
                className="w-full text-[11px] text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400"
              >
                Back to log in
              </button>
            </>
          ) : (
            <>
              {isSignUp && (
                <Field label="Name">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className={inputClass}
                    autoComplete="name"
                  />
                </Field>
              )}

              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className={inputClass}
                  autoComplete="email"
                />
              </Field>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Password
                  </label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => {
                        setForgotMode(true)
                        setStatus('idle')
                        setMessage('')
                      }}
                      className="text-[11px] text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isSignUp ? 'At least 8 characters' : '••••••••'}
                    required
                    minLength={isSignUp ? 8 : undefined}
                    className={`${inputClass} pr-10`}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={busy(status)} className={`${primaryClass} mt-2`}>
                {status === 'submitting' && <Loader2 className="size-4 animate-spin" />}
                {isSignUp ? 'Create Account' : 'Log In'}
              </button>
            </>
          )}

          {message && (
            <div
              className={`rounded-lg border px-3 py-2.5 text-xs ${
                status === 'error'
                  ? 'border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300'
                  : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {message}
              {status === 'notice' && isSignUp && (
                <button
                  type="button"
                  onClick={handleResend}
                  className="mt-1.5 block underline underline-offset-2"
                >
                  Resend confirmation email
                </button>
              )}
            </div>
          )}
        </form>

        {!forgotMode && (
          <div className="mt-5 space-y-2.5">
            {(['google', 'github'] as const).map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => handleOAuth(provider)}
                disabled={oauthBusy !== null}
                className="w-full py-2.5 px-4 rounded-full bg-black text-white hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border dark:border-zinc-800 transition-colors flex items-center justify-center relative text-sm font-medium disabled:opacity-60"
              >
                <span className="absolute left-4 flex items-center">
                  {oauthBusy === provider ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : provider === 'google' ? (
                    <GoogleIcon />
                  ) : (
                    <GitHubIcon />
                  )}
                </span>
                <span>
                  {oauthBusy === provider
                    ? `Redirecting to ${OAUTH_LABELS[provider]}...`
                    : `Continue with ${OAUTH_LABELS[provider]}`}
                </span>
                {provider === 'google' && (
                  <span className="absolute right-3.5 hidden sm:inline-flex items-center text-[10px] text-zinc-400 font-normal px-2 py-0.5 rounded-full bg-zinc-800">
                    Last used
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pt-6 pb-4 text-center">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Sessions are managed by Supabase Auth. Passwords are hashed with bcrypt and never
          reach this app.
        </p>
      </div>
    </AuthShell>
  )
}

function busy(status: FormStatus) {
  return status === 'submitting'
}

const inputClass =
  'w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-colors'

const primaryClass =
  'w-full py-3 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white font-medium text-sm shadow-sm shadow-violet-500/25 transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-60'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

function AuthShell({
  children,
  title,
}: {
  children: React.ReactNode
  title?: string
}) {
  const { isDarkMode, toggleDarkMode } = useAppStore()
  return (
    <div className="min-h-screen relative bg-[#fafafa] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 flex flex-col items-center justify-center font-sans px-4 py-12 transition-colors overflow-x-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4] dark:opacity-[0.14]"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      <a
        href="/"
        className="absolute top-5 left-5 sm:left-8 z-30 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Back to WebCrawler
      </a>

      <button
        onClick={toggleDarkMode}
        type="button"
        aria-label="Toggle theme"
        className="absolute top-5 right-5 sm:right-8 z-30 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-800 rounded-md bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm transition-colors"
      >
        {isDarkMode ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
        <span className="hidden sm:inline">{isDarkMode ? 'Light' : 'Dark'}</span>
      </button>

      <div className="relative z-10 w-full max-w-[440px]">
        {title ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-6 sm:p-8">
            <h1 className="text-lg font-semibold tracking-tight mb-3">{title}</h1>
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

function AccountSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] dark:bg-[#09090b]">
      <Loader2 className="size-6 animate-spin text-violet-600 dark:text-violet-400" />
    </div>
  )
}

function Crosshair({ position }: { position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) {
  const posClasses = {
    'top-left': '-top-2.5 -left-2.5',
    'top-right': '-top-2.5 -right-2.5',
    'bottom-left': '-bottom-2.5 -left-2.5',
    'bottom-right': '-bottom-2.5 -right-2.5',
  }[position]

  return (
    <span
      className={`pointer-events-none absolute ${posClasses} z-20 flex h-5 w-5 items-center justify-center font-mono text-sm leading-none text-zinc-400/80 dark:text-zinc-600 select-none`}
      aria-hidden="true"
    >
      +
    </span>
  )
}

function EyeIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 004.2 4.2" />
      <path d="M9.4 5.2A9.7 9.7 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.1M6.6 6.6A17 17 0 002 12s3.5 7 10 7a9.6 9.6 0 003.4-.6" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  )
}

function HistorySection({
  title,
  items,
  empty,
  icon: Icon,
  loading,
}: {
  title: string
  items: { label: string; href: string }[]
  empty: string
  icon: typeof Search
  loading?: boolean
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="size-4 text-zinc-400" />
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</h2>
      </div>
      {loading ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500 py-3 px-1">Loading...</p>
      ) : items.length ? (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
          {items.map((item, index) => (
            <li key={`${item.href}-${index}`}>
              <a
                href={item.href}
                className="block truncate px-4 py-2.5 text-xs text-zinc-700 dark:text-zinc-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-white dark:hover:bg-zinc-900 transition-colors"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-zinc-400 dark:text-zinc-500 py-3 px-1">{empty}</p>
      )}
    </section>
  )
}
