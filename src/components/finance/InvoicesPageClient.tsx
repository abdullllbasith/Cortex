'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Send,
  FileText,
  DollarSign,
  Copy,
  Ban,
  CreditCard,
} from 'lucide-react'
import {
  PageHeader,
  Button,
  Badge,
  Input,
  Card,
  CardBody,
  toast,
  ModalRoot,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  ModalClose,
} from '@/components/ui'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'
import { swrFetcher, apiClient } from '@/lib/api/apiClient'

type InvoiceStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'VOID' | 'CANCELLED'

type FilterTab = '' | 'DRAFT' | 'UNPAID' | 'OVERDUE' | 'PAID'

interface InvoiceListItem extends Record<string, unknown> {
  id: string
  invoiceNumber: string
  status: InvoiceStatus
  issueDate: string
  dueDate: string
  total: number
  amountPaid: number
  amountDue: number
  currency: string
  contactName: string | null
}

interface InvoiceSummary {
  unpaidTotal: number
  overdueTotal: number
  paidThisMonth: number
  avgDaysToPayment: number
}

interface AgingReport {
  buckets: Array<{ label: string; count: number; total: number }>
  totalOutstanding: number
}

const STATUS_VARIANT: Record<InvoiceStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'default',
  SENT: 'info',
  VIEWED: 'info',
  PARTIAL: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  VOID: 'default',
  CANCELLED: 'default',
}

const AGING_COLORS = ['#22c55e', '#eab308', '#f97316', '#ef4444']

const FILTER_TABS: Array<{ id: FilterTab; label: string }> = [
  { id: '', label: 'All' },
  { id: 'DRAFT', label: 'Draft' },
  { id: 'UNPAID', label: 'Unpaid' },
  { id: 'OVERDUE', label: 'Overdue' },
  { id: 'PAID', label: 'Paid' },
]

