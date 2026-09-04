import { useAppStore } from '../store'

export function SearchHistory() {
  const { history, setQuery, clearHistory } = useAppStore()

  if (history.length === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {history.slice(0, 6).map((query, i) => (
        <button
          key={i}
          onClick={() => setQuery(query)}
          className="chip"
          title={query}
        >
          {query.length > 28 ? query.slice(0, 28) + '…' : query}
        </button>
      ))}
      <button
        onClick={clearHistory}
        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline ml-1"
      >
        Clear
      </button>
    </div>
  )
}