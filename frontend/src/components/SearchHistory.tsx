import React from 'react'
import { useAppStore } from '../store'

export function SearchHistory() {
  const { history, setQuery, clearHistory } = useAppStore()

  if (history.length === 0) return null

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Searches</h3>
        <button
          onClick={clearHistory}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
        >
          Clear
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {history.map((query, i) => (
          <button
            key={i}
            onClick={() => setQuery(query)}
            className="px-3 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 transition-colors"
            title={query}
          >
            {query.length > 30 ? query.substring(0, 30) + '...' : query}
          </button>
        ))}
      </div>
    </div>
  )
}
