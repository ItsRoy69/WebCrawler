import React, { useEffect } from 'react'
import { useAppStore } from '../store'
import { ResultCard } from './ResultCard'
import { Pagination } from './Pagination'

export function ResultsList() {
  const { results, isLoading, filters, totalResults } = useAppStore()

  const startIndex = (filters.page - 1) * filters.limit + 1
  const endIndex = Math.min(filters.page * filters.limit, totalResults)
  const totalPages = Math.ceil(totalResults / filters.limit)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Searching...</p>
        </div>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">
          {filters.query ? 'No results found. Try a different search.' : 'Enter a search query to begin.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Results count */}
      {totalResults > 0 && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Showing {startIndex} to {endIndex} of {totalResults} results
        </p>
      )}

      {/* Results */}
      <div className="space-y-3">
        {results.map((result, i) => (
          <ResultCard key={i} result={result} query={filters.query} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && <Pagination currentPage={filters.page} totalPages={totalPages} />}
    </div>
  )
}
