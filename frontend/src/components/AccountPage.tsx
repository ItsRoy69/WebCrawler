import { FormEvent, useEffect, useState } from 'react'
import { ArrowLeft, Check, Clock, Eye, EyeOff, KeyRound, LogOut, Moon, Search, Sun } from 'lucide-react'
import { useAppStore } from '../store'
import { FlameMark } from './FlameMark'

type Mode = 'signin' | 'signup' | 'account'

export function AccountPage({ mode }: { mode: Mode }) {
  const { user, signIn, signOut, history, playgroundHistory, isDarkMode, toggleDarkMode } = useAppStore()
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>(mode === 'signup' ? 'signup' : 'signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)

  useEffect(() => {
    if (mode === 'signup') {
      setActiveTab('signup')
    } else if (mode === 'signin') {
      setActiveTab('signin')
    }
  }, [mode])

  function handleTabChange(tab: 'signin' | 'signup') {
    setActiveTab(tab)
    const targetUrl = tab === 'signup' ? '/signup' : '/signin'
    window.history.pushState({}, '', targetUrl)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) return
    const displayName = name.trim() || normalizedEmail.split('@')[0]
    signIn({ name: displayName, email: normalizedEmail })
    window.location.href = '/account'
  }

  function handleOAuthSignIn(provider: 'Google' | 'GitHub') {
    const demoEmail = provider === 'Google' ? 'alex.dev@gmail.com' : 'alex-code@github.com'
    const demoName = provider === 'Google' ? 'Alex Rivera' : 'Alex (GitHub)'
    signIn({ name: demoName, email: demoEmail })
    window.location.href = '/account'
  }

  function handleCopyApiKey() {
    navigator.clipboard.writeText('wc_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15))
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  // Account dashboard view when logged in
  if (mode === 'account' && user) {
    return (
      <div className="min-h-screen relative bg-[#fafafa] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors">
        {/* Subtle grid background */}
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

        {/* Top utility bar */}
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-800 rounded-md bg-white/70 dark:bg-zinc-900/70 backdrop-blur-sm transition-colors"
          >
            {isDarkMode ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            {isDarkMode ? 'Light' : 'Dark'}
          </button>
        </div>

        {/* Main account dashboard container */}
        <main className="relative z-10 w-full max-w-4xl mx-auto px-4 py-8 flex-1">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold text-lg border border-violet-500/20">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-violet-600 dark:text-violet-400">Workspace</p>
                  <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Welcome, {user.name}</h1>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/playground?endpoint=crawl"
                  className="px-3.5 py-2 text-xs font-medium rounded-lg bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white shadow-sm shadow-violet-500/20 transition-colors"
                >
                  Open Playground
                </a>
                <button
                  onClick={() => { signOut(); window.location.href = '/' }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
                >
                  <LogOut className="size-3.5" /> Sign out
                </button>
              </div>
            </div>

            {/* API Key quick widget */}
            <div className="mt-6 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <KeyRound className="size-4 text-violet-600 dark:text-violet-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">Developer API Key</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">Use this token to authenticate programmatic crawling requests</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyApiKey}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                {copiedKey ? <Check className="size-3 text-emerald-600 dark:text-emerald-400" /> : null}
                {copiedKey ? 'Copied key' : 'Copy API key'}
              </button>
            </div>

            {/* History grids */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <HistorySection
                title="Recent search queries"
                items={history}
                icon={Search}
                empty="Your search queries will appear here."
              />
              <HistorySection
                title="Playground crawl runs"
                items={playgroundHistory}
                icon={Clock}
                empty="URLs started from the playground will appear here."
                linkPrefix="/playground?endpoint=crawl&url="
              />
            </div>
          </div>
        </main>
      </div>
    )
  }

  const isSignUp = activeTab === 'signup'

  return (
    <div className="min-h-screen relative bg-[#fafafa] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 flex flex-col items-center justify-center font-sans px-4 py-12 transition-colors overflow-x-hidden">
      {/* Subtle grid background covering full screen */}
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

      {/* Top utility actions (Back button & Theme toggle) */}
      <div className="absolute top-5 left-5 sm:left-8 z-30">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Back to WebCrawler
        </a>
      </div>

      <div className="absolute top-5 right-5 sm:right-8 z-30">
        <button
          onClick={toggleDarkMode}
          type="button"
          aria-label="Toggle theme"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-800 rounded-md bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm transition-colors"
        >
          {isDarkMode ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          <span className="hidden sm:inline">{isDarkMode ? 'Light' : 'Dark'}</span>
        </button>
      </div>

      {/* Centered Structured Grid Box */}
      <div className="relative z-10 w-full max-w-[440px]">
        {/* BOX 1: Logo & Title Section */}
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

        {/* BOX 2: Log In / Sign Up Segmented Switcher */}
        <div className="relative border-x border-b border-zinc-200 dark:border-zinc-800 bg-[#fafafa] dark:bg-[#09090b] grid grid-cols-2 p-1 transition-colors">
          <Crosshair position="bottom-left" />
          <Crosshair position="bottom-right" />

          {/* Log In Tab */}
          <div className="flex items-center justify-center p-1.5">
            <button
              type="button"
              onClick={() => handleTabChange('signin')}
              className={`w-full py-2.5 text-sm font-medium rounded-lg transition-all duration-150 ${
                !isSignUp
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/80 dark:border-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              Log In
            </button>
          </div>

          {/* Sign Up Tab */}
          <div className="flex items-center justify-center p-1.5 border-l border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => handleTabChange('signup')}
              className={`w-full py-2.5 text-sm font-medium rounded-lg transition-all duration-150 ${
                isSignUp
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/80 dark:border-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* BOX 3: Credentials Form & OAuth Actions */}
        <div className="relative border-x border-b border-zinc-200 dark:border-zinc-800 bg-[#fafafa] dark:bg-[#09090b] px-6 py-7 sm:px-8 transition-colors">
          <Crosshair position="bottom-left" />
          <Crosshair position="bottom-right" />

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-colors"
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-colors"
                autoComplete="email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Password
                </label>
                {!isSignUp && (
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault()
                      alert('Password reset link will be sent to your email address.')
                    }}
                    className="text-[11px] text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                  >
                    Forgot password?
                  </a>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2.5 pr-10 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-colors"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Primary Submit Button with WebCrawler Violet Color Codes */}
            <button
              type="submit"
              className="w-full mt-2 py-3 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white font-medium text-sm shadow-sm shadow-violet-500/25 transition-all duration-150 flex items-center justify-center gap-2"
            >
              {isSignUp ? 'Create Account' : 'Log In'}
            </button>
          </form>

          {/* Social OAuth Buttons */}
          <div className="mt-5 space-y-2.5">
            {/* Google Button with Last used tag */}
            <button
              type="button"
              onClick={() => handleOAuthSignIn('Google')}
              className="w-full py-2.5 px-4 rounded-full bg-black text-white hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border dark:border-zinc-800 transition-colors flex items-center justify-center relative text-sm font-medium"
            >
              <span className="absolute left-4 flex items-center">
                <GoogleIcon className="size-4" />
              </span>
              <span>Continue with Google</span>
              <span className="absolute right-3.5 hidden sm:inline-flex items-center text-[10px] text-zinc-400 font-normal px-2 py-0.5 rounded-full bg-zinc-800 dark:bg-zinc-800">
                Last used
              </span>
            </button>

            {/* GitHub Button */}
            <button
              type="button"
              onClick={() => handleOAuthSignIn('GitHub')}
              className="w-full py-2.5 px-4 rounded-full bg-black text-white hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border dark:border-zinc-800 transition-colors flex items-center justify-center relative text-sm font-medium"
            >
              <span className="absolute left-4 flex items-center">
                <GitHubIcon className="size-4" />
              </span>
              <span>Continue with GitHub</span>
            </button>
          </div>
        </div>

        {/* BOX 4: Footer Legal & Agent Link */}
        <div className="pt-6 pb-4 text-center">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            By signing up, you agree to our{' '}
            <a
              href="#terms"
              onClick={(e) => { e.preventDefault(); alert('Terms of Service: WebCrawler is an open search and crawling engine.') }}
              className="text-zinc-700 dark:text-zinc-300 underline hover:text-zinc-900 dark:hover:text-white"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="#privacy"
              onClick={(e) => { e.preventDefault(); alert('Privacy Policy: All crawling and query data stays local or private to your instance.') }}
              className="text-zinc-700 dark:text-zinc-300 underline hover:text-zinc-900 dark:hover:text-white"
            >
              Privacy Policy
            </a>
          </p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Are you an AI agent?{' '}
            <a
              href="/playground?endpoint=crawl"
              className="text-violet-600 dark:text-violet-400 underline hover:text-violet-700 dark:hover:text-violet-300 font-medium"
            >
              Get an API key here
            </a>
          </p>
        </div>
      </div>
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

function GoogleIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
    </svg>
  )
}

function GitHubIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
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
  linkPrefix,
  icon: Icon,
}: {
  title: string
  items: string[]
  empty: string
  linkPrefix?: string
  icon: typeof Search
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="size-4 text-zinc-400" />
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</h2>
      </div>
      {items.length ? (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
          {items.map((item) => (
            <li key={item}>
              <a
                href={linkPrefix ? `${linkPrefix}${encodeURIComponent(item)}` : `/?q=${encodeURIComponent(item)}`}
                className="block truncate px-4 py-2.5 text-xs text-zinc-700 dark:text-zinc-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-white dark:hover:bg-zinc-900 transition-colors"
              >
                {item}
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
