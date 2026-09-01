import { create } from 'zustand'

export interface SearchFilters {
  query: string
  domain?: string
  page: number
  limit: number
  sortBy: 'relevance' | 'date'
}

export interface SearchResult {
  url: string
  title: string
  snippet: string
  score: number
  domain?: string
  crawlDate?: string
  source?: string
}

export interface AppState {
  // Search
  filters: SearchFilters
  setQuery: (query: string) => void
  setDomain: (domain?: string) => void
  setPage: (page: number) => void
  setSortBy: (sortBy: 'relevance' | 'date') => void
  resetFilters: () => void

  // Results
  results: SearchResult[]
  totalResults: number
  setResults: (results: SearchResult[], total: number) => void

  // Loading
  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  // Crawl progress
  isCrawling: boolean
  crawlProgress: number
  crawlMessage: string
  setCrawling: (crawling: boolean, progress?: number, message?: string) => void

  // Search history
  history: string[]
  addToHistory: (query: string) => void
  clearHistory: () => void

  // UI
  isDarkMode: boolean
  toggleDarkMode: () => void
  showFilters: boolean
  setShowFilters: (show: boolean) => void

  // Stats
  stats: {
    documents: number
    domains?: number
    embedding_model?: string
    index_size_mb?: number
    by_source?: Record<string, number>
    frontier_status?: Record<string, number>
    [key: string]: unknown
  } | null
  setStats: (stats: any) => void
}

export const useAppStore = create<AppState>((set, _get) => ({
  filters: { query: '', page: 1, limit: 10, sortBy: 'relevance' },
  setQuery: (query) => set((state) => ({ filters: { ...state.filters, query, page: 1 } })),
  setDomain: (domain) => set((state) => ({ filters: { ...state.filters, domain, page: 1 } })),
  setPage: (page) => set((state) => ({ filters: { ...state.filters, page } })),
  setSortBy: (sortBy) => set((state) => ({ filters: { ...state.filters, sortBy } })),
  resetFilters: () => set({ filters: { query: '', page: 1, limit: 10, sortBy: 'relevance' } }),

  results: [],
  totalResults: 0,
  setResults: (results, total) => set({ results, totalResults: total }),

  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  isCrawling: false,
  crawlProgress: 0,
  crawlMessage: '',
  setCrawling: (crawling, progress = 0, message = '') =>
    set({ isCrawling: crawling, crawlProgress: progress, crawlMessage: message }),

  history: JSON.parse(localStorage.getItem('searchHistory') || '[]'),
  addToHistory: (query) =>
    set((state) => {
      const newHistory = [query, ...state.history.filter((q) => q !== query)].slice(0, 10)
      localStorage.setItem('searchHistory', JSON.stringify(newHistory))
      return { history: newHistory }
    }),
  clearHistory: () => {
    localStorage.removeItem('searchHistory')
    set({ history: [] })
  },

  isDarkMode: localStorage.getItem('darkMode') === 'true',
  toggleDarkMode: () =>
    set((state) => {
      const newDarkMode = !state.isDarkMode
      localStorage.setItem('darkMode', String(newDarkMode))
      if (newDarkMode) document.documentElement.classList.add('dark')
      else document.documentElement.classList.remove('dark')
      return { isDarkMode: newDarkMode }
    }),
  showFilters: true,
  setShowFilters: (show) => set({ showFilters: show }),

  stats: null,
  setStats: (stats) => set({ stats }),
}))
