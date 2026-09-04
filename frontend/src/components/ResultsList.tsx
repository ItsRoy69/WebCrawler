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
      <div className="flex flex-col items-center justify-center py-16">
        <div className="h-9 w-9 rounded-full border-2 border-zinc-200 border-t-orange-500 animate-spin mb-3" />
        <p className="text-sm text-zinc-500">Searching…</p>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="font-medium text-zinc-700 dark:text-zinc-200 mb-1">No results</p>
        <p className="text-sm text-zinc-400">
          Try another query, or switch to Crawl and paste a URL.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-500">
        {startIndex}–{endIndex} of {totalResults}
      </p>

      {results.map((result, i) => (
        <ResultCard key={`${result.url}-${i}`} result={result} query={filters.query} />
      ))}

      {totalPages > 1 && (
        <Pagination currentPage={filters.page} totalPages={totalPages} />
      )}
    </div>
  )
}