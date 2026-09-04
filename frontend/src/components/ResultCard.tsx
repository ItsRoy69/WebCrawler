import React from 'react'
import type { SearchResult } from '../store'
import { formatDistanceToNow } from 'date-fns'

interface ResultCardProps {
  result: SearchResult
  query?: string
}

export function ResultCard({ result, query }: ResultCardProps) {
  const highlight = (text: string, q?: string): React.ReactNode => {
    if (!q || !text) return text
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return text.split(new RegExp(`(${safe})`, 'gi')).map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="bg-violet-100 dark:bg-violet-900/40 text-inherit rounded px-0.5">
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
  } catch { /* keep */ }

  const dateStr = result.crawlDate || result.crawl_date
  const crawlDate = dateStr ? new Date(dateStr) : null
  const scorePct = result.score != null ? Math.round(result.score * 100) : null

  return (
    <article className="card !p-4 hover:border-violet-200 dark:hover:border-violet-900/50">
      <a
        href={result.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-base font-semibold text-zinc-900 dark:text-zinc-50 hover:text-violet-600 dark:hover:text-violet-400 transition-colors block truncate"
      >
        {result.title || result.url}
      </a>

      <div className="flex flex-wrap items-center gap-x-2 mt-1 text-xs text-zinc-500">
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{domain}</span>
        {crawlDate && !isNaN(crawlDate.getTime()) && (
          <span>· {formatDistanceToNow(crawlDate, { addSuffix: true })}</span>
        )}
        {scorePct != null && <span>· {scorePct}% match</span>}
      </div>

      {result.snippet && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed line-clamp-2">
          {highlight(result.snippet, query)}
        </p>
      )}
    </article>
  )
}
