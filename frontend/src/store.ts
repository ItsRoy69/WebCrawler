import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session } from '@supabase/supabase-js'
import { getCrawlStatus, getStats } from './api'
import {
  profileFromSession,
  signOut as supabaseSignOut,
  type AuthProfile,
} from './lib/auth'

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

// Rebuilt from the Supabase session on every load; never trusted for
// authorization, since the API re-verifies the access token.
export type UserProfile = AuthProfile

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
  playgroundHistory: string[]
  addToPlaygroundHistory: (url: string) => void

  // Auth (mirrors the Supabase session)
  user: UserProfile | null
  isAuthReady: boolean
  setUser: (user: UserProfile | null) => void
  setAuthReady: (ready: boolean) => void
  applySession: (session: Session | null) => void
  signOut: () => Promise<void>

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
  crawlError: string | null
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
      playgroundHistory: [],
      addToPlaygroundHistory: (url) =>
        set((s) => ({
          playgroundHistory: [url, ...s.playgroundHistory.filter((x) => x !== url)].slice(0, 10),
        })),

      // Auth
      user: null,
      isAuthReady: false,
      setUser: (user) => set({ user }),
      setAuthReady: (isAuthReady) => set({ isAuthReady }),
      applySession: (session) => set({ user: profileFromSession(session) }),
      signOut: async () => {
        await supabaseSignOut()
        // Clear local history too, so a shared browser does not leak one
        // person's queries to the next person who signs in.
        set({ user: null, history: [], playgroundHistory: [] })
      },

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
      crawlError: null,
      currentJobId: null,

      setCrawlJob: (jobId) =>
        set({
          currentJobId: jobId,
          isCrawling: !!jobId,
          crawlProgress: jobId ? 5 : 0,
          crawlMessage: jobId ? 'Starting crawl...' : '',
          crawlError: null,
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
            crawlError: status.error || null,
          })

          if (status.isCrawling) {
            setTimeout(poll, 1500)
          } else {
            set({ currentJobId: null, isCrawling: false, crawlError: status.error || null })
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
      // `user` is not persisted: a stale copy in localStorage would outlive a
      // revoked account.
      partialize: (s) => ({
        isDarkMode: s.isDarkMode,
        history: s.history,
        playgroundHistory: s.playgroundHistory,
      }),
      version: 1,
      migrate: (persisted: unknown) => {
        // v0 stored a fabricated `user` from the pre-Supabase demo sign-in.
        // Drop it so nobody appears signed in without a session.
        const state = (persisted as { state?: Record<string, unknown> } | undefined)?.state
        if (state && 'user' in state) {
          delete state.user
          if (Array.isArray(state.history)) state.history = []
          if (Array.isArray(state.playgroundHistory)) state.playgroundHistory = []
        }
        return persisted
      },
    }
  )
)

