import { useAppStore } from '../store'

export function SearchHistory() {
  const { history, setQuery, clearHistory } = useAppStore()

  if (history.length === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {history.slice(0, 5).map((query, i) => (
        <button
          key={i}
          onClick={() => setQuery(query)}
          className="px-3 py-1 rounded-full text-xs font-medium
            bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700
            text-zinc-600 dark:text-zinc-300
            hover:border-orange-300 hover:text-orange-600 dark:hover:text-orange-400
            transition-colors"
          title={query}
        >
          {query.length > 32 ? query.slice(0, 32) + '…' : query}
        </button>
      ))}
      <button
        onClick={clearHistory}
        className="text-xs text-zinc-400 hover:text-zinc-600 underline"
      >
        Clear
      </button>
    </div>
  )
}