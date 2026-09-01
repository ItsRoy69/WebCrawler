import { SearchResult } from './store'

const API_BASE = '/api' // In prod, this will be proxied to backend

export async function search(
  query: string,
  limit: number = 10,
  offset: number = 0,
  domain?: string,
  alpha: number = 0.5,
  ef: number = 100,
  crawl: boolean = true
): Promise<{
  results: SearchResult[]
  total: number
  crawled: boolean
  cached?: boolean
}> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    offset: String(offset),
    alpha: String(alpha),
    ef: String(ef),
    crawl: String(crawl),
  })

  if (domain) params.append('domain', domain)

  const response = await fetch(`/search?${params}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Search failed')
  }

  const data = await response.json()
  return {
    results: data.results || [],
    total: data.total || 0,
    crawled: data.crawled || false,
    cached: data.cached || false,
  }
}

export async function getStats(): Promise<{
  documents: number
  embedding_model: string
  index_size_mb?: number
  by_source?: Record<string, number>
  frontier_status?: Record<string, number>
}> {
  const response = await fetch('/stats')
  if (!response.ok) {
    throw new Error('Failed to fetch stats')
  }
  return response.json()
}

export async function getCrawlStatus(): Promise<{
  isCrawling: boolean
  progress: number
  pagesFound: number
  pagesStored: number
  message: string
}> {
  try {
    const response = await fetch(`${API_BASE}/crawl-status`)
    if (!response.ok)
      return { isCrawling: false, progress: 0, pagesFound: 0, pagesStored: 0, message: '' }
    return response.json()
  } catch {
    return { isCrawling: false, progress: 0, pagesFound: 0, pagesStored: 0, message: '' }
  }
}

// New Phase 2 endpoints
export async function getAnalytics(): Promise<{
  search_stats: {
    total_searches: number
    avg_response_time_ms: number
    avg_results: number
    top_queries: Array<{ query: string; count: number }>
  }
  recent_queries: Array<{ query: string; result_count: number; response_time_ms: number }>
  top_queries: Array<{ query: string; count: number }>
}> {
  try {
    const response = await fetch(`${API_BASE}/analytics`)
    if (!response.ok) throw new Error('Failed to fetch analytics')
    return response.json()
  } catch {
    return {
      search_stats: {
        total_searches: 0,
        avg_response_time_ms: 0,
        avg_results: 0,
        top_queries: [],
      },
      recent_queries: [],
      top_queries: [],
    }
  }
}

export async function getCacheStatus(): Promise<{
  cache_size: number
  max_size: number
}> {
  try {
    const response = await fetch(`${API_BASE}/cache-status`)
    if (!response.ok) throw new Error('Failed to fetch cache status')
    return response.json()
  } catch {
    return { cache_size: 0, max_size: 0 }
  }
}

export async function clearCache(): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/cache-clear`, { method: 'POST' })
  if (!response.ok) throw new Error('Failed to clear cache')
  return response.json()
}
