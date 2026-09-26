import { useEffect, useState } from 'react'
import { ArrowLeft, Check, Loader2, Moon, Sun } from 'lucide-react'
import { useAppStore } from '../store'
import {
  consumeAuthCallback,
  getSession,
  isRecoveryLink,
  requestPasswordReset,
  updatePassword,
} from '../lib/auth'
import { FlameMark } from './FlameMark'

// Landing page for every redirect back from Supabase: Google and GitHub
// OAuth, email confirmation, and password recovery.
export function AuthCallback() {
  const { applySession, isDarkMode, toggleDarkMode } = useAppStore()
  const [status, setStatus] = useState<'working' | 'done' | 'error' | 'recovery'>('working')
  const [message, setMessage] = useState('')
  const [recovery, setRecovery] = useState(false)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (isRecoveryLink()) {
        if (!cancelled) {
          setRecovery(true)
          setStatus('recovery')
        }
        return
      }

      const error = await consumeAuthCallback()
      if (cancelled) return
      if (error) {
        setMessage(error.message)
        setStatus('error')
        return
      }
      setStatus('done')
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (status !== 'done' && status !== 'recovery') return
    getSession()
      .then((session) => applySession(session))
      .catch(() => undefined)
  }, [status, applySession])

  async function handleNewPassword(event: React.FormEvent) {
    event.preventDefault()
    if (password.length < 8) {
      setMessage('Use at least 8 characters.')
      return
    }
    setSaving(true)
    try {
      await updatePassword(password)
      setMessage('Password updated. You can continue to your account.')
      setStatus('done')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not update the password')
    } finally {
      setSaving(false)
    }
  }

  async function handleResend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    if (!email) return
    try {
      await requestPasswordReset(email)
      setMessage(`If ${email} has an account, a reset link is on its way.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not send the reset email')
    }
  }

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

      <a href="/" className="absolute top-5 left-5 sm:left-8 z-30">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="size-3.5" /> Back to WebCrawler
        </span>
      </a>

      <button
        onClick={toggleDarkMode}
        type="button"
        aria-label="Toggle theme"
        className="absolute top-5 right-5 sm:right-8 z-30 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm transition-colors"
      >
        {isDarkMode ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
      </button>

      <div className="relative z-10 w-full max-w-[420px] text-center">
        <a href="/" className="inline-flex items-center gap-2.5 mb-6">
          <span className="text-violet-600 dark:text-violet-400">
            <FlameMark className="size-8" />
          </span>
          <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            WebCrawler
          </span>
        </a>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-6 sm:p-8">
          {recovery ? (
            <>
              <h1 className="text-lg font-semibold tracking-tight">Choose a new password</h1>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                This link signed you in temporarily so you can set a new one.
              </p>
              <form onSubmit={handleNewPassword} className="mt-6 space-y-3 text-left">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    New password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    minLength={8}
                    required
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-medium text-sm transition-colors"
                >
                  {saving ? 'Saving...' : 'Update password'}
                </button>
              </form>
            </>
          ) : status === 'working' ? (
            <div className="py-6 flex flex-col items-center gap-3">
              <Loader2 className="size-6 animate-spin text-violet-600 dark:text-violet-400" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Completing sign in...</p>
            </div>
          ) : status === 'done' ? (
            <>
              <div className="mx-auto mb-3 size-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Check className="size-5" />
              </div>
              <h1 className="text-lg font-semibold tracking-tight">You are signed in</h1>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                {message || 'Taking you to your account...'}
              </p>
              <a
                href="/account"
                className="mt-6 inline-block w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm transition-colors"
              >
                Go to account
              </a>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold tracking-tight">That link did not work</h1>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{message}</p>
              <form onSubmit={handleResend} className="mt-6 space-y-3 text-left">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    placeholder="name@example.com"
                    required
                    autoComplete="email"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm transition-colors"
                >
                  Send a new link
                </button>
              </form>
              <a
                href="/signin"
                className="mt-3 inline-block text-xs text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400"
              >
                Back to sign in
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
