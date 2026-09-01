import { useState, useEffect } from 'react'
import { getAnalytics, getCacheStatus, clearCache } from '../api'

interface AnalyticsData {
  search_stats: {
    total_searches: number
    avg_response_time_ms: number
    avg_results: number
    top_queries: Array<{ query: string; count: number }>
  }
  recent_queries: Array<{ query: string; result_count: number; response_time_ms: number }>
  top_queries: Array<{ query: string; count: number }>
}

interface CacheStatus {
  cache_size: number
  max_size: number
}

export function Analytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)

  const safeAnalytics = analytics ?? {
    search_stats: {
      total_searches: 0,
      avg_response_time_ms: 0,
      avg_results: 0,
      top_queries: [],
    },
    recent_queries: [],
    top_queries: [],
  }

  const searchStats = safeAnalytics.search_stats ?? {
    total_searches: 0,
    avg_response_time_ms: 0,
    avg_results: 0,
    top_queries: [],
  }

  const topQueries = Array.isArray(searchStats.top_queries) ? searchStats.top_queries : []
  const recentQueries = Array.isArray(safeAnalytics.recent_queries) ? safeAnalytics.recent_queries : []

  useEffect(() => {
    if (!showAnalytics) return

    const load = async () => {
      setLoading(true)
      try {
        const [analytics, cache] = await Promise.all([
          getAnalytics(),
          getCacheStatus(),
        ])
        setAnalytics(analytics)
        setCacheStatus(cache)
      } catch (error) {
        console.error('Failed to load analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    load()
    const interval = setInterval(load, 5000) // Refresh every 5s
    return () => clearInterval(interval)
  }, [showAnalytics])

  const handleClearCache = async () => {
    if (!window.confirm('Clear search cache?')) return
    try {
      await clearCache()
      setCacheStatus((prev) => (prev ? { ...prev, cache_size: 0 } : null))
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  if (!showAnalytics) {
    return (
      <button
        onClick={() => setShowAnalytics(true)}
        className="fixed bottom-4 right-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-lg transition-colors"
        title="View analytics"
      >
        📊 Analytics
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-lg">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Analytics Dashboard</h2>
          <button
            onClick={() => setShowAnalytics(false)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading && !analytics ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
              <p className="text-gray-600 dark:text-gray-400">Loading analytics...</p>
            </div>
          ) : analytics ? (
            <>
              {/* Search Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card text-center">
                  <p className="text-3xl font-bold text-blue-600">{searchStats.total_searches}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Searches</p>
                </div>
                <div className="card text-center">
                  <p className="text-3xl font-bold text-green-600">{searchStats.avg_results.toFixed(1)}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Avg Results</p>
                </div>
                <div className="card text-center">
                  <p className="text-3xl font-bold text-purple-600">{searchStats.avg_response_time_ms.toFixed(0)}ms</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Avg Response Time</p>
                </div>
                {cacheStatus && (
                  <div className="card text-center">
                    <p className="text-3xl font-bold text-orange-600">{cacheStatus.cache_size}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Cached Queries</p>
                  </div>
                )}
              </div>

              {/* Top Queries */}
              {topQueries.length > 0 && (
                <div className="card">
                  <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-gray-50">Top Searches</h3>
                  <div className="space-y-2">
                    {topQueries.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{item.query}</span>
                        <span className="ml-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs font-semibold">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cache Controls */}
              {cacheStatus && (
                <div className="card">
                  <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-gray-50">Cache Status</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Cache Usage</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                          {cacheStatus.cache_size} / {cacheStatus.max_size}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${cacheStatus.max_size > 0 ? (cacheStatus.cache_size / cacheStatus.max_size) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleClearCache}
                      className="btn-secondary w-full"
                    >
                      Clear Cache
                    </button>
                  </div>
                </div>
              )}

              {/* Recent Queries */}
              {recentQueries.length > 0 && (
                <div className="card">
                  <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-gray-50">Recent Searches</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {recentQueries.slice(0, 10).map((query, i) => (
                      <div key={i} className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <div className="font-medium text-gray-900 dark:text-gray-50 truncate">{query.query}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 flex gap-3 mt-1">
                          <span>{query.result_count} results</span>
                          <span>{query.response_time_ms.toFixed(0)}ms</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-gray-600 dark:text-gray-400">No analytics data available</p>
          )}
        </div>
      </div>
    </div>
  )
}
