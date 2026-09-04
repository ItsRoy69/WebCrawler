import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { search as apiSearch, getCrawlStatus, getStats } from './api'

export interface SearchResult {
  url: string
  title: string
  snippet: string
  score: number
  domain?: string
  source?: string
  crawl_date?: string
  author?: string
  publish_date?: string
  description?: string
  image_url?: string
}

interface AppState {
  // UI
  isDarkMode: boolean
  toggleDarkMode: () => void

  // Search
  query: string
  setQuery: (q: string) => void
  results: SearchResult[]
  total: number
  loading: boolean
  error: string | null
  offset: number
  limit: number
  domainFilter: string | null
  sortBy: 'relevance' | 'date'

  // Crawl progress
  isCrawling: boolean
  crawlProgress: number
  crawlMessage: string
  crawlPagesFound: number
  crawlPagesStored: number
  currentJobId: string | null

  // History
  searchHistory: string[]
  addToHistory: (q: string) => void
  clearHistory: () => void

  // Stats
  documentCount: number
  embeddingModel: string

  // Actions
  setDomainFilter: (domain: string | null) => void
  setSortBy: (sort: 'relevance' | 'date') => void
  setOffset: (offset: number) => void
  doSearch: (q?: string) => Promise<void>
  pollCrawlStatus: () => Promise<void>
  fetchStats: () => Promise<void>
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      isDarkMode: false,
      toggleDarkMode: () => set((s) => ({ isDarkMode: !s.isDarkMode })),

      query: '',
      setQuery: (q) => set({ query: q }),
      results: [],
      total: 0,
      loading: false,
      error: null,
      offset: 0,
      limit: 10,
      domainFilter: null,
      sortBy: 'relevance',

      isCrawling: false,
      crawlProgress: 0,
      crawlMessage: '',
      crawlPagesFound: 0,
      crawlPagesStored: 0,
      currentJobId: null,

      searchHistory: [],
      addToHistory: (q) =>
        set((s) => {
          const next = [q, ...s.searchHistory.filter((x) => x !== q)].slice(0, 10)
          return { searchHistory: next }
        }),
      clearHistory: () => set({ searchHistory: [] }),

      documentCount: 0,
      embeddingModel: 'hashing-v1',

      setDomainFilter: (domain) => set({ domainFilter: domain, offset: 0 }),
      setSortBy: (sort) => set({ sortBy: sort }),
      setOffset: (offset) => set({ offset }),

      doSearch: async (q) => {
        const state = get()
        const query = (q ?? state.query).trim()
        if (!query) return

        set({
          loading: true,
          error: null,
          query,
          offset: q ? 0 : state.offset,
        })

        try {
          const data = await apiSearch(
            query,
            state.limit,
            q ? 0 : state.offset,
            state.domainFilter || undefined,
            0.5,
            100,
            true
          )

          set({
            results: data.results,
            total: data.total,
            loading: false,
            currentJobId: data.job_id || null,
            isCrawling: !!data.job_id,
          })

          get().addToHistory(query)

          // Start polling if a crawl was triggered
          if (data.job_id) {
            get().pollCrawlStatus()
          }
        } catch (err: any) {
          set({
            loading: false,
            error: err?.message || 'Search failed',
            results: [],
            total: 0,
          })
        }
      },

      pollCrawlStatus: async () => {
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
            // Crawl finished → refresh results + stats
            set({ currentJobId: null })
            const state = get()
            if (state.query) {
              await get().doSearch(state.query)
            }
            await get().fetchStats()
          }
        }

        poll()
      },

      fetchStats: async () => {
        try {
          const stats = await getStats()
          set({
            documentCount: stats.documents || 0,
            embeddingModel: stats.embedding_model || 'hashing-v1',
          })
        } catch {
          // ignore
        }
      },
    }),
    {
      name: 'webcrawler-storage',
      partialize: (s) => ({
        isDarkMode: s.isDarkMode,
        searchHistory: s.searchHistory,
      }),
    }
  )
)