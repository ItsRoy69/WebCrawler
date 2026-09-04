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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
            <div className="h-5 w-5 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Crawling in progress
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {crawlMessage || 'Working…'}
            </p>
          </div>
        </div>

        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, crawlProgress))}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium tabular-nums">{crawlProgress}%</span>
          <span>
            {crawlPagesStored} stored · {crawlPagesFound} found
          </span>
        </div>
      </div>
    </div>
  )
}