import { FormEvent, useState } from 'react'
import { useAppStore } from '../store'

type Mode = 'signin' | 'signup' | 'account'

export function AccountPage({ mode }: { mode: Mode }) {
  const { user, signIn, signOut, history, playgroundHistory } = useAppStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) return
    signIn({ name: name.trim() || normalizedEmail.split('@')[0], email: normalizedEmail })
    window.location.href = '/account'
  }

  if (mode === 'account' && user) {
    return (
      <PageFrame>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-violet-500">Your workspace</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Welcome, {user.name}</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{user.email}</p>
          </div>
          <button onClick={() => { signOut(); window.location.href = '/' }} className="btn-secondary !px-3 !py-1.5 !text-xs">Sign out</button>
        </div>
        <HistorySection title="Searched queries" items={history} empty="Your searches will appear here." />
        <HistorySection title="Playground crawls" items={playgroundHistory} empty="URLs started from the playground will appear here." linkPrefix="/playground?endpoint=crawl&url=" />
      </PageFrame>
    )
  }

  const signUp = mode === 'signup'
  return (
    <PageFrame narrow>
      <p className="text-sm font-medium text-violet-500">WebCrawler account</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{signUp ? 'Create your workspace' : 'Welcome back'}</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Save your search and playground activity on this device.</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        {signUp && <label className="block text-sm font-medium">Name<input value={name} onChange={(event) => setName(event.target.value)} className="input-field mt-1.5 rounded-lg border border-zinc-200 bg-white text-sm dark:border-zinc-700 dark:bg-zinc-900" autoComplete="name" /></label>}
        <label className="block text-sm font-medium">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="input-field mt-1.5 rounded-lg border border-zinc-200 bg-white text-sm dark:border-zinc-700 dark:bg-zinc-900" autoComplete="email" required /></label>
        <button type="submit" className="btn-primary w-full">{signUp ? 'Create account' : 'Sign in'}</button>
      </form>
      <p className="mt-5 text-center text-sm text-zinc-500 dark:text-zinc-400">{signUp ? 'Already have an account?' : 'New to WebCrawler?'} <a className="text-violet-500 hover:text-violet-600" href={signUp ? '/signin' : '/signup'}>{signUp ? 'Sign in' : 'Create an account'}</a></p>
    </PageFrame>
  )
}

function PageFrame({ children, narrow = false }: { children: React.ReactNode, narrow?: boolean }) {
  return <div className="min-h-screen bg-[#fafafa] px-4 py-14 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"><main className={`mx-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8 ${narrow ? 'max-w-md' : 'max-w-3xl'}`}><a href="/" className="text-sm font-semibold tracking-tight">WebCrawler</a><div className="mt-8">{children}</div></main></div>
}

function HistorySection({ title, items, empty, linkPrefix }: { title: string, items: string[], empty: string, linkPrefix?: string }) {
  return <section className="mt-10"><h2 className="text-lg font-semibold">{title}</h2>{items.length ? <ul className="mt-3 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">{items.map((item) => <li key={item}><a href={linkPrefix ? `${linkPrefix}${encodeURIComponent(item)}` : `/?q=${encodeURIComponent(item)}`} className="block truncate px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">{item}</a></li>)}</ul> : <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{empty}</p>}</section>
}
