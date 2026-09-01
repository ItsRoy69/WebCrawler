import { useEffect } from 'react'
import { useAppStore } from './store'
import { Header } from './components/Header'
import { SearchBar } from './components/SearchBar'
import { SearchHistory } from './components/SearchHistory'
import { FilterSidebar } from './components/FilterSidebar'
import { ResultsList } from './components/ResultsList'
import { CrawlProgress } from './components/CrawlProgress'
import { Analytics } from './components/Analytics'

function App() {
  const { isDarkMode } = useAppStore()

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors">
      <Header />

      <main className="max-w-6xl mx-auto px-4 pb-12">
        {/* Search Bar */}
        <div className="mb-8">
          <SearchBar />
        </div>

        {/* Search History */}
        <div className="mb-8">
          <SearchHistory />
        </div>

        {/* Main content: Filters + Results */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <FilterSidebar />

          {/* Results */}
          <div className="flex-1 min-w-0">
            <ResultsList />
          </div>
        </div>
      </main>

      {/* Crawl Progress Modal */}
      <CrawlProgress />

      {/* Analytics Dashboard (Phase 4) */}
      <Analytics />
    </div>
  )
}

export default App
