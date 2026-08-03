'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { Plus, Star, Truck } from 'lucide-react'
import Link from 'next/link'
import {
  PageHeader,
  Button,
  Input,
  EmptyState,
  Badge,
  Modal,
  toast,
} from '@/components/ui'
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'
import { apiClient, swrFetcher } from '@/lib/api/apiClient'
import { useDebounce } from '@/hooks/useDebounce'

interface SupplierRow extends Record<string, unknown> {
  id: string
  name: string
  code: string
  type: string
  contactEmail: string
  reliabilityStars: number
  performanceScore: number | null
  activePoCount: number
  paymentTerms: string
  lastOrderAt: string | null
  isActive: boolean
  updatedAt: string
}

const selectClass =
  'h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900'

const SUPPLIER_TYPES = ['MANUFACTURER', 'DISTRIBUTOR', 'WHOLESALER', 'SERVICE_PROVIDER'] as const
const PAYMENT_TERMS = ['IMMEDIATE', 'NET15', 'NET30', 'NET45', 'NET60'] as const

function ReliabilityStars({ stars }: { stars: number }) {
  const filled = Math.min(5, Math.max(0, stars))
  return (
    <div className="flex items-center gap-0.5" title={`${filled}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < filled ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
        />
      ))}
    </div>
  )
}

export function SuppliersKnowledgePageContent() {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 300)
  const [supplierType, setSupplierType] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [minScore, setMinScore] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')

  const listKey = useMemo(() => {
    const p = new URLSearchParams()
    p.set('limit', '50')

    if (debouncedSearch.trim().length >= 2) {
      p.set('type', 'supplier')
      p.set('search', debouncedSearch.trim())
      p.set('semantic', 'true')
      if (supplierType) p.set('supplierType', supplierType)
      if (paymentTerms) p.set('paymentTerms', paymentTerms)
      if (minScore) p.set('minScore', minScore)
      if (activeFilter === 'true') p.set('status', 'active')
      if (activeFilter === 'false') p.set('status', 'inactive')
      return `/knowledge?${p.toString()}`
    }

    if (debouncedSearch.trim()) p.set('search', debouncedSearch.trim())
    if (supplierType) p.set('supplierType', supplierType)
    if (paymentTerms) p.set('paymentTerms', paymentTerms)
    if (minScore) p.set('minScore', minScore)
    if (activeFilter === 'true') p.set('status', 'active')
    if (activeFilter === 'false') p.set('status', 'inactive')
    return `/knowledge/suppliers?${p.toString()}`
  }, [debouncedSearch, supplierType, paymentTerms, minScore, activeFilter])

  const { data, mutate, isLoading } = useSWR<{ data: SupplierRow[]; total: number }>(
    listKey,
    swrFetcher,
  )

  const tableData = data?.data ?? []
  const isSemantic = debouncedSearch.trim().length >= 2

  async function createSupplier() {
    if (!newName.trim()) {
      toast.error('Supplier name is required')
      return
    }
    try {
      await apiClient.post('/knowledge/suppliers', {
        name: newName.trim(),
        contactEmail: newEmail.trim() || undefined,
      })
      toast.success('Supplier created')
      setCreateOpen(false)
      setNewName('')
      setNewEmail('')
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create supplier')
    }
  }

  async function deleteSupplier(row: SupplierRow) {
    if (!window.confirm(`Delete supplier "${row.name}"?`)) return
    try {
      await apiClient.delete(`/knowledge/suppliers/${row.id}`)
      toast.success('Supplier deleted')
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const columns: ColumnDef<SupplierRow>[] = [
    { id: 'name', header: 'Name', accessorKey: 'name' },
    { id: 'code', header: 'Code', accessorKey: 'code' },
    {
      id: 'type',
      header: 'Type',
      cell: ({ row }) => String(row.type).replace(/_/g, ' '),
    },
    { id: 'contactEmail', header: 'Contact Email', accessorKey: 'contactEmail' },
    {
      id: 'reliability',
      header: 'Reliability',
      cell: ({ row }) => <ReliabilityStars stars={row.reliabilityStars ?? 0} />,
    },
    {
      id: 'activePos',
      header: 'Active POs',
      cell: ({ row }) => row.activePoCount,
    },
    {
      id: 'paymentTerms',
      header: 'Payment Terms',
      cell: ({ row }) => String(row.paymentTerms).replace('NET', 'Net '),
    },
    {
      id: 'lastOrder',
      header: 'Last Order',
      cell: ({ row }) =>
        row.lastOrderAt ? new Date(row.lastOrderAt).toLocaleDateString() : '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.isActive ? 'success' : 'default'} size="sm">
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Supplier Knowledge"
        subtitle="Supplier profiles for procurement and AI workflows"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Knowledge Base', href: '/knowledge' },
          { label: 'Suppliers' },
        ]}
        actions={(
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add Supplier
          </Button>
        )}
      />

      <ResponsiveContainer className="flex-1 space-y-4 py-6">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Semantic search suppliers…"
          aria-label="Supplier knowledge search"
        />

        <div className="flex flex-wrap gap-2">
          <select className={selectClass} value={supplierType} onChange={(e) => setSupplierType(e.target.value)}>
            <option value="">All types</option>
            {SUPPLIER_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select className={selectClass} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}>
            <option value="">All payment terms</option>
            {PAYMENT_TERMS.map((t) => (
              <option key={t} value={t}>{t.replace('NET', 'Net ')}</option>
            ))}
          </select>
          <Input
            type="number"
            min={0}
            max={100}
            placeholder="Min reliability %"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            className="w-40"
          />
          <select className={selectClass} value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          {isSemantic && <Badge variant="info" size="sm">AI search: {debouncedSearch}</Badge>}
        </div>

        {!isLoading && tableData.length === 0 ? (
          <EmptyState
            icon={<Truck />}
            title="No suppliers yet"
            description="Add your first supplier to the knowledge base."
            action={{ label: 'Add your first supplier', onClick: () => setCreateOpen(true) }}
          />
        ) : (
          <DataTable
            columns={columns}
            data={tableData}
            loading={isLoading}
            skeletonRowCount={8}
            keyField="id"
            onRowClick={(row) => router.push(`/knowledge/suppliers/${row.id}`)}
            rowActions={(row) => (
              <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                <Link href={`/knowledge/suppliers/${row.id}`} className="text-xs text-indigo-600 hover:underline">
                  Edit
                </Link>
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => void deleteSupplier(row)}
                >
                  Delete
                </button>
              </div>
            )}
            emptyTitle="No suppliers match your filters"
          />
        )}
      </ResponsiveContainer>

      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Add supplier"
        footer={(
          <>
            <Button variant="secondary" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={createSupplier}>Create</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Input label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <Input label="Contact email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}
