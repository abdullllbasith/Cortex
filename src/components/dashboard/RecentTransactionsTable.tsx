'use client'

import { useState, useCallback } from 'react'
import { Download, Search, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge, Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'
import { PullToRefresh } from '@/components/mobile/PullToRefresh'
import { SwipeableRow } from '@/components/mobile/SwipeableRow'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { Transaction } from './types'
import { useExecutiveDashboard } from './ExecutiveDashboardProvider'

const statusConfig: Record<
  Transaction['status'],
  { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }
> = {
  paid:     { label: 'Paid',     variant: 'success' },
  pending:  { label: 'Pending',  variant: 'warning' },
  overdue:  { label: 'Overdue',  variant: 'danger'  },
  refunded: { label: 'Refunded', variant: 'default' },
}

function exportCSV(transactions: Transaction[]) {
  const headers = ['Transaction ID', 'Customer', 'Amount', 'Status', 'Items', 'Time']
  const rows = transactions.map((t) => [
    t.id,
    `"${t.customer}"`,
    `$${t.amount.toLocaleString()}`,
    t.status,
    t.items,
    t.time,
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function RecentTransactionsTable() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const { data, isLoading, mutate } = useExecutiveDashboard()
  const [search, setSearch] = useState('')

  const transactions = data?.transactions ?? []
  const filtered = search
    ? transactions.filter(
        (t) =>
          t.customer.toLowerCase().includes(search.toLowerCase()) ||
          t.id.toLowerCase().includes(search.toLowerCase()),
      )
    : transactions

  const handleExport = useCallback(() => exportCSV(filtered), [filtered])
  const handleRefresh = useCallback(async () => { await mutate() }, [mutate])

  const toolbar = (
    <div className="flex flex-col gap-3 border-b border-slate-100 dark:border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent Transactions</h2>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search transactions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search transactions"
            className={cn(
              'h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs sm:w-48',
              'text-slate-900 placeholder:text-slate-400 outline-none',
              'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
              'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500',
            )}
          />
        </div>
        {!isMobile && (
          <button
            type="button"
            onClick={handleExport}
            aria-label="Export transactions as CSV"
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium',
              'text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors',
              'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
            )}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export CSV
          </button>
        )}
        <button
          type="button"
          onClick={() => router.push('/knowledge/customers')}
          className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline dark:text-indigo-400 whitespace-nowrap"
        >
          View all <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
    </div>
  )

  const mobileList = (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800" role="list">
      {isLoading
        ? Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="p-4">
              <Skeleton height="14px" className="mb-2 w-2/3 rounded" />
              <Skeleton height="12px" className="w-1/2 rounded" />
            </li>
          ))
        : filtered.map((txn) => {
            const { label, variant } = statusConfig[txn.status]
            return (
              <li key={txn.id}>
                <SwipeableRow onEdit={() => router.push('/knowledge/customers')} onDelete={() => undefined}>
                  <div className="p-4">
                    <p className="font-mono text-xs font-medium text-indigo-600 dark:text-indigo-400">{txn.id}</p>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{txn.customer}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-display text-sm font-semibold tabular-nums">${txn.amount.toLocaleString()}</span>
                      <Badge variant={variant} size="sm">{label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{txn.time}</p>
                  </div>
                </SwipeableRow>
              </li>
            )
          })}
    </ul>
  )

  const desktopTable = (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px]" aria-label="Recent transactions">
        <thead>
          <tr className="border-b border-slate-50 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/20">
            {['Transaction', 'Customer', 'Amount', 'Status', 'Items', 'Time'].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton height="12px" className="rounded" /></td>
                  ))}
                </tr>
              ))
            : filtered.map((txn) => {
                const { label, variant } = statusConfig[txn.status]
                return (
                  <tr key={txn.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-indigo-600 dark:text-indigo-400">{txn.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">{txn.customer}</td>
                    <td className="px-4 py-3 font-display text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">${txn.amount.toLocaleString()}</td>
                    <td className="px-4 py-3"><Badge variant={variant} size="sm">{label}</Badge></td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 tabular-nums">{txn.items}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 tabular-nums">{txn.time}</td>
                  </tr>
                )
              })}
        </tbody>
      </table>
      {!isLoading && filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">No transactions match your search.</p>
      )}
    </div>
  )

  return (
    <div className="rounded-xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
      {toolbar}
      {isMobile ? (
        <PullToRefresh onRefresh={handleRefresh} className="max-h-[480px]">
          {mobileList}
          {!isLoading && filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">No transactions match your search.</p>
          )}
        </PullToRefresh>
      ) : (
        desktopTable
      )}
    </div>
  )
}
