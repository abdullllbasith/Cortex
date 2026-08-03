'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { Spinner } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'

export interface KnowledgeSearchBarProps {
  onSearch: (query: string) => void
  loading?: boolean
  resultCount?: number
  placeholder?: string
  className?: string
}

export function KnowledgeSearchBar({
  onSearch,
  loading = false,
  resultCount,
  placeholder = 'Semantic search across customers, products, suppliers, documents…',
  className,
}: KnowledgeSearchBarProps) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    onSearch(debouncedQuery)
  }, [debouncedQuery, onSearch])

  const clear = useCallback(() => setQuery(''), [])

  return (
    <div className={cn('relative', className)}>
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Semantic knowledge search"
          className={cn(
            'h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-20 text-sm',
            'text-slate-900 placeholder:text-slate-400 outline-none',
            'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
            'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
          )}
        />
        <div className="absolute right-3 flex items-center gap-2">
          {loading && <Spinner size="sm" />}
          {resultCount != null && query && !loading && (
            <span className="text-xs text-slate-400">{resultCount} results</span>
          )}
          {query && (
            <button type="button" onClick={clear} aria-label="Clear search" className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
