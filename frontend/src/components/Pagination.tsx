import React from 'react'
import { useAppStore } from '../store'

interface PaginationProps {
  currentPage: number
  totalPages: number
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const { setPage } = useAppStore()

  const pages = []
  const range = 2 // Show 2 pages before and after current

  // First page
  if (currentPage > range + 1) pages.push(1)
  if (currentPage > range + 2) pages.push('...')

  // Range around current
  for (let i = Math.max(1, currentPage - range); i <= Math.min(totalPages, currentPage + range); i++) {
    pages.push(i)
  }

  // Last page
  if (currentPage < totalPages - range - 1) pages.push('...')
  if (currentPage < totalPages - range) pages.push(totalPages)

  return (
    <div className="flex items-center justify-center gap-2 mt-6 py-4">
      {/* Previous */}
      <button
        onClick={() => setPage(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ← Previous
      </button>

      {/* Page numbers */}
      <div className="flex gap-1">
        {pages.map((page, i) => (
          <React.Fragment key={i}>
            {page === '...' ? (
              <span className="px-2 py-1 text-gray-500">...</span>
            ) : (
              <button
                onClick={() => setPage(page as number)}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  page === currentPage
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-50 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {page}
              </button>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Next */}
      <button
        onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next →
      </button>
    </div>
  )
}
