import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getCrawlStatus, getStats } from './api'

export interface SearchResult {
  url: string
  title: string
  snippet: string
  score: number
  domain?: string
  source?: string
  crawlDate?: string
  crawl_date?: string
  author?: string
  publish_date?: string
  description?: string
  image_url?: string
}

interface Filters {
  query: string
  domain?: string
  sortBy: 'relevance' | 'date'
  page: number
  limit: number
}

interface Stats {
  documents: number
  embedding_model: string
  index_size_mb?: number
  by_source?: Record<string, number>
  frontier_status?: Record<string, number>
}

interface AppState {
  // UI
  isDarkMode: boolean
  toggleDarkMode: () => void
  showFilters: boolean
  setShowFilters: (v: boolean) => void

  // Filters (used by SearchBar, FilterSidebar, ResultsList, Pagination)
  filters: Filters
  setQuery: (q: string) => void
  setDomain: (domain?: string) => void
  setSortBy: (sort: 'relevance' | 'date') => void
  setPage: (page: number) => void

  // Results
  results: SearchResult[]
  totalResults: number
  isLoading: boolean
  setIsLoading: (v: boolean) => void
  setResults: (results: SearchResult[], total: number) => void

  // History
  history: string[]
  addToHistory: (q: string) => void
  clearHistory: () => void

  // Stats
  stats: Stats | null
  setStats: (s: Stats) => void
  fetchStats: () => Promise<void>

  // Crawl progress
  isCrawling: boolean
  crawlProgress: number
  crawlMessage: string
  crawlPagesFound: number
  crawlPagesStored: number
  currentJobId: string | null
  setCrawlJob: (jobId: string | null) => void
  pollCrawlStatus: (onComplete?: (error?: string | null) => void) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // UI
      isDarkMode: false,
      toggleDarkMode: () => set((s) => ({ isDarkMode: !s.isDarkMode })),
      showFilters: true,
      setShowFilters: (v) => set({ showFilters: v }),

      // Filters
      filters: {
        query: '',
        domain: undefined,
        sortBy: 'relevance',
        page: 1,
        limit: 10,
      },
      setQuery: (q) =>
        set((s) => ({
          filters: { ...s.filters, query: q, page: 1 },
        })),
      setDomain: (domain) =>
        set((s) => ({
          filters: { ...s.filters, domain, page: 1 },
        })),
      setSortBy: (sortBy) =>
        set((s) => ({
          filters: { ...s.filters, sortBy },
        })),
      setPage: (page) =>
        set((s) => ({
          filters: { ...s.filters, page },
        })),

      // Results
      results: [],
      totalResults: 0,
      isLoading: false,
      setIsLoading: (v) => set({ isLoading: v }),
      setResults: (results, total) =>
        set({ results, totalResults: total, isLoading: false }),

      // History
      history: [],
      addToHistory: (q) =>
        set((s) => {
          const next = [q, ...s.history.filter((x) => x !== q)].slice(0, 10)
          return { history: next }
        }),
      clearHistory: () => set({ history: [] }),

      // Stats
      stats: null,
      setStats: (s) => set({ stats: s }),
      fetchStats: async () => {
        try {
          const data = await getStats()
          set({ stats: data })
        } catch {
          // ignore
        }
      },

      // Crawl progress
      isCrawling: false,
      crawlProgress: 0,
      crawlMessage: '',
      crawlPagesFound: 0,
      crawlPagesStored: 0,
      currentJobId: null,

      setCrawlJob: (jobId) =>
        set({
          currentJobId: jobId,
          isCrawling: !!jobId,
          crawlProgress: jobId ? 5 : 0,
          crawlMessage: jobId ? 'Starting crawl...' : '',
        }),

      pollCrawlStatus: (onComplete) => {
        const { currentJobId } = get()
        if (!currentJobId) return

        const poll = async () => {
          const status = await getCrawlStatus(currentJobId)
          set({
            isCrawling: status.isCrawling,
            crawlProgress: status.progress,
            crawlMessage: status.message,
            crawlPagesFound: status.pagesFound,
            crawlPagesStored: status.pagesStored,
          })

          if (status.isCrawling) {
            setTimeout(poll, 1500)
          } else {
            set({ currentJobId: null, isCrawling: false })
            // Refresh stats after crawl
            get().fetchStats()
            onComplete?.(status.error)
          }
        }

        poll()
      },
    }),
    {
      name: 'webcrawler-storage',
      partialize: (s) => ({
        isDarkMode: s.isDarkMode,
        history: s.history,
      }),
    }
  )
)
