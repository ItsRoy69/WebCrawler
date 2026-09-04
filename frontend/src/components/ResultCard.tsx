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
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="bg-amber-200/80 dark:bg-amber-500/30 text-inherit rounded px-0.5">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    )
  }

  let domain = result.url
  try {
    domain = new URL(result.url).hostname
  } catch {
    // keep raw
  }

  const dateStr = result.crawlDate || result.crawl_date
  const crawlDate = dateStr ? new Date(dateStr) : null
  const scorePct = result.score != null ? Math.round(result.score * 100) : null

  return (
    <article className="card group">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="min-w-0 flex-1">
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg font-semibold text-indigo-700 dark:text-indigo-400 hover:underline decoration-indigo-300 underline-offset-2 block truncate"
            title={result.title || result.url}
          >
            {result.title || result.url}
          </a>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-emerald-600 dark:text-emerald-400">{domain}</span>
            {result.source && <span>· {result.source}</span>}
            {crawlDate && !isNaN(crawlDate.getTime()) && (
              <span>· {formatDistanceToNow(crawlDate, { addSuffix: true })}</span>
            )}
          </div>
        </div>

        {scorePct != null && (
          <div className="shrink-0 flex items-center gap-2">
            <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
              {scorePct}%
            </span>
            <div className="w-14 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${Math.min(100, scorePct)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {result.snippet && (
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3 mt-2">
          {highlightQuery(result.snippet, query)}
        </p>
      )}

      <a
        href={result.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 truncate block mt-3 transition-colors"
      >
        {result.url}
      </a>
    </article>
  )
}