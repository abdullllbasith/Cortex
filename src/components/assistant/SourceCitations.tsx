'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, BookOpen, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SemanticSearchResult } from '@/lib/embeddings/semanticSearch'

interface SourceCitationsProps {
  sources: SemanticSearchResult[]
}

const ENTITY_COLORS: Record<string, string> = {
  customer: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  product: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  supplier: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
  knowledge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400',
}

export function SourceCitations({ sources }: SourceCitationsProps) {
  const [open, setOpen] = useState(false)

  if (!sources.length) return null

  return (
    <div className="mt-3 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" />
          {sources.length} source{sources.length !== 1 ? 's' : ''} used
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
          {sources.map((source, i) => (
            <li key={`${source.id}-${i}`} className="px-3 py-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase',
                        ENTITY_COLORS[source.entityType] ?? 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {source.entityType}
                    </span>
                    <span className="text-slate-400">
                      {Math.round(source.similarity * 100)}% match
                    </span>
                  </div>
                  <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                    {source.title}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                    {source.snippet}
                  </p>
                </div>
                <a
                  href={`/knowledge/${source.entityType === 'knowledge' ? 'documents' : `${source.entityType}s`}/${source.id}`}
                  className="shrink-0 p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                  title="View in Knowledge Engine"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
