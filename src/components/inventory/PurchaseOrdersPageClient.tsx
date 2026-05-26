'use client'

import { useCallback, useMemo, useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { Plus, FileText, Clock, AlertTriangle, DollarSign } from 'lucide-react'
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
import { CreatePOModal } from '@/components/inventory/CreatePOModal'

type POStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACKNOWLEDGED'
  | 'PARTIAL'
  | 'RECEIVED'
  | 'CANCELLED'

interface POListItem extends Record<string, unknown> {
  id: string
  poNumber: string
  status: POStatus
  grandTotal: number
  currency: string
  expectedDelivery: string | null
  createdAt: string
  needsApproval: boolean
  approvalStatus: 'APPROVED' | 'PENDING' | 'NOT_REQUIRED'
  supplier: { id: string; name: string }
  warehouse: { id: string; name: string; code: string }
  approver: { fullName: string } | null
}

interface POListResponse {
  items: POListItem[]
  stats: {
    pendingApproval: number
    overdueDeliveries: number
    monthTotal: number
  }
}

interface PaginatedSuppliers {
  data: Array<{ id: string; name: string }>
}

const STATUS_VARIANT: Record<POStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'default',
  SENT: 'info',
  ACKNOWLEDGED: 'info',
  PARTIAL: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'danger',
}

const selectClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900'

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

function formatMoney(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export function PurchaseOrdersPageClient() {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [supplierId, setSupplierId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')

  const queryKey = useMemo(() => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (supplierId) params.set('supplierId', supplierId)
    if (warehouseId) params.set('warehouseId', warehouseId)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    if (search) params.set('search', search)
    const qs = params.toString()
    return `/inventory/purchase-orders${qs ? `?${qs}` : ''}`
  }, [status, supplierId, warehouseId, dateFrom, dateTo, search])

  const { data, mutate, isLoading } = useSWR<POListResponse>(queryKey, swrFetcher)
  const { data: suppliersData } = useSWR<PaginatedSuppliers>('/suppliers?limit=100', swrFetcher)
  const { data: warehouses = [] } = useSWR<Array<{ id: string; name: string; code: string }>>(
    '/inventory/warehouses',
    swrFetcher,
  )

  const items = data?.items ?? []
  const stats = data?.stats
  const suppliers = suppliersData?.data ?? []

  const onCreated = useCallback(() => {
    setCreateOpen(false)
    mutate()
    toast.success('Purchase order created')
  }, [mutate])

  const columns: ColumnDef<POListItem>[] = useMemo(
    () => [
      {
        id: 'poNumber',
        header: 'PO Number',
        accessorKey: 'poNumber',
        cell: ({ value }) => (
          <span className="font-medium text-indigo-600 dark:text-indigo-400">{String(value)}</span>
        ),
      },
      {
        id: 'supplier',
        header: 'Supplier',
        cell: ({ row }) => row.supplier.name,
      },
      {
        id: 'expectedDelivery',
        header: 'Expected Delivery',
        cell: ({ row }) => formatDate(row.expectedDelivery),
      },
      {
        id: 'grandTotal',
        header: 'Total',
        type: 'currency',
        cell: ({ row }) => formatMoney(row.grandTotal, row.currency),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.status]}>{row.status.replace('_', ' ')}</Badge>
        ),
      },
      {
        id: 'approval',
        header: 'Approval',
        cell: ({ row }) => {
          if (row.approvalStatus === 'NOT_REQUIRED') {
            return <span className="text-slate-400 text-sm">Not required</span>
          }
          if (row.approvalStatus === 'APPROVED') {
            return <Badge variant="success">Approved</Badge>
          }
          return <Badge variant="warning">Pending</Badge>
        },
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Purchase Orders"
        subtitle="Create, approve, and receive supplier purchase orders"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory', href: '/inventory/purchase-orders' },
          { label: 'Purchase Orders' },
        ]}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create PO
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardBody className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950 p-3">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Pending Approval</p>
                <p className="text-2xl font-semibold">{stats?.pendingApproval ?? 0}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-red-50 dark:bg-red-950 p-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Overdue Deliveries</p>
                <p className="text-2xl font-semibold">{stats?.overdueDeliveries ?? 0}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950 p-3">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">This Month&apos;s PO Total</p>
                <p className="text-2xl font-semibold">{formatMoney(stats?.monthTotal ?? 0)}</p>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <Input
                placeholder="Search PO or supplier…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="md:col-span-2"
              />
              <select
                className={selectClass}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                {Object.keys(STATUS_VARIANT).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className={selectClass}
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">All suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className={selectClass}
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">All warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>

            <DataTable
              columns={columns}
              data={items}
              loading={isLoading}
              keyField="id"
              onRowClick={(row) =>
                router.push(`/inventory/purchase-orders/${row.id}`)
              }
              emptyTitle="No purchase orders"
              emptyDescription="Create your first purchase order to start receiving inventory."
              rowActions={(row) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(
                      `/api/inventory/purchase-orders/${row.id}/pdf`,
                      '_blank',
                    )
                  }}
                >
                  <FileText className="h-4 w-4" />
                </Button>
              )}
            />
          </CardBody>
        </Card>
      </div>

      <CreatePOModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={onCreated}
        suppliers={suppliers}
        warehouses={warehouses}
      />
    </div>
  )
}
