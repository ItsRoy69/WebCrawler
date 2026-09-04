import { useAppStore } from '../store'

export function Header() {
  const { isDarkMode, toggleDarkMode, stats } = useAppStore()

  return (
    <header className="sticky top-0 z-30 bg-[#fafafa]/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200/60 dark:border-zinc-800/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 group">
          <div className="h-8 w-8 rounded-lg bg-violet-500 text-white flex items-center justify-center font-bold text-xs shadow-sm shadow-violet-500/30">
            WC
          </div>
          <span className="font-semibold text-zinc-900 dark:text-white tracking-tight">
            WebCrawler
          </span>
        </a>

        {/* Right */}
        <div className="flex items-center gap-2">
          {stats && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300">
              <span className="text-violet-500 font-semibold">{stats.documents ?? 0}</span>
              docs
            </span>
          )}
          <button onClick={toggleDarkMode} className="btn-secondary !py-1.5 !px-3 !text-xs">
            {isDarkMode ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>
    </header>
  )
}
