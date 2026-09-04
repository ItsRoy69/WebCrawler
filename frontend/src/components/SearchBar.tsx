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

      // Start crawl progress polling if backend returned a job_id
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
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search text or enter a site URL (e.g., https://example.com)"
          disabled={isCrawling}
          className="input-field flex-1"
          autoFocus
        />
        <button
          type="submit"
          disabled={isCrawling}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCrawling ? 'Crawling...' : 'Search'}
        </button>
      </div>
      {isCached && (
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
          💾 Result from cache
        </p>
      )}
    </form>
  )
}