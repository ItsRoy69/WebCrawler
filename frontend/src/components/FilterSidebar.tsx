import React from 'react'
import { useAppStore } from '../store'

export function FilterSidebar() {
  const { filters, setDomain, setSortBy, showFilters, setShowFilters } = useAppStore()
  const [domainInput, setDomainInput] = React.useState(filters.domain || '')

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setDomainInput(value)
    setDomain(value || undefined)
  }

  if (!showFilters) return null

  return (
    <aside className="w-full md:w-64 space-y-4 md:border-r border-gray-200 dark:border-gray-700 md:pr-4">
      {/* Sort */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Sort By</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="sort"
              value="relevance"
              checked={filters.sortBy === 'relevance'}
              onChange={(e) => setSortBy(e.target.value as 'relevance' | 'date')}
              className="w-4 h-4"
            />
            <span className="text-sm">Relevance (Default)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="sort"
              value="date"
              checked={filters.sortBy === 'date'}
              onChange={(e) => setSortBy(e.target.value as 'relevance' | 'date')}
              className="w-4 h-4"
            />
            <span className="text-sm">Newest First</span>
          </label>
        </div>
      </div>

      {/* Domain Filter */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Filter by Domain</h3>
        <input
          type="text"
          value={domainInput}
          onChange={handleDomainChange}
          placeholder="e.g., example.com"
          className="input-field text-sm"
        />
      </div>

      {/* Clear Filters */}
      {(filters.domain || filters.sortBy !== 'relevance') && (
        <button
          onClick={() => {
            setDomain(undefined)
            setDomainInput('')
            setSortBy('relevance')
          }}
          className="btn-secondary w-full text-sm"
        >
          Clear Filters
        </button>
      )}

      {/* Toggle on mobile */}
      <button
        onClick={() => setShowFilters(false)}
        className="btn-secondary w-full text-sm md:hidden"
      >
        Hide Filters
      </button>
    </aside>
  )
}
