'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Upload, Building2, Star, FileText, TrendingUp, Download } from 'lucide-react'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Badge,
  Input,
  toast,
} from '@/components/ui'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'
import { swrFetcher } from '@/lib/api/apiClient'

type SupplierType = 'MANUFACTURER' | 'DISTRIBUTOR' | 'WHOLESALER' | 'SERVICE_PROVIDER'
type PaymentTerms = 'IMMEDIATE' | 'NET15' | 'NET30' | 'NET45' | 'NET60'
type SortKey = 'name' | 'reliability' | 'lastOrder'

interface SupplierListItem {
  id: string
  code: string
  name: string
  type: SupplierType
  contactName: string
  email: string
  paymentTerms: PaymentTerms
  performanceScore: number
  reliabilityStars: number
  activePoCount: number
  lastOrderDate: string | null
  isActive: boolean
}

interface SupplierListResponse {
  items: SupplierListItem[]
  stats: {
    totalSuppliers: number
    activeSuppliers: number
    avgReliabilityScore: number
    posThisMonth: number
  }
}

const TYPE_VARIANT: Record<SupplierType, 'default' | 'info' | 'success' | 'warning'> = {
  MANUFACTURER: 'info',
  DISTRIBUTOR: 'default',
  WHOLESALER: 'success',
  SERVICE_PROVIDER: 'warning',
}

const CSV_TEMPLATE = `name,type,contactName,email,phone,paymentTerms,currency
Acme Supplies,DISTRIBUTOR,Jane Doe,jane@acme.com,+15551234567,NET30,USD
`

const selectClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900'

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

