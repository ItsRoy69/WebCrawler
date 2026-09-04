import React from 'react'
import { useAppStore } from '../store'

export function FilterSidebar() {
  const { filters, setDomain, setSortBy, showFilters, setShowFilters } = useAppStore()
  const [domainInput, setDomainInput] = React.useState(filters.domain || '')

  if (!showFilters) return null

  return (
    <aside className="w-full lg:w-56 shrink-0 space-y-6">
      <div className="card !p-4 space-y-5">
        <div className="flex items-center justify-between lg:block">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Filters
          </h3>
          <button
            onClick={() => setShowFilters(false)}
            className="text-xs text-slate-400 lg:hidden"
          >
            Hide
          </button>
        </div>

        {/* Sort */}
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Sort by</p>
          <div className="space-y-2">
            {(['relevance', 'date'] as const).map((value) => (
              <label key={value} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="radio"
                  name="sort"
                  value={value}
                  checked={filters.sortBy === value}
                  onChange={() => setSortBy(value)}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white capitalize">
                  {value === 'relevance' ? 'Relevance' : 'Newest first'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Domain */}
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Domain</p>
          <input
            type="text"
            value={domainInput}
            onChange={(e) => {
              const v = e.target.value
              setDomainInput(v)
              setDomain(v || undefined)
            }}
            placeholder="example.com"
            className="input-field !py-2 !text-sm"
          />
        </div>

        {(filters.domain || filters.sortBy !== 'relevance') && (
          <button
            onClick={() => {
              setDomain(undefined)
              setDomainInput('')
              setSortBy('relevance')
            }}
            className="btn-secondary w-full !text-sm"
          >
            Clear filters
          </button>
        )}
      </div>
    </aside>
  )
}