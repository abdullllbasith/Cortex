'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { BarChart3, Package, DollarSign, TrendingUp, Target, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { swrFetcher } from '@/lib/api/apiClient'

interface CommandSuggestionsProps {
  onSelect: (text: string) => void
  className?: string
}

interface SuggestionItem {
  id: string
  text: string
  category: string
}

const CATEGORY_META: Record<string, { icon: typeof DollarSign; color: string }> = {
  Finance: { icon: DollarSign, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400' },
  Inventory: { icon: Package, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400' },
  CRM: { icon: Target, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-400' },
  Sales: { icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400' },
  Analytics: { icon: BarChart3, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400' },
}

const FALLBACK: SuggestionItem[] = [
  { id: 'pipeline', text: 'Summarize the sales pipeline', category: 'Sales' },
  { id: 'finance', text: 'Give me a financial summary for this month', category: 'Finance' },
  { id: 'stock', text: 'Which products are low on stock?', category: 'Inventory' },
  { id: 'briefing', text: 'Give me my daily executive briefing', category: 'Analytics' },
]

export function CommandSuggestions({ onSelect, className }: CommandSuggestionsProps) {
  const { data } = useSWR<{ suggestions: SuggestionItem[] }>('/assistant/suggestions', swrFetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 300_000,
  })

  const grouped = useMemo(() => {
    const items = data?.suggestions?.length ? data.suggestions : FALLBACK
    const map = new Map<string, SuggestionItem[]>()
    for (const s of items) {
      const list = map.get(s.category) ?? []
      list.push(s)
      map.set(s.category, list)
    }
    return [...map.entries()]
  }, [data])

  return (
    <div className={cn('space-y-6 max-w-2xl mx-auto', className)}>
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          How can I help you today?
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Suggestions update from live data — overdue invoices, low stock, and follow-ups.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {grouped.map(([category, suggestions]) => {
          const meta = CATEGORY_META[category] ?? CATEGORY_META.Analytics
          const Icon = meta.icon
          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={cn('p-1.5 rounded-md', meta.color)}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {category}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSelect(s.text)}
                    className="text-left text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 dark:hover:border-indigo-700 transition-colors"
                  >
                    {s.id.startsWith('overdue') || s.id === 'low-stock' ? (
                      <Sparkles className="inline h-3 w-3 mr-1 text-amber-500" />
                    ) : null}
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
