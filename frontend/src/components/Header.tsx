import { useAppStore } from '../store'

export function Header() {
  const { isDarkMode, toggleDarkMode, stats, showFilters, setShowFilters } = useAppStore()

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-white/70 dark:bg-slate-950/70 border-b border-slate-200/60 dark:border-slate-800/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-sm shadow-indigo-600/30">
              WC
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white truncate">
                WebCrawler
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Hybrid search engine
              </p>
            </div>
          </div>

          {/* Stats pills + controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {stats && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="chip !cursor-default">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400 mr-1">
                    {stats.documents ?? 0}
                  </span>
                  docs
                </span>
                <span className="chip !cursor-default max-w-[140px] truncate">
                  {stats.embedding_model || 'hashing-v1'}
                </span>
              </div>
            )}

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn-secondary !px-3 !py-2 lg:hidden"
              title="Filters"
            >
              Filters
            </button>

            <button
              onClick={toggleDarkMode}
              className="btn-secondary !px-3 !py-2"
              title="Toggle dark mode"
            >
              {isDarkMode ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}