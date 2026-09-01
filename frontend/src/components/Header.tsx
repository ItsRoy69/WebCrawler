import React, { useEffect } from 'react'
import { useAppStore } from '../store'
import { getStats } from '../api'

export function Header() {
  const { isDarkMode, toggleDarkMode, stats, setStats, showFilters, setShowFilters } = useAppStore()

  useEffect(() => {
    getStats().then(setStats).catch(console.error)
  }, [setStats])

  return (
    <header className="border-b border-gray-200 dark:border-gray-700 py-6 mb-8">
      <div className="max-w-6xl mx-auto px-4 space-y-4">
        {/* Top row: Title and controls */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-50">WebCrawler</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Hybrid search engine with BM25 + embeddings</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Toggle dark mode"
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>

            {/* Filters toggle (mobile) */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors md:hidden"
              title="Toggle filters"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.documents || 0}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Documents</p>
            </div>
            <div className="bg-purple-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.documents ? 'Ready' : 'No Index'}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Index Status</p>
            </div>
            <div className="bg-green-50 dark:bg-gray-800 rounded-lg p-3 hidden md:block">
              <p className="text-xs font-mono text-green-600 dark:text-green-400">{stats.embedding_model || 'hashing-v1'}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Embedding Model</p>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
