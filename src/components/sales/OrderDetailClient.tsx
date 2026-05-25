'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  ArrowLeft,
  Truck,
  FileText,
  XCircle,
  CreditCard,
  Package,
  CheckCircle2,
} from 'lucide-react'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Badge,
  Input,
  toast,
  ModalRoot,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
} from '@/components/ui'
import { swrFetcher, apiClient } from '@/lib/api/apiClient'

interface OrderInvoice {
  id: string
  invoiceNumber: string
  status: string
  amountDue: number
  amountPaid: number
  total: number
  currency: string
}

interface OrderLineItem {
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
  productName?: string
  sku?: string
  imageUrl?: string | null
  stockAvailable?: number | null
  productId?: string | null
}

interface OrderDetail {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  subtotal: number
  taxTotal: number
  total: number
  currency: string
  notes: string | null
  shippingAddress: Record<string, string>
  contact: {
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
    company: string | null
  } | null
  items: OrderLineItem[]
  invoices?: OrderInvoice[]
  quote?: { id: string; quoteNumber: string } | null
}

interface TimelineEvent {
  id: string
  type: string
  message: string
  createdAt: string
  actorName?: string | null
}

interface WarehouseOption {
  id: string
  name: string
  code: string
}

const STEPPER = ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED'] as const

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'default',
  CONFIRMED: 'info',
  PROCESSING: 'warning',
  PICKING: 'warning',
  PACKED: 'warning',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'danger',
}

function formatMoney(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n)
}

function stepIndex(status: string) {
  if (status === 'DRAFT') return -1
  if (status === 'PICKING') return 1
  const idx = STEPPER.indexOf(status as (typeof STEPPER)[number])
  return idx >= 0 ? idx : 0
}

