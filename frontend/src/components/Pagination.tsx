import { useAppStore } from '../store'

interface PaginationProps {
  currentPage: number
  totalPages: number
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const { setPage } = useAppStore()
  const pages: (number | string)[] = []
  const range = 2

  if (currentPage > range + 1) pages.push(1)
  if (currentPage > range + 2) pages.push('...')

  for (let i = Math.max(1, currentPage - range); i <= Math.min(totalPages, currentPage + range); i++) {
    pages.push(i)
  }

  if (currentPage < totalPages - range - 1) pages.push('...')
  if (currentPage < totalPages - range) pages.push(totalPages)

  return (
    <div className="flex items-center justify-center gap-2 mt-8 pt-4 border-t border-slate-200 dark:border-slate-800">
      <button
        onClick={() => setPage(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="btn-secondary"
      >
        Previous
      </button>

      <div className="flex gap-1">
        {pages.map((page, i) =>
          page === '...' ? (
            <span key={i} className="px-2 py-1 text-slate-400">…</span>
          ) : (
            <button
              key={i}
              onClick={() => setPage(page as number)}
              className={`min-w-[2.25rem] h-9 rounded-xl text-sm font-medium transition-colors ${
                page === currentPage
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {page}
            </button>
          )
        )}
      </div>

      <button
        onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="btn-secondary"
      >
        Next
      </button>
    </div>
  )
}
