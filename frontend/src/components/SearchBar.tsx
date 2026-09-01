import React, { useState } from 'react'
import { useAppStore } from '../store'
import { search } from '../api'

export function SearchBar() {
  const { filters, setQuery, addToHistory, setIsLoading, setResults, isCrawling } = useAppStore()
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
      const { results, cached } = await search(
        inputValue,
        filters.limit,
        0,
        filters.domain,
        0.5,
        100,
        isCrawlURL
      )
      setResults(results, results.length)
      setIsCached(cached || false)
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Search failed'}`)
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
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">💾 Result from cache</p>
      )}
    </form>
  )
}
