import { useAppStore } from '../store'

export function CrawlProgress() {
  const {
    isCrawling,
    crawlProgress,
    crawlMessage,
    crawlPagesFound,
    crawlPagesStored,
  } = useAppStore()

  if (!isCrawling) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Crawling in progress
        </h3>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {crawlMessage || 'Working...'}
        </p>

        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-blue-600 transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, crawlProgress))}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{crawlProgress}%</span>
          <span>
            {crawlPagesStored} stored · {crawlPagesFound} found
          </span>
        </div>
      </div>
    </div>
  )
}