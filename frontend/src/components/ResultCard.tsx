import React from 'react'
import type { SearchResult } from '../store'
import { formatDistanceToNow } from 'date-fns'

interface ResultCardProps {
  result: SearchResult
  query?: string
}

export function ResultCard({ result, query }: ResultCardProps) {
  const highlightQuery = (text: string, q?: string): React.ReactNode => {
    if (!q || !text) return text

    const parts = text.split(new RegExp(`(${q})`, 'gi'))
    return parts.map((part, i) => (
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 font-semibold">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    ))
  }

  const domain = new URL(result.url).hostname || result.url
  const crawlDate = result.crawlDate ? new Date(result.crawlDate) : null

  return (
    <article className="card">
      {/* Header with domain and score */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg font-semibold text-blue-600 dark:text-blue-400 hover:underline block truncate"
            title={result.title || result.url}
          >
            {result.title || result.url}
          </a>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {domain} {result.source && `• ${result.source}`}
            {crawlDate && ` • ${formatDistanceToNow(crawlDate, { addSuffix: true })}`}
          </p>
        </div>
        {result.score && (
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {(result.score * 100).toFixed(0)}%
            </span>
            <div className="w-12 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500"
                style={{ width: `${result.score * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Snippet */}
      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 leading-relaxed">
        {highlightQuery(result.snippet, query)}
      </p>

      {/* URL */}
      <a
        href={result.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 truncate block mt-2"
      >
        {result.url}
      </a>
    </article>
  )
}
