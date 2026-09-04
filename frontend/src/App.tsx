import { useEffect } from 'react'
import { useAppStore } from './store'
import { Header } from './components/Header'
import { SearchBar } from './components/SearchBar'
import { SearchHistory } from './components/SearchHistory'
import { FilterSidebar } from './components/FilterSidebar'
import { ResultsList } from './components/ResultsList'
import { CrawlProgress } from './components/CrawlProgress'
import { Analytics } from './components/Analytics'

function App() {
  const { isDarkMode, fetchStats } = useAppStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)
  }, [isDarkMode])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* subtle top gradient */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-gradient-to-b from-indigo-50/80 to-transparent dark:from-indigo-950/30 dark:to-transparent" />

      <div className="relative">
        <Header />

        <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
          {/* Hero search */}
          <section className="pt-2 pb-8">
            <div className="max-w-2xl mx-auto text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white mb-2">
                Search your crawled web
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Hybrid BM25 + embeddings · paste a URL to crawl a site live
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              <SearchBar />
            </div>

            <div className="max-w-2xl mx-auto mt-4">
              <SearchHistory />
            </div>
          </section>

          {/* Results area */}
          <section className="flex flex-col lg:flex-row gap-8">
            <FilterSidebar />
            <div className="flex-1 min-w-0">
              <ResultsList />
            </div>
          </section>
        </main>
      </div>

      <CrawlProgress />
      <Analytics />
    </div>
  )
}

export default App