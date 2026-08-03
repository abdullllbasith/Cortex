'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Mail,
  PackageCheck,
  ShieldCheck,
  FileText,
} from 'lucide-react'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Badge,
  Input,
  toast,
} from '@/components/ui'
import { swrFetcher, apiClient } from '@/lib/api/apiClient'
import { BarcodeScanner, type BarcodeScanResult } from '@/components/inventory/BarcodeScanner'

type POStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACKNOWLEDGED'
  | 'PARTIAL'
  | 'RECEIVED'
  | 'CANCELLED'

interface POItemRow {
  productId: string
  quantity: number
  quantityReceived: number
  unitCost: number
  taxRate: number
  totalCost: number
  product: { id: string; sku: string; name: string; unit: string } | null
}

interface PODetail {
  id: string
  poNumber: string
  status: POStatus
  subtotal: number
  taxTotal: number
  shippingCost: number
  grandTotal: number
  currency: string
  expectedDelivery: string | null
  terms: string | null
  notes: string | null
  sentAt: string | null
  approvedAt: string | null
  createdAt: string
  needsApproval: boolean
  approvalRule: { requiredApproverRole: string } | null
  supplierEmail: string | null
  supplier: { id: string; name: string }
  warehouse: { id: string; name: string; code: string; address: unknown }
  creator: { fullName: string } | null
  approver: { fullName: string } | null
  items: POItemRow[]
  timeline: Array<{
    id: string
    action: string
    timestamp: string
    user: { fullName: string } | null
    newValue: Record<string, unknown> | null
  }>
  receipts: Array<{
    id: string
    receiptNumber: string
    receivedAt: string | null
    receiver: { fullName: string } | null
  }>
}

const STEPS: POStatus[] = ['DRAFT', 'SENT', 'ACKNOWLEDGED', 'PARTIAL', 'RECEIVED']

