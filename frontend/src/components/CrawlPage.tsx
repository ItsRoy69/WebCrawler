import { useEffect, useState } from 'react'
import { useAppStore } from '../store'
import { search } from '../api'

interface CrawlPageProps {
  url: string
  jobId: string
}

export function CrawlPage({ url, jobId }: CrawlPageProps) {
  const {
    isCrawling,
    crawlProgress,
    crawlMessage,
    crawlPagesFound,
    crawlPagesStored,
    results,
    setResults,
    setCrawlJob,
    pollCrawlStatus,
    fetchStats,
  } = useAppStore()

  const [activeTab, setActiveTab] = useState<'markdown' | 'json'>('markdown')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Start polling as soon as we land on this page
  useEffect(() => {
    if (!jobId) return

    setCrawlJob(jobId)

    pollCrawlStatus(async (error) => {
      if (error) return

      // After crawl finishes, refresh results from the new index
      try {
        const refreshed = await search(url, 50, 0, undefined, 0.5, 100, false)
        setResults(refreshed.results, refreshed.total)
      } catch {
        // keep whatever we already have
      }
      fetchStats()
    })
  }, [jobId])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Top bar */}
      <header className="border-b border-white/5 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="h-7 w-7 rounded-lg bg-violet-500 flex items-center justify-center text-xs font-bold text-black">
              WC
            </div>
            <span className="font-semibold text-sm">WebCrawler</span>
          </a>
        </div>

        <div className="flex items-center gap-2">
          <button className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 transition-colors">
            Share
          </button>
          {isCrawling && (
            <button className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition-colors">
              Stop
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* URL header */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-violet-500/15 flex items-center justify-center text-violet-400 text-sm font-bold">
            {url.replace(/^https?:\/\//, '')[0]?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-white truncate">{url}</p>
            <p className="text-xs text-white/40">Crawl job</p>
          </div>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-xs text-white/40 mb-1.5">Endpoint</p>
            <p className="flex items-center gap-2 text-sm">
              <span className="text-violet-400 text-xs">✕</span>
              <span>Crawl</span>
            </p>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-xs text-white/40 mb-1.5">Status</p>
            <p className="flex items-center gap-2 text-sm">
              {isCrawling ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
                  <span className="text-violet-400">Pending</span>
                </>
              ) : (
                <>
                  <span className="text-emerald-400">✓</span>
                  <span className="text-emerald-400">Success</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Inline progress (NO modal) */}
        {isCrawling && (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">
                {crawlMessage || 'Crawling the pages…'}
              </span>
              <span className="text-white/40 tabular-nums">{crawlProgress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-violet-500 transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, crawlProgress)}%` }}
              />
            </div>
            <p className="text-xs text-white/40">
              {crawlPagesStored} stored · {crawlPagesFound} found
            </p>
          </div>
        )}

        {/* Results header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h2 className="text-lg font-semibold">
              Results{results.length > 0 ? ` (${results.length})` : ''}
            </h2>
            {isCrawling && (
              <p className="text-sm text-white/40 mt-0.5">Crawling the pages…</p>
            )}
            {!isCrawling && results.length === 0 && (
              <p className="text-sm text-white/40 mt-0.5">No pages indexed yet</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 transition-colors">
              Markdown
            </button>
            <button className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 transition-colors">
              JSON
            </button>
          </div>
        </div>

        {/* Result list */}
        <div className="space-y-3">
          {results.map((r, i) => (
            <div
              key={r.url + i}
              className={`
                rounded-xl border overflow-hidden transition-colors cursor-pointer
                ${selectedIndex === i
                  ? 'border-violet-500/40 bg-violet-500/5'
                  : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                }
              `}
              onClick={() => setSelectedIndex(i)}
            >
              {/* Card header */}
              <div className="px-5 py-3.5 border-b border-white/5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="font-medium text-violet-400 text-sm">
                    #{i + 1} {r.title || r.url}
                  </p>
                  <p className="text-xs text-white/40 mt-0.5 truncate">{r.url}</p>
                </div>
              </div>

              {/* Tabs */}
              {selectedIndex === i && (
                <>
                  <div className="flex items-center gap-0 border-b border-white/5 px-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveTab('markdown')
                      }}
                      className={`
                        px-3 py-2 text-xs font-medium border-b-2 transition-colors
                        ${activeTab === 'markdown'
                          ? 'border-violet-500 text-violet-400'
                          : 'border-transparent text-white/40 hover:text-white/70'
                        }
                      `}
                    >
                      Markdown
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveTab('json')
                      }}
                      className={`
                        px-3 py-2 text-xs font-medium border-b-2 transition-colors
                        ${activeTab === 'json'
                          ? 'border-violet-500 text-violet-400'
                          : 'border-transparent text-white/40 hover:text-white/70'
                        }
                      `}
                    >
                      {'{ }'} JSON
                    </button>
                  </div>

                  {/* Content */}
                  <div className="px-5 py-4 max-h-80 overflow-y-auto">
                    {activeTab === 'markdown' ? (
                      <pre className="text-sm text-white/70 whitespace-pre-wrap font-mono leading-relaxed">
                        {r.snippet || r.description || 'No content extracted.'}
                      </pre>
                    ) : (
                      <pre className="text-sm text-white/70 whitespace-pre-wrap font-mono leading-relaxed">
                        {JSON.stringify(
                          {
                            url: r.url,
                            title: r.title,
                            snippet: r.snippet,
                            score: r.score,
                            domain: r.domain,
                          },
                          null,
                          2
                        )}
                      </pre>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Empty state while waiting */}
        {isCrawling && results.length === 0 && (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] py-16 text-center">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10 text-violet-400 mb-4">
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <p className="text-sm text-white/50">Waiting for pages…</p>
          </div>
        )}
      </main>
    </div>
  )
}
