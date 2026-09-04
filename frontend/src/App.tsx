import { useEffect } from 'react'
import { useAppStore } from './store'
import { Header } from './components/Header'
import { SearchBar } from './components/SearchBar'
import { SearchHistory } from './components/SearchHistory'
import { ResultsList } from './components/ResultsList'
import { CrawlPage } from './components/CrawlPage'

function App() {
  const { isDarkMode, fetchStats, results, filters, isLoading } = useAppStore()
  const hasResults = results.length > 0 || isLoading || !!filters.query
  const params = new URLSearchParams(window.location.search)
  const isCrawlPage =
    window.location.pathname === '/crawl' ||
    params.get('endpoint') === 'crawl'

  const crawlUrl = params.get('url') || ''
  const jobId = params.get('job') || ''

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)
  }, [isDarkMode])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  if (isCrawlPage && crawlUrl) {
    return <CrawlPage url={crawlUrl} jobId={jobId} />
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4] dark:opacity-[0.15]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #e5e5e5 1px, transparent 1px),
            linear-gradient(to bottom, #e5e5e5 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, black 20%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, black 20%, transparent 70%)',
        }}
      />

      <div className="relative z-10">
        <Header />

        <main className="max-w-3xl mx-auto px-4 sm:px-6">
          {!hasResults ? (
            <section className="pt-16 sm:pt-24 pb-10 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/80 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                Bounded crawler · BM25 + HNSW hybrid search
              </div>

              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-zinc-900 dark:text-white leading-[1.1] mb-4">
                Search your
                <br />
                <span className="text-violet-500">crawled web</span>
              </h1>

              <p className="text-base sm:text-lg text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-10">
                Paste a URL to crawl a site, or search what you already indexed.
              </p>

              <div className="max-w-xl mx-auto">
                <SearchBar large />
              </div>

              <div className="mt-6">
                <SearchHistory />
              </div>
            </section>
          ) : (
            <section className="pt-6 pb-6">
              <SearchBar />
              <div className="mt-3">
                <SearchHistory />
              </div>
            </section>
          )}

          {hasResults && (
            <section className="pb-24">
              <ResultsList />
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
