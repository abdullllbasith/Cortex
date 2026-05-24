'use client'

import { BarChart3, Package, DollarSign, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommandSuggestionsProps {
  onSelect: (text: string) => void
  className?: string
}

const CATEGORIES = [
  {
    label: 'Sales',
    icon: TrendingUp,
    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400',
    suggestions: [
      'Show top customers this month',
      'What deals are at risk of closing?',
      'Summarize sales pipeline status',
    ],
  },
  {
    label: 'Inventory',
    icon: Package,
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400',
    suggestions: [
      'Which products are low on stock?',
      'Add 50 items to inventory for top product',
      'Show inventory levels across all products',
    ],
  },
  {
    label: 'Finance',
    icon: DollarSign,
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400',
    suggestions: [
      'Give me a financial summary for this quarter',
      'What are our top revenue drivers?',
      'Show outstanding invoices',
    ],
  },
  {
    label: 'Analytics',
    icon: BarChart3,
    color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400',
    suggestions: [
      'Generate an executive dashboard report',
      'Forecast demand for next month',
      'Compare supplier performance metrics',
    ],
  },
] as const

export function CommandSuggestions({ onSelect, className }: CommandSuggestionsProps) {
  return (
    <div className={cn('space-y-6 max-w-2xl mx-auto', className)}>
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          How can I help you today?
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Ask anything about your business — I have access to your knowledge base.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CATEGORIES.map((cat) => (
          <div key={cat.label} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={cn('p-1.5 rounded-md', cat.color)}>
                <cat.icon className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {cat.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {cat.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSelect(s)}
                  className="text-left text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 dark:hover:border-indigo-700 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
