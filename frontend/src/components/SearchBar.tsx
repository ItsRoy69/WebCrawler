import React, { useState } from 'react'
import { useAppStore } from '../store'
import { search } from '../api'

export function SearchBar() {
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
  const [isCached, setIsCached] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    addToHistory(inputValue)
    setQuery(inputValue)
    setIsLoading(true)
    setIsCached(false)

    try {
      const isCrawlURL = /^https?:\/\//i.test(inputValue.trim())
      const offset = (filters.page - 1) * filters.limit

      const data = await search(
        inputValue,
        filters.limit,
        offset,
        filters.domain,
        0.5,
        100,
        isCrawlURL
      )

      setResults(data.results, data.total)
      setIsCached(data.cached || false)

      if (data.job_id) {
        setCrawlJob(data.job_id)
        pollCrawlStatus()
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
      <div className="relative flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-black/20 p-2 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500 transition-all">
        <div className="pl-3 text-slate-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search or paste a URL to crawl…"
          disabled={isCrawling}
          className="flex-1 bg-transparent border-0 outline-none text-base text-slate-900 dark:text-slate-50 placeholder:text-slate-400 py-2.5 px-2 disabled:opacity-60"
          autoFocus
        />

        <button
          type="submit"
          disabled={isCrawling || !inputValue.trim()}
          className="btn-primary !rounded-xl shrink-0"
        >
          {isCrawling ? 'Crawling…' : 'Search'}
        </button>
      </div>

      {isCached && (
        <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 text-center">
          Result served from cache
        </p>
      )}
    </form>
  )
}