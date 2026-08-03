'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, FileText, Send, ArrowRightCircle } from 'lucide-react'
import {
  PageHeader,
  Button,
  Badge,
  Input,
  toast,
} from '@/components/ui'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'
import { swrFetcher, apiClient } from '@/lib/api/apiClient'

type QuoteStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'

interface QuoteListItem extends Record<string, unknown> {
  id: string
  quoteNumber: string
  status: QuoteStatus
  total: number
  currency: string
  validUntil: string | null
  contactName: string | null
  createdAt: string
}

const STATUS_VARIANT: Record<QuoteStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'default',
  SENT: 'info',
  VIEWED: 'info',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'warning',
}

function formatMoney(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

function formatDate(v: string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString()
}

export function QuotesPageClient() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const queryKey = useMemo(() => {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (status) p.set('status', status)
    const qs = p.toString()
    return `/sales/quotes${qs ? `?${qs}` : ''}`
  }, [search, status])

  const { data, mutate, isLoading } = useSWR<{ items: QuoteListItem[] }>(queryKey, swrFetcher)
  const items = data?.items ?? []

  const columns: ColumnDef<QuoteListItem>[] = useMemo(
    () => [
      {
        id: 'number',
        header: 'Quote #',
        cell: ({ row }) => (
          <Link href={`/sales/quotes/new?id=${row.id}`} className="font-mono text-indigo-600 hover:underline">
            {row.quoteNumber}
          </Link>
        ),
      },
      { id: 'contact', header: 'Contact', cell: ({ row }) => row.contactName ?? '—' },
      {
        id: 'total',
        header: 'Total',
        cell: ({ row }) => formatMoney(row.total, row.currency),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>,
      },
      { id: 'valid', header: 'Valid until', cell: ({ row }) => formatDate(row.validUntil) },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={async (e) => {
                e.stopPropagation()
                try {
                  await apiClient.post(`/sales/quotes/${row.id}/send`)
                  toast.success('Quote sent')
                  mutate()
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Send failed')
                }
              }}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={async (e) => {
                e.stopPropagation()
                try {
                  const order = await apiClient.post<{ id: string }>(`/sales/quotes/${row.id}/convert`)
                  toast.success('Converted to order')
                  router.push(`/sales/orders/${order.id}`)
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Convert failed')
                }
              }}
            >
              <ArrowRightCircle className="h-3.5 w-3.5" />
            </Button>
            <a href={`/api/sales/quotes/${row.id}/pdf`} target="_blank" rel="noreferrer">
              <Button size="sm" variant="secondary" onClick={(e) => e.stopPropagation()}>
                <FileText className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>
        ),
      },
    ],
    [mutate, router],
  )

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Quotes"
        subtitle="Create and send sales quotations"
        breadcrumbs={[
          { label: 'Sales', href: '/sales/quotes' },
          { label: 'Quotes' },
        ]}
        actions={
          <Link href="/sales/quotes/new">
            <Button size="sm"><Plus className="mr-1 h-4 w-4" />New Quote</Button>
          </Link>
        }
      />
      <div className="flex-1 space-y-4 p-6">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search quotes…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <select
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {Object.keys(STATUS_VARIANT).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <Link href="/sales/orders"><Button variant="secondary" size="sm">View orders</Button></Link>
        </div>
        <DataTable columns={columns} data={items} loading={isLoading} keyField="id" />
      </div>
    </div>
  )
}