function formatAddress(addr: Record<string, string>) {
  const parts = [addr.street, addr.city, addr.state, addr.postal, addr.country].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

export function OrderDetailClient({ orderId }: { orderId: string }) {
  const [cancelReason, setCancelReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [warehouseId, setWarehouseId] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [carrier, setCarrier] = useState('')
  const [fulfillQty, setFulfillQty] = useState<Record<number, number>>({})
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER')

  const { data: order, mutate, isLoading } = useSWR<OrderDetail>(`/sales/orders/${orderId}`, swrFetcher)
  const { data: timelineData } = useSWR<{ timeline: TimelineEvent[] }>(
    `/sales/orders/${orderId}?timeline=true`,
    swrFetcher,
  )
  const { data: warehousesData } = useSWR<WarehouseOption[]>(
    order ? '/inventory/warehouses' : null,
    swrFetcher,
  )

  const warehouses = Array.isArray(warehousesData) ? warehousesData : []
  const timeline = timelineData?.timeline ?? []

  const runAction = async (action: () => Promise<unknown>, successMsg: string) => {
    setBusy(true)
    try {
      const result = await action()
      toast.success(successMsg)
      await mutate()
      return result
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const fulfillItems = useMemo(() => {
    if (!order) return []
    return order.items.map((item, index) => ({
      orderItemIndex: index,
      quantityFulfilled: fulfillQty[index] ?? item.quantity,
    }))
  }, [order, fulfillQty])

  if (isLoading && !order) {
    return <div className="flex h-48 items-center justify-center text-sm text-slate-500">Loading order…</div>
  }

  if (!order) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2">
        <p className="text-sm text-slate-500">Order not found</p>
        <Link href="/sales/orders">
          <Button size="sm" variant="secondary">
            Back to orders
          </Button>
        </Link>
      </div>
    )
  }

  const currentStep = stepIndex(order.status)
  const linkedInvoice = order.invoices?.[0]
  const amountPaid = linkedInvoice?.amountPaid ?? 0
  const amountDue = linkedInvoice?.amountDue ?? order.total
  const canFulfill = ['CONFIRMED', 'PROCESSING', 'PICKING', 'PACKED', 'SHIPPED'].includes(order.status)
  const shipping = formatAddress(order.shippingAddress ?? {})

  const recordPayment = async () => {
    if (!linkedInvoice) {
      toast.error('No invoice linked — deliver order first')
      return
    }
    const amount = Number(paymentAmount)
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    await apiClient.post(`/finance/invoices/${linkedInvoice.id}/payment`, {
      amount,
      method: paymentMethod,
    })
    toast.success('Payment recorded')
    setPaymentOpen(false)
    await mutate()
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={order.orderNumber}
        subtitle={
          order.contact
            ? `${order.contact.firstName} ${order.contact.lastName}`.trim()
            : 'Sales order'
        }
        breadcrumbs={[
          { label: 'Sales', href: '/sales/quotes' },
          { label: 'Orders', href: '/sales/orders' },
          { label: order.orderNumber },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/sales/orders">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            </Link>
            {order.status === 'DRAFT' && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  void runAction(
                    () => apiClient.post(`/sales/orders/${orderId}/confirm`),
                    'Order confirmed — stock reserved',
                  )
                }
              >
                Confirm order
              </Button>
            )}
          </div>
        }
      />

      <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[order.status] ?? 'default'}>{order.status}</Badge>
          <Badge variant={order.paymentStatus === 'PAID' ? 'success' : 'warning'}>
            Payment: {order.paymentStatus}
          </Badge>
          {order.quote && (
            <Link href={`/sales/quotes/new?id=${order.quote.id}`}>
              <Badge variant="info">From {order.quote.quoteNumber}</Badge>
            </Link>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 overflow-x-auto">
          {STEPPER.map((step, i) => (
            <div key={step} className="flex items-center">
              <div
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                  i <= currentStep
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                }`}
              >
                {i < currentStep ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border text-[10px]">
                    {i + 1}
                  </span>
                )}
                {step.charAt(0) + step.slice(1).toLowerCase()}
              </div>
              {i < STEPPER.length - 1 && (
                <div className={`mx-1 h-0.5 w-6 ${i < currentStep ? 'bg-indigo-400' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardBody className="p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Package className="h-4 w-4" />
                  Order items
                </h3>
                <div className="space-y-3">
                  {order.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800"
                    >
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-12 w-12 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded bg-slate-100 text-xs text-slate-400">
                          —
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{item.productName ?? item.description}</p>
                        {item.sku && <p className="text-xs text-slate-500">SKU: {item.sku}</p>}
                        <p className="text-sm text-slate-500">
                          Qty {item.quantity} × {formatMoney(item.unitPrice, order.currency)}
                        </p>
                        {item.stockAvailable != null && (
                          <p
                            className={`text-xs ${
                              item.stockAvailable >= item.quantity
                                ? 'text-green-600'
                                : 'text-red-600'
                            }`}
                          >
                            Stock: {item.stockAvailable} available
                          </p>
                        )}
                      </div>
                      <p className="font-semibold tabular-nums">
                        {formatMoney(item.lineTotal, order.currency)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-between border-t pt-3 font-semibold">
                  <span>Order total</span>
                  <span>{formatMoney(order.total, order.currency)}</span>
                </div>
              </CardBody>
            </Card>

            {canFulfill && (
              <Card>
                <CardBody className="space-y-4 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Truck className="h-4 w-4" />
                    Fulfillment
                  </h3>
                  <div>
                    <label className="text-xs text-slate-500">Warehouse</label>
                    <select
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                      value={warehouseId}
                      onChange={(e) => setWarehouseId(e.target.value)}
                    >
                      <option value="">Default warehouse</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  {order.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="truncate">{item.description}</span>
                      <Input
                        type="number"
                        min={0}
                        max={item.quantity}
                        className="h-8 w-20"
                        value={fulfillQty[index] ?? item.quantity}
                        onChange={(e) =>
                          setFulfillQty((prev) => ({
                            ...prev,
                            [index]: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                  ))}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-slate-500">Tracking number</label>
                      <Input
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="1Z999..."
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Carrier</label>
                      <Input
                        value={carrier}
                        onChange={(e) => setCarrier(e.target.value)}
                        placeholder="UPS, FedEx…"
                      />
                    </div>
                  </div>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void runAction(async () => {
                        await apiClient.post(`/sales/orders/${orderId}/fulfill`, {
                          warehouseId: warehouseId || null,
                          status: 'SHIPPED',
                          items: fulfillItems,
                          trackingNumber: trackingNumber || null,
                          carrier: carrier || null,
                          deliverAfter: true,
                        })
                      }, 'Order fulfilled and delivered')
                    }
                  >
                    <Truck className="mr-1 h-4 w-4" />
                    Fulfill &amp; Ship
                  </Button>
                </CardBody>
              </Card>
            )}

            <Card>
              <CardBody className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Timeline</h3>
                {timeline.length === 0 ? (
                  <p className="text-sm text-slate-500">No events yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {[...timeline].reverse().map((e) => (
                      <li key={e.id} className="flex gap-3 text-sm">
                        <span className="shrink-0 text-xs text-slate-400">
                          {new Date(e.createdAt).toLocaleString()}
                        </span>
                        <div>
                          <p className="font-medium">{e.message}</p>
                          {e.actorName && (
                            <p className="text-xs text-slate-500">{e.actorName}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="space-y-4">
            {order.contact && (
              <Card>
                <CardBody className="space-y-1 p-4 text-sm">
                  <h3 className="font-semibold">Customer</h3>
                  <p>
                    {order.contact.firstName} {order.contact.lastName}
                  </p>
                  {order.contact.company && (
                    <p className="text-slate-500">{order.contact.company}</p>
                  )}
                  {order.contact.email && (
                    <p className="text-slate-500">{order.contact.email}</p>
                  )}
                  {order.contact.phone && (
                    <p className="text-slate-500">{order.contact.phone}</p>
                  )}
                </CardBody>
              </Card>
            )}

            <Card>
              <CardBody className="space-y-2 p-4 text-sm">
                <h3 className="font-semibold">Shipping</h3>
                {shipping ? (
                  <p className="text-slate-600 dark:text-slate-400">{shipping}</p>
                ) : (
                  <p className="text-slate-500">No shipping address on file</p>
                )}
                {order.notes && (
                  <>
                    <h3 className="pt-2 font-semibold">Notes</h3>
                    <p className="text-slate-600 dark:text-slate-400">{order.notes}</p>
                  </>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-sm font-semibold">Payment</h3>
                </div>
                <Badge variant={order.paymentStatus === 'PAID' ? 'success' : 'warning'}>
                  {order.paymentStatus}
                </Badge>
                <p className="text-sm text-slate-500">
                  Paid: {formatMoney(amountPaid, order.currency)} · Due:{' '}
                  {formatMoney(amountDue, order.currency)}
                </p>
                {linkedInvoice && order.paymentStatus !== 'PAID' && (
                  <Button size="sm" variant="secondary" onClick={() => setPaymentOpen(true)}>
                    Record payment
                  </Button>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-sm font-semibold">Invoice</h3>
                </div>
                {linkedInvoice ? (
                  <>
                    <p className="font-mono text-sm">{linkedInvoice.invoiceNumber}</p>
                    <Badge variant={linkedInvoice.status === 'PAID' ? 'success' : 'warning'}>
                      {linkedInvoice.status}
                    </Badge>
                    <Link href={`/finance/invoices/new?id=${linkedInvoice.id}`}>
                      <Button size="sm" variant="secondary" className="w-full">
                        Open invoice
                      </Button>
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    Invoice is created when the order is delivered.
                  </p>
                )}
              </CardBody>
            </Card>

            {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
              <Card>
                <CardBody className="space-y-2 p-4">
                  <h3 className="text-sm font-semibold">Cancel order</h3>
                  <Input
                    placeholder="Reason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void runAction(async () => {
                        if (!cancelReason.trim()) throw new Error('Enter cancel reason')
                        return apiClient.post(`/sales/orders/${orderId}/cancel`, {
                          reason: cancelReason,
                        })
                      }, 'Order cancelled')
                    }
                  >
                    <XCircle className="mr-1 h-4 w-4" />
                    Cancel
                  </Button>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      </div>

      <ModalRoot open={paymentOpen} onOpenChange={setPaymentOpen}>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Record payment</ModalTitle>
          </ModalHeader>
          <ModalBody className="space-y-3">
            <Input
              type="number"
              placeholder="Amount"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
            <select
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CARD">Card</option>
              <option value="CASH">Cash</option>
              <option value="CHECK">Check</option>
            </select>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setPaymentOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void recordPayment()}>Save payment</Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>
    </div>
  )
}
