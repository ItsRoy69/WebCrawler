import type { SearchResult } from './store'

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
  job_id?: string | null
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
    let message = 'Search failed'
    try {
      const error = await response.json()
      message = error.detail || message
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  const data = await response.json()
  return {
    results: data.results || [],
    total: data.total || 0,
    crawled: data.crawled || false,
    cached: data.cached || false,
    job_id: data.job_id || null,
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

export async function getCrawlStatus(jobId?: string | null): Promise<{
  job_id: string | null
  isCrawling: boolean
  progress: number
  pagesFound: number
  pagesStored: number
  message: string
  error?: string | null
}> {
  try {
    const url = jobId
      ? `/api/crawl-status?job_id=${encodeURIComponent(jobId)}`
      : '/api/crawl-status'

    const response = await fetch(url)
    if (!response.ok) {
      return {
        job_id: null,
        isCrawling: false,
        progress: 0,
        pagesFound: 0,
        pagesStored: 0,
        message: '',
        error: null,
      }
    }
    return response.json()
  } catch {
    return {
      job_id: null,
      isCrawling: false,
      progress: 0,
      pagesFound: 0,
      pagesStored: 0,
      message: '',
      error: null,
    }
  }
}

export async function getAnalytics(): Promise<{
  search_stats: {
    total_searches: number
    avg_response_time_ms: number
    avg_results: number
    top_queries: Array<{ query: string; count: number }>
  }
  recent_queries: Array<{
    query: string
    result_count: number
    response_time_ms: number
  }>
  top_queries: Array<{ query: string; count: number }>
}> {
  try {
    const response = await fetch('/api/analytics')
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
    const response = await fetch('/api/cache-status')
    if (!response.ok) throw new Error('Failed to fetch cache status')
    return response.json()
  } catch {
    return { cache_size: 0, max_size: 0 }
  }
}

export async function clearCache(): Promise<{ status: string; message: string }> {
  const response = await fetch('/api/cache-clear', { method: 'POST' })
  if (!response.ok) throw new Error('Failed to clear cache')
  return response.json()
}
