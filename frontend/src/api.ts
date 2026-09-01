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
): Promise<{ results: SearchResult[]; total: number; crawled: boolean }> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
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
    total: data.results?.length || 0,
    crawled: data.crawled || false,
  }
}

export async function getStats(): Promise<{
  documents: number
  embedding_model: string
  index_size_mb?: number
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
    if (!response.ok) return { isCrawling: false, progress: 0, pagesFound: 0, pagesStored: 0, message: '' }
    return response.json()
  } catch {
    return { isCrawling: false, progress: 0, pagesFound: 0, pagesStored: 0, message: '' }
  }
}