function StarRating({ score }: { score: number }) {
  const stars = Math.round(score * 2) / 2
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i + 1 <= stars ? 'fill-current' : i + 0.5 === stars ? 'fill-current opacity-50' : 'opacity-25'}`}
        />
      ))}
      <span className="ml-1 text-xs text-slate-500">{score.toFixed(1)}</span>
    </span>
  )
}

export function SuppliersPageClient() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [minScore, setMinScore] = useState('')
  const [maxScore, setMaxScore] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState<SortKey>('name')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [importing, setImporting] = useState(false)

  const queryKey = useMemo(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (type) params.set('type', type)
    if (paymentTerms) params.set('paymentTerms', paymentTerms)
    if (minScore) params.set('minScore', minScore)
    if (maxScore) params.set('maxScore', maxScore)
    if (status !== 'all') params.set('status', status)
    params.set('sort', sort)
    params.set('order', order)
    return `/inventory/suppliers?${params.toString()}`
  }, [search, type, paymentTerms, minScore, maxScore, status, sort, order])

  const { data, mutate, isLoading } = useSWR<SupplierListResponse>(queryKey, swrFetcher)

  const items = data?.items ?? []
  const stats = data?.stats

  const downloadTemplate = useCallback(() => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'suppliers-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleImport = useCallback(async (file: File) => {
    setImporting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/inventory/suppliers/import', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Import failed')
      toast.success(`Imported ${json.data.imported} supplier(s)`)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }, [mutate])

  const columns: ColumnDef<SupplierListItem>[] = useMemo(
    () => [
      {
        id: 'code',
        header: 'Code',
        accessorKey: 'code',
        cell: ({ value }) => <span className="font-mono text-xs text-slate-500">{String(value)}</span>,
      },
      {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        cell: ({ value, row }) => (
          <span className="font-medium text-indigo-600 dark:text-indigo-400">{String(value)}</span>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <Badge variant={TYPE_VARIANT[row.type]}>{row.type.replace('_', ' ')}</Badge>
        ),
      },
      {
        id: 'contact',
        header: 'Primary Contact',
        cell: ({ row }) => (
          <div className="text-sm">
            <div>{row.contactName || '—'}</div>
            {row.email && <div className="text-xs text-slate-500">{row.email}</div>}
          </div>
        ),
      },
      {
        id: 'paymentTerms',
        header: 'Payment Terms',
        cell: ({ row }) => row.paymentTerms.replace('NET', 'Net '),
      },
      {
        id: 'score',
        header: 'Reliability',
        cell: ({ row }) => <StarRating score={row.reliabilityStars} />,
      },
      {
        id: 'activePos',
        header: 'Active POs',
        cell: ({ row }) => row.activePoCount,
      },
      {
        id: 'lastOrder',
        header: 'Last Order Date',
        cell: ({ row }) => formatDate(row.lastOrderDate),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.isActive ? 'success' : 'default'}>
            {row.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-5 p-5 lg:p-6">
      <PageHeader
        title="Suppliers"
        description="Manage supplier master data, contacts, and performance"
        breadcrumbs={[
          { label: 'Inventory', href: '/inventory' },
          { label: 'Suppliers' },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleImport(file)
                e.target.value = ''
              }}
            />
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Template
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
            <Link href="/inventory/suppliers/new">
              <Button><Plus className="mr-2 h-4 w-4" />Add Supplier</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardBody className="flex items-center gap-3 p-4">
            <Building2 className="h-8 w-8 text-indigo-500" />
            <div>
              <p className="text-xs text-slate-500">Total Suppliers</p>
              <p className="text-2xl font-semibold">{stats?.totalSuppliers ?? '—'}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3 p-4">
            <TrendingUp className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-xs text-slate-500">Active Suppliers</p>
              <p className="text-2xl font-semibold">{stats?.activeSuppliers ?? '—'}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3 p-4">
            <Star className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-xs text-slate-500">Avg Reliability Score</p>
              <p className="text-2xl font-semibold">{stats?.avgReliabilityScore ?? '—'}%</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3 p-4">
            <FileText className="h-8 w-8 text-sky-500" />
            <div>
              <p className="text-xs text-slate-500">POs This Month</p>
              <p className="text-2xl font-semibold">{stats?.posThisMonth ?? '—'}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-8">
            <Input
              className="md:col-span-2"
              placeholder="Search name, code, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className={selectClass} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              <option value="MANUFACTURER">Manufacturer</option>
              <option value="DISTRIBUTOR">Distributor</option>
              <option value="WHOLESALER">Wholesaler</option>
              <option value="SERVICE_PROVIDER">Service Provider</option>
            </select>
            <select className={selectClass} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}>
              <option value="">All payment terms</option>
              <option value="IMMEDIATE">Immediate</option>
              <option value="NET15">Net 15</option>
              <option value="NET30">Net 30</option>
              <option value="NET45">Net 45</option>
              <option value="NET60">Net 60</option>
            </select>
            <Input type="number" placeholder="Min reliability %" value={minScore} onChange={(e) => setMinScore(e.target.value)} />
            <Input type="number" placeholder="Max reliability %" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
            <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              className={selectClass}
              value={`${sort}:${order}`}
              onChange={(e) => {
                const [s, o] = e.target.value.split(':') as [SortKey, 'asc' | 'desc']
                setSort(s)
                setOrder(o)
              }}
            >
              <option value="name:asc">Name A→Z</option>
              <option value="name:desc">Name Z→A</option>
              <option value="reliability:desc">Reliability high→low</option>
              <option value="reliability:asc">Reliability low→high</option>
              <option value="lastOrder:desc">Last order newest</option>
              <option value="lastOrder:asc">Last order oldest</option>
            </select>
          </div>

          <DataTable
            columns={columns}
            data={items}
            loading={isLoading}
            keyField="id"
            skeletonRowCount={8}
            onRowClick={(row) => router.push(`/inventory/suppliers/${(row as SupplierListItem).id}`)}
            rowActions={(row) => (
              <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                <Link
                  href={`/inventory/suppliers/${row.id}`}
                  className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  View
                </Link>
                <Link
                  href={`/inventory/suppliers/${row.id}`}
                  className="text-xs text-slate-600 hover:underline"
                >
                  Edit
                </Link>
              </div>
            )}
            emptyTitle="No suppliers match your filters"
          />
        </CardBody>
      </Card>
    </div>
  )
}