function formatMoney(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function stepIndex(status: POStatus): number {
  if (status === 'CANCELLED') return -1
  if (status === 'PARTIAL') return STEPS.indexOf('PARTIAL')
  if (status === 'RECEIVED') return STEPS.indexOf('RECEIVED')
  return STEPS.indexOf(status)
}

interface ReceiveDraft {
  quantityReceived: number
  batchNumber: string
  expiryDate: string
}

export function PurchaseOrderDetailClient({ poId }: { poId: string }) {
  const { data: po, mutate, isLoading } = useSWR<PODetail>(
    `/inventory/purchase-orders/${poId}`,
    swrFetcher,
  )

  const { data: poBills, mutate: mutateBills } = useSWR<{ items: Array<{ id: string; billNumber: string; status: string }> }>(
    `/finance/bills?purchaseOrderId=${poId}`,
    swrFetcher,
  )

  const [highlightLine, setHighlightLine] = useState<number | null>(null)
  const [receiveDrafts, setReceiveDrafts] = useState<Record<number, ReceiveDraft>>({})
  const [receiving, setReceiving] = useState(false)

  const currentStep = po ? stepIndex(po.status) : 0
  const canReceive = po && ['SENT', 'ACKNOWLEDGED', 'PARTIAL'].includes(po.status)
  const hasReceivedItems = po?.items.some((i) => i.quantityReceived > 0) ?? false
  const canCreateBill = hasReceivedItems && po && !['DRAFT', 'CANCELLED'].includes(po.status)

  const initReceiveDraft = useCallback((items: POItemRow[]) => {
    const draft: Record<number, ReceiveDraft> = {}
    items.forEach((item, index) => {
      const remaining = item.quantity - item.quantityReceived
      draft[index] = {
        quantityReceived: remaining > 0 ? remaining : 0,
        batchNumber: '',
        expiryDate: '',
      }
    })
    setReceiveDrafts(draft)
  }, [])

  useEffect(() => {
    if (po?.items) initReceiveDraft(po.items)
  }, [po?.items, initReceiveDraft])

  const action = async (path: string, successMessage: string) => {
    const res = await fetch(path, { method: 'POST', credentials: 'include' })
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error?.message ?? 'Action failed')
      return false
    }
    toast.success(successMessage)
    mutate()
    return true
  }

  const handleApprove = () =>
    action(`/api/inventory/purchase-orders/${poId}/approve`, 'Purchase order approved')

  const handleSend = () =>
    action(`/api/inventory/purchase-orders/${poId}/send`, 'Purchase order sent to supplier')

  const handleReceive = async () => {
    if (!po) return
    const items = po.items
      .map((item, index) => {
        const draft = receiveDrafts[index]
        if (!draft || draft.quantityReceived <= 0) return null
        const remaining = item.quantity - item.quantityReceived
        if (draft.quantityReceived > remaining) return null
        return {
          poItemIndex: index,
          quantityReceived: draft.quantityReceived,
          batchNumber: draft.batchNumber || null,
          expiryDate: draft.expiryDate || null,
        }
      })
      .filter(Boolean)

    if (!items.length) {
      toast.error('Enter quantity to receive for at least one line')
      return
    }

    setReceiving(true)
    try {
      const res = await fetch(`/api/inventory/purchase-orders/${poId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed to record receipt')
        return
      }
      toast.success('Goods receipt recorded')
      mutate()
      mutateBills()
    } finally {
      setReceiving(false)
    }
  }

  if (isLoading) {
    return <div className="p-6 text-slate-500">Loading purchase order…</div>
  }

  if (!po) {
    return <div className="p-6 text-slate-500">Purchase order not found.</div>
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={po.poNumber}
        subtitle={`${po.supplier.name} · ${po.warehouse.name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Purchase Orders', href: '/inventory/purchase-orders' },
          { label: po.poNumber },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/inventory/purchase-orders">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <a href={`/api/inventory/purchase-orders/${poId}/pdf`} target="_blank" rel="noreferrer">
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </a>
            {po.status === 'DRAFT' && po.needsApproval && !po.approver && (
              <Button onClick={handleApprove}>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Approve
              </Button>
            )}
            {po.status === 'DRAFT' && (
              <Button
                onClick={handleSend}
                disabled={po.needsApproval && !po.approver}
              >
                <Mail className="h-4 w-4 mr-2" />
                Send to Supplier
              </Button>
            )}
            {canCreateBill && (
              poBills?.items?.[0] ? (
                <Link href="/finance">
                  <Button variant="secondary">
                    <FileText className="h-4 w-4 mr-2" />
                    View Bill ({poBills.items[0].billNumber})
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      const bill = await apiClient.post<{ id: string; billNumber: string }>(
                        '/finance/bills/from-po',
                        { purchaseOrderId: poId },
                      )
                      toast.success(`Draft bill ${bill.billNumber} created`)
                      await mutateBills()
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Failed to create bill')
                    }
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Create Bill
                </Button>
              )
            )}
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <Card>
          <CardBody className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <Badge variant={po.status === 'RECEIVED' ? 'success' : po.status === 'CANCELLED' ? 'danger' : 'info'}>
                {po.status}
              </Badge>
              {po.needsApproval && (
                <Badge variant={po.approver ? 'success' : 'warning'}>
                  {po.approver ? 'Approved' : `Approval required (${po.approvalRule?.requiredApproverRole ?? 'MANAGER'})`}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-2 md:gap-4">
              {STEPS.filter((s) => s !== 'PARTIAL').map((step, index) => {
                const mappedIndex =
                  step === 'ACKNOWLEDGED' ? STEPS.indexOf('ACKNOWLEDGED')
                  : step === 'RECEIVED' && po.status === 'PARTIAL' ? STEPS.indexOf('PARTIAL')
                  : STEPS.indexOf(step)
                const done = currentStep >= mappedIndex && po.status !== 'CANCELLED'
                const active = currentStep === mappedIndex
                return (
                  <div key={step} className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                        done
                          ? 'bg-indigo-600 text-white'
                          : active
                            ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500'
                            : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                    </div>
                    <span className="text-sm font-medium hidden sm:inline">{step}</span>
                  </div>
                )
              })}
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardBody className="p-5 space-y-4">
              <h3 className="font-semibold">Supplier</h3>
              <div className="text-sm space-y-1">
                <p className="font-medium">{po.supplier.name}</p>
                <p className="text-slate-500">{po.supplierEmail ?? 'No email on file'}</p>
              </div>
              <h3 className="font-semibold pt-2">Delivery</h3>
              <div className="text-sm space-y-1">
                <p>{po.warehouse.name} ({po.warehouse.code})</p>
                <p className="text-slate-500">Expected: {formatDate(po.expectedDelivery)}</p>
                {po.sentAt && <p className="text-slate-500">Sent: {formatDate(po.sentAt)}</p>}
              </div>
              {po.terms && (
                <>
                  <h3 className="font-semibold pt-2">Terms</h3>
                  <p className="text-sm text-slate-600">{po.terms}</p>
                </>
              )}
            </CardBody>
          </Card>

          <Card className="lg:col-span-2">
            <CardBody className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="text-left p-3">Product</th>
                    <th className="text-right p-3">Ordered</th>
                    <th className="text-right p-3">Received</th>
                    <th className="text-right p-3">Unit Cost</th>
                    <th className="text-right p-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((item, index) => (
                    <tr key={index} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-3">
                        <div className="font-medium">{item.product?.name ?? item.productId}</div>
                        <div className="text-xs text-slate-500">{item.product?.sku}</div>
                      </td>
                      <td className="p-3 text-right tabular-nums">{item.quantity}</td>
                      <td className="p-3 text-right tabular-nums">{item.quantityReceived}</td>
                      <td className="p-3 text-right tabular-nums">
                        {formatMoney(item.unitCost, po.currency)}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {formatMoney(item.totalCost, po.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200 dark:border-slate-700">
                  <tr>
                    <td colSpan={4} className="p-3 text-right text-slate-500">
                      Subtotal
                    </td>
                    <td className="p-3 text-right font-medium">{formatMoney(po.subtotal, po.currency)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="p-3 text-right text-slate-500">
                      Tax
                    </td>
                    <td className="p-3 text-right">{formatMoney(po.taxTotal, po.currency)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="p-3 text-right text-slate-500">
                      Shipping
                    </td>
                    <td className="p-3 text-right">{formatMoney(po.shippingCost, po.currency)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="p-3 text-right font-semibold">
                      Grand Total
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {formatMoney(po.grandTotal, po.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardBody>
          </Card>
        </div>

        {canReceive && (
          <Card>
            <CardBody className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-indigo-600" />
                <h3 className="font-semibold">Receive Goods</h3>
              </div>
              <BarcodeScanner
                onScan={(result: BarcodeScanResult) => {
                  if (!po) return
                  const index = po.items.findIndex((item) => item.productId === result.productId)
                  if (index < 0) {
                    toast.error('Scanned product is not on this PO')
                    return
                  }
                  const item = po.items[index]
                  const remaining = item.quantity - item.quantityReceived
                  setReceiveDrafts((prev) => ({
                    ...prev,
                    [index]: {
                      ...(prev[index] ?? { batchNumber: '', expiryDate: '' }),
                      quantityReceived: remaining,
                    },
                  }))
                  setHighlightLine(index)
                  toast.success(`Line matched: ${result.name}`)
                }}
              />
              <div className="space-y-3">
                {po.items.map((item, index) => {
                  const remaining = item.quantity - item.quantityReceived
                  if (remaining <= 0) return null
                  const draft = receiveDrafts[index] ?? {
                    quantityReceived: remaining,
                    batchNumber: '',
                    expiryDate: '',
                  }
                  return (
                    <div
                      key={index}
                      className={`grid grid-cols-1 md:grid-cols-12 gap-3 items-end border rounded-lg p-3 ${
                        highlightLine === index ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      <div className="md:col-span-4">
                        <p className="font-medium text-sm">{item.product?.name}</p>
                        <p className="text-xs text-slate-500">Remaining: {remaining}</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs text-slate-500 mb-1 block">Qty Received</label>
                        <Input
                          type="number"
                          min={0}
                          max={remaining}
                          value={draft.quantityReceived}
                          onChange={(e) =>
                            setReceiveDrafts((prev) => ({
                              ...prev,
                              [index]: { ...draft, quantityReceived: Number(e.target.value) },
                            }))
                          }
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="text-xs text-slate-500 mb-1 block">Batch #</label>
                        <Input
                          value={draft.batchNumber}
                          onChange={(e) =>
                            setReceiveDrafts((prev) => ({
                              ...prev,
                              [index]: { ...draft, batchNumber: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="text-xs text-slate-500 mb-1 block">Expiry Date</label>
                        <Input
                          type="date"
                          value={draft.expiryDate}
                          onChange={(e) =>
                            setReceiveDrafts((prev) => ({
                              ...prev,
                              [index]: { ...draft, expiryDate: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <Button onClick={handleReceive} disabled={receiving}>
                {receiving ? 'Recording…' : 'Submit Receipt'}
              </Button>
            </CardBody>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardBody className="p-5">
              <h3 className="font-semibold mb-4">Timeline</h3>
              <div className="space-y-4">
                {po.timeline.length === 0 && (
                  <p className="text-sm text-slate-500">No events recorded yet.</p>
                )}
                {po.timeline.map((event) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{event.action.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(event.timestamp)}
                        {event.user ? ` · ${event.user.fullName}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-5">
              <h3 className="font-semibold mb-4">Goods Receipts</h3>
              {po.receipts.length === 0 ? (
                <p className="text-sm text-slate-500">No receipts yet.</p>
              ) : (
                <ul className="space-y-3">
                  {po.receipts.map((receipt) => (
                    <li key={receipt.id} className="text-sm border rounded-lg p-3">
                      <p className="font-medium">{receipt.receiptNumber}</p>
                      <p className="text-slate-500 text-xs">
                        {formatDate(receipt.receivedAt)}
                        {receipt.receiver ? ` · ${receipt.receiver.fullName}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
