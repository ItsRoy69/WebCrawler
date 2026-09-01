import React, { useEffect } from 'react'
import { useAppStore } from '../store'
import { getCrawlStatus } from '../api'

export function CrawlProgress() {
  const { isCrawling, crawlProgress, crawlMessage, setCrawling } = useAppStore()
  const [pagesFound, setPagesFound] = React.useState(0)
  const [pagesStored, setPagesStored] = React.useState(0)

  useEffect(() => {
    if (!isCrawling) return

    const interval = setInterval(async () => {
      try {
        const status = await getCrawlStatus()
        if (!status.isCrawling) {
          setCrawling(false)
        } else {
          setCrawling(true, status.progress, status.message)
          setPagesFound(status.pagesFound)
          setPagesStored(status.pagesStored)
        }
      } catch (error) {
        // Ignore errors during polling
      }
    }, 500)

    return () => clearInterval(interval)
  }, [isCrawling, setCrawling])

  if (!isCrawling) return null

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md mx-4 shadow-lg">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-4">Crawling Site...</h2>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${crawlProgress}%` }}
            />
          </div>
          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">{crawlProgress}% complete</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-center">
          <div className="bg-gray-100 dark:bg-gray-800 rounded p-2">
            <p className="text-2xl font-bold text-blue-600">{pagesFound}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Pages Found</p>
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 rounded p-2">
            <p className="text-2xl font-bold text-green-600">{pagesStored}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Pages Stored</p>
          </div>
        </div>

        {/* Message */}
        {crawlMessage && (
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-2">{crawlMessage}</p>
        )}

        {/* Spinner */}
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    </div>
  )
}
