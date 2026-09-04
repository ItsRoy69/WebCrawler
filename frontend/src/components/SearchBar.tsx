import React, { useState } from 'react'
import { useAppStore } from '../store'
import { search } from '../api'

type Mode = 'search' | 'crawl'

interface SearchBarProps {
  large?: boolean
}

export function SearchBar({ large = false }: SearchBarProps) {
  const {
    filters,
    setQuery,
    addToHistory,
    setIsLoading,
    setResults,
    isCrawling,
    setCrawlJob,
    pollCrawlStatus,
  } = useAppStore()

  const [inputValue, setInputValue] = useState(filters.query)
  const [mode, setMode] = useState<Mode>('search')
  const [isCached, setIsCached] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = inputValue.trim()
    if (!q) return

    addToHistory(q)
    setQuery(q)
    setIsLoading(true)
    setIsCached(false)

    try {
      const looksLikeUrl = /^https?:\/\//i.test(q)
      const shouldCrawl = mode === 'crawl' || looksLikeUrl
      const offset = (filters.page - 1) * filters.limit

      const data = await search(
        q,
        filters.limit,
        offset,
        filters.domain,
        0.5,
        100,
        shouldCrawl
      )

      setResults(data.results, data.total)
      setIsCached(data.cached || false)

      if (data.job_id) {
        setCrawlJob(data.job_id)
        pollCrawlStatus(async (crawlError) => {
          if (crawlError) return

          // The initial crawl response searches the old index. Run the same
          // query again after the new index has been built.
          try {
            const refreshed = await search(
              q,
              filters.limit,
              offset,
              filters.domain,
              0.5,
              100,
              false
            )
            setResults(refreshed.results, refreshed.total)
            setIsCached(refreshed.cached || false)
          } catch {
            // Keep the initial response visible if the refresh fails.
          }
        })
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Search failed'}`)
      setResults([], 0)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={`
          bg-white dark:bg-zinc-900
          border border-zinc-200 dark:border-zinc-700
          shadow-xl shadow-zinc-200/50 dark:shadow-black/30
          overflow-hidden
          ${large ? 'rounded-2xl' : 'rounded-xl'}
        `}
      >
        {/* Mode tabs – Firecrawl style */}
        <div className="flex items-center gap-1 px-3 pt-3 pb-1">
          <button
            type="button"
            onClick={() => setMode('search')}
            className={`mode-tab ${mode === 'search' ? 'mode-tab-active' : ''}`}
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => setMode('crawl')}
            className={`mode-tab ${mode === 'crawl' ? 'mode-tab-active' : ''}`}
          >
            Crawl
          </button>
          {filters.domain && (
            <span className="ml-auto text-xs text-zinc-400 truncate max-w-[120px]">
              domain: {filters.domain}
            </span>
          )}
        </div>

        {/* Input row */}
        <div className="flex items-center gap-2 px-3 pb-3">
          <div className="text-zinc-400 pl-1">
            {mode === 'crawl' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>

          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              mode === 'crawl'
                ? 'https://example.com'
                : 'Search your index…'
            }
            disabled={isCrawling}
            className="input-field flex-1 !px-2 !py-2.5"
            autoFocus
          />

          <button
            type="submit"
            disabled={isCrawling || !inputValue.trim()}
            className="btn-primary !px-4 !py-2 shrink-0"
          >
            {isCrawling ? (
              'Working…'
            ) : (
              <span className="flex items-center gap-1">
                {mode === 'crawl' ? 'Crawl' : 'Search'}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </span>
            )}
          </button>
        </div>
      </div>

      {isCached && (
        <p className="text-xs text-center text-zinc-400 mt-2">Served from cache</p>
      )}
    </form>
  )
}
