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
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-10 w-10 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin mb-4" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Searching…</p>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-20 px-4">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mb-4">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <p className="text-slate-600 dark:text-slate-300 font-medium mb-1">
          {filters.query ? 'No results found' : 'Start searching'}
        </p>
        <p className="text-sm text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
          {filters.query
            ? 'Try a different query, or paste a URL to crawl a new site.'
            : 'Enter a search term, or paste a site URL to crawl it live.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {totalResults > 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Showing{' '}
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {startIndex}–{endIndex}
          </span>{' '}
          of {totalResults} results
        </p>
      )}

      <div className="space-y-3">
        {results.map((result, i) => (
          <ResultCard key={`${result.url}-${i}`} result={result} query={filters.query} />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination currentPage={filters.page} totalPages={totalPages} />
      )}
    </div>
  )
}