function formatMoney(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

function formatDate(v: string) {
  return new Date(v).toLocaleDateString()
}

export function InvoicesPageClient() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState<FilterTab>('')
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceListItem | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentSaving, setPaymentSaving] = useState(false)

  const queryKey = useMemo(() => {
    const p = new URLSearchParams()
    p.set('summary', 'true')
    if (search) p.set('search', search)
    if (statusTab) p.set('status', statusTab)
    return `/finance/invoices?${p.toString()}`
  }, [search, statusTab])

  const { data, mutate, isLoading } = useSWR<{
    items: InvoiceListItem[]
    summary?: InvoiceSummary
  }>(queryKey, swrFetcher)

  const { data: agingData } = useSWR<AgingReport>('/finance/ar-aging', swrFetcher)

  const items = data?.items ?? []
  const summary = data?.summary
  const aging = agingData?.buckets ?? []
  const agingMax = Math.max(...aging.map((b) => b.total), 1)

  const recordPayment = async () => {
    if (!paymentInvoice) return
    const amount = Number(paymentAmount)
    if (!amount || amount <= 0) {
      toast.error('Enter a valid payment amount')
      return
    }
    setPaymentSaving(true)
    try {
      await apiClient.post(`/finance/invoices/${paymentInvoice.id}/payment`, {
        amount,
        paymentMethod,
        reference: paymentReference || undefined,
        paymentDate: new Date().toISOString().slice(0, 10),
      })
      toast.success('Payment recorded')
      setPaymentInvoice(null)
      setPaymentAmount('')
      setPaymentReference('')
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setPaymentSaving(false)
    }
  }

  const columns: ColumnDef<InvoiceListItem>[] = useMemo(
    () => [
      {
        id: 'number',
        header: 'Invoice #',
        cell: ({ row }) => (
          <Link
            href={`/finance/invoices/new?id=${row.id}`}
            className="font-mono text-indigo-600 hover:underline"
          >
            {row.invoiceNumber}
          </Link>
        ),
      },
      { id: 'contact', header: 'Contact', cell: ({ row }) => row.contactName ?? '—' },
      { id: 'issue', header: 'Issue date', cell: ({ row }) => formatDate(row.issueDate) },
      { id: 'due', header: 'Due date', cell: ({ row }) => formatDate(row.dueDate) },
      {
        id: 'total',
        header: 'Total',
        cell: ({ row }) => formatMoney(row.total, row.currency),
      },
      {
        id: 'paid',
        header: 'Paid',
        cell: ({ row }) => formatMoney(row.amountPaid, row.currency),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const canPay = ['SENT', 'VIEWED', 'PARTIAL', 'OVERDUE'].includes(row.status)
          const canSend = row.status === 'DRAFT'
          const canVoid = !['VOID', 'CANCELLED', 'PAID'].includes(row.status) && row.amountPaid === 0

          return (
            <div className="flex flex-wrap gap-1">
              {canSend && (
                <Button
                  size="sm"
                  variant="secondary"
                  title="Send"
                  onClick={async (e) => {
                    e.stopPropagation()
                    try {
                      await apiClient.post(`/finance/invoices/${row.id}/send`)
                      toast.success('Invoice sent')
                      mutate()
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Send failed')
                    }
                  }}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              )}
              {canPay && (
                <Button
                  size="sm"
                  variant="secondary"
                  title="Record payment"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPaymentInvoice(row)
                    setPaymentAmount(String(row.amountDue))
                  }}
                >
                  <CreditCard className="h-3.5 w-3.5" />
                </Button>
              )}
              <a href={`/api/finance/invoices/${row.id}/pdf`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="secondary" title="Download PDF" onClick={(e) => e.stopPropagation()}>
                  <FileText className="h-3.5 w-3.5" />
                </Button>
              </a>
              <Button
                size="sm"
                variant="secondary"
                title="Duplicate"
                onClick={async (e) => {
                  e.stopPropagation()
                  try {
                    const dup = await apiClient.post<{ id: string }>(`/finance/invoices/${row.id}/duplicate`)
                    toast.success('Invoice duplicated')
                    router.push(`/finance/invoices/new?id=${dup.id}`)
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Duplicate failed')
                  }
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              {canVoid && (
                <Button
                  size="sm"
                  variant="ghost"
                  title="Void"
                  onClick={async (e) => {
                    e.stopPropagation()
                    const reason = window.prompt('Reason for voiding this invoice?')
                    if (!reason?.trim()) return
                    try {
                      await apiClient.post(`/finance/invoices/${row.id}/void`, { reason })
                      toast.success('Invoice voided')
                      mutate()
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Void failed')
                    }
                  }}
                >
                  <Ban className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )
        },
      },
    ],
    [mutate, router],
  )

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Invoices"
        subtitle="Accounts receivable and customer billing"
        breadcrumbs={[
          { label: 'Finance', href: '/finance' },
          { label: 'Invoices' },
        ]}
        actions={
          <div className="flex gap-2">
            <Link href="/finance/accounts">
              <Button variant="secondary" size="sm">Chart of Accounts</Button>
            </Link>
            <Link href="/finance/invoices/new">
              <Button size="sm"><Plus className="mr-1 h-4 w-4" />New Invoice</Button>
            </Link>
          </div>
        }
      />

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {summary && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Unpaid Total', value: formatMoney(summary.unpaidTotal), danger: false },
              { label: 'Overdue Total', value: formatMoney(summary.overdueTotal), danger: true },
              { label: 'Paid This Month', value: formatMoney(summary.paidThisMonth), danger: false },
              { label: 'Avg Days to Payment', value: `${summary.avgDaysToPayment} days`, danger: false },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardBody className="p-4">
                  <p className="text-xs text-slate-500">{kpi.label}</p>
                  <p className={`mt-1 text-xl font-semibold tabular-nums ${kpi.danger ? 'text-red-600' : ''}`}>
                    {kpi.value}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        {aging.length > 0 && (
          <Card>
            <CardBody className="space-y-4 p-4">
              <h3 className="text-sm font-semibold">AR Aging</h3>
              <div className="flex h-8 overflow-hidden rounded-lg">
                {aging.map((b, i) => {
                  const width = b.total > 0 ? Math.max((b.total / agingMax) * 100, 8) : 0
                  if (width <= 0) return null
                  return (
                    <div
                      key={b.label}
                      className="flex items-center justify-center text-[10px] font-medium text-white"
                      style={{ width: `${width}%`, backgroundColor: AGING_COLORS[i] ?? '#94a3b8' }}
                      title={`${b.label}: ${formatMoney(b.total)} (${b.count})`}
                    >
                      {width > 12 ? b.label : ''}
                    </div>
                  )
                })}
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                {aging.map((b, i) => (
                  <div
                    key={b.label}
                    className="rounded-lg border p-3 dark:border-slate-700"
                    style={{ borderLeftWidth: 4, borderLeftColor: AGING_COLORS[i] }}
                  >
                    <p className="text-xs text-slate-500">{b.label}</p>
                    <p className="text-lg font-semibold tabular-nums">{formatMoney(b.total)}</p>
                    <p className="text-xs text-slate-400">
                      {b.count} invoice{b.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-700">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusTab(tab.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  statusTab === tab.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <Input
            placeholder="Search invoices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>

        <DataTable columns={columns} data={items} loading={isLoading} emptyDescription="No invoices yet" />
      </div>

      <ModalRoot open={!!paymentInvoice} onOpenChange={(open) => !open && setPaymentInvoice(null)}>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Record payment</ModalTitle>
          </ModalHeader>
          <ModalBody className="space-y-4">
            {paymentInvoice && (
              <p className="text-sm text-slate-500">
                {paymentInvoice.invoiceNumber} — due {formatMoney(paymentInvoice.amountDue, paymentInvoice.currency)}
              </p>
            )}
            <div>
              <label className="text-xs font-medium text-slate-500">Amount</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Method</label>
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {['CASH', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'CREDIT'].map((m) => (
                  <option key={m} value={m}>{m.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Reference</label>
              <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Optional" />
            </div>
          </ModalBody>
          <ModalFooter>
            <ModalClose asChild>
              <Button variant="secondary" size="sm">Cancel</Button>
            </ModalClose>
            <Button size="sm" disabled={paymentSaving} onClick={() => void recordPayment()}>
              Record payment
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>
    </div>
  )
}
