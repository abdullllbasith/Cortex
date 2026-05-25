import {
  FulfillmentStatus,
  PaymentStatus,
  Prisma,
  SalesOrderStatus,
} from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/db/prisma'
import {
  getStockBalance,
  recordTransaction,
  releaseReservation,
  reserveStock,
} from '@/lib/inventory/stockEngine'
import { emitSaiosEvent } from '@/lib/workflows/eventBus'
import { emitSalesEventsFromOrderLines } from '@/lib/analytics/salesEventEmitter'
import {
  calculateOrderTotals,
  normalizeLineItems,
  parseLineItems,
  type FulfillmentLineItem,
  type SalesLineItem,
} from './salesTypes'

function toNumber(v: Decimal | number): number {
  return typeof v === 'number' ? v : v.toNumber()
}

function toDecimal(v: number): Decimal {
  return new Decimal(v)
}

async function logOrderAudit(
  tenantId: string,
  orderId: string,
  action: string,
  userId?: string,
  newValue?: Record<string, unknown>,
  previousValue?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action,
      resourceType: 'sales_order',
      resourceId: orderId,
      newValue: newValue as Prisma.InputJsonValue,
      previousValue: previousValue as Prisma.InputJsonValue,
    },
  })
}

export function getTenantPaymentTermsDays(settings: unknown): number {
  const s = (settings ?? {}) as { finance?: { defaultPaymentTermsDays?: number } }
  const days = s.finance?.defaultPaymentTermsDays
  return typeof days === 'number' && days > 0 ? days : 30
}

async function nextOrderNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `ORD-${year}-`
  const latest = await prisma.salesOrder.findFirst({
    where: { tenantId, orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  })
  const lastSeq = latest ? parseInt(latest.orderNumber.split('-').pop() ?? '0', 10) : 0
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`
}

const STATUS_ORDER: SalesOrderStatus[] = [
  SalesOrderStatus.CONFIRMED,
  SalesOrderStatus.PROCESSING,
  SalesOrderStatus.PICKING,
  SalesOrderStatus.PACKED,
  SalesOrderStatus.SHIPPED,
  SalesOrderStatus.DELIVERED,
]

export async function listOrders(
  tenantId: string,
  filters: {
    status?: string
    paymentStatus?: string
    search?: string
    page?: number
    limit?: number
  } = {},
) {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 24

  const statusFilter = filters.status
  let statusWhere: Prisma.SalesOrderWhereInput['status'] | undefined
  if (statusFilter === 'NEW') {
    statusWhere = { in: [SalesOrderStatus.DRAFT, SalesOrderStatus.CONFIRMED] }
  } else if (statusFilter === 'PROCESSING') {
    statusWhere = { in: [SalesOrderStatus.PROCESSING, SalesOrderStatus.PICKING, SalesOrderStatus.PACKED] }
  } else if (statusFilter && statusFilter !== 'ALL') {
    statusWhere = statusFilter as SalesOrderStatus
  }

  const where: Prisma.SalesOrderWhereInput = {
    tenantId,
    ...(statusWhere && { status: statusWhere }),
    ...(filters.status === 'DELIVERED_MONTH' && {
      deliveredAt: { gte: monthStart() },
    }),
    ...(filters.paymentStatus && { paymentStatus: filters.paymentStatus as PaymentStatus }),
    ...(filters.search && {
      OR: [
        { orderNumber: { contains: filters.search, mode: 'insensitive' } },
        { contact: { firstName: { contains: filters.search, mode: 'insensitive' } } },
      ],
    }),
  }

  const [items, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        contact: { select: { firstName: true, lastName: true } },
        fulfillments: { select: { status: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.salesOrder.count({ where }),
  ])

  return {
    items: items.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      paymentStatus: o.paymentStatus,
      total: toNumber(o.total),
      currency: o.currency,
      itemCount: parseLineItems(o.items).length,
      customerName: o.contact ? `${o.contact.firstName} ${o.contact.lastName}`.trim() : null,
      fulfillmentStatus: o.fulfillments[0]?.status ?? null,
      createdAt: o.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
  }
}

export async function getOrder(tenantId: string, id: string) {
  const order = await prisma.salesOrder.findFirst({
    where: { id, tenantId },
    include: {
      contact: true,
      company: true,
      quote: { select: { id: true, quoteNumber: true } },
      owner: { select: { id: true, fullName: true, email: true } },
      fulfillments: {
        include: { warehouse: { select: { id: true, name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
      },
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          amountDue: true,
          amountPaid: true,
          total: true,
          currency: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
    },
  })
  if (!order) return null

  const items = parseLineItems(order.items)
  const productIds = items.map((i) => i.productId).filter(Boolean) as string[]
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { tenantId, id: { in: productIds } },
        select: { id: true, sku: true, imageUrls: true, name: true },
      })
    : []
  const productMap = new Map(products.map((p) => [p.id, p]))

  const enrichedItems = await Promise.all(
    items.map(async (item) => {
      const product = item.productId ? productMap.get(item.productId) : null
      let stockAvailable: number | null = null
      if (item.productId) {
        const balances = await getStockBalance(tenantId, item.productId)
        stockAvailable = balances
          .filter((b) => (item.variantId ? b.variantId === item.variantId : true))
          .reduce((s, b) => s + b.quantityAvailable, 0)
      }
      return {
        ...item,
        sku: item.sku ?? product?.sku,
        imageUrl: item.imageUrl ?? product?.imageUrls[0] ?? null,
        productName: product?.name,
        stockAvailable,
      }
    }),
  )

  return {
    ...order,
    items: enrichedItems,
    subtotal: toNumber(order.subtotal),
    discountTotal: toNumber(order.discountTotal),
    taxTotal: toNumber(order.taxTotal),
    shippingCost: toNumber(order.shippingCost),
    total: toNumber(order.total),
    invoices: order.invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      amountDue: toNumber(inv.amountDue),
      amountPaid: toNumber(inv.amountPaid),
      total: toNumber(inv.total),
      currency: inv.currency,
    })),
    createdBy: order.ownerId,
  }
}

export async function createOrder(tenantId: string, data: Record<string, unknown>, actorId?: string) {
  const items = normalizeLineItems((data.items as unknown[]) ?? [])
  const shippingCost = Number(data.shippingCost ?? 0)
  const totals = calculateOrderTotals(items, shippingCost)
  const orderNumber = await nextOrderNumber(tenantId)

  const order = await prisma.salesOrder.create({
    data: {
      tenantId,
      orderNumber,
      quoteId: (data.quoteId as string) ?? null,
      contactId: (data.contactId as string) ?? null,
      companyId: (data.companyId as string) ?? null,
      ownerId: (data.ownerId as string) ?? actorId ?? null,
      items: items as unknown as Prisma.InputJsonValue,
      subtotal: toDecimal(totals.subtotal),
      discountTotal: toDecimal(totals.discountTotal),
      taxTotal: toDecimal(totals.taxTotal),
      shippingCost: toDecimal(shippingCost),
      total: toDecimal(totals.total),
      currency: String(data.currency ?? 'USD'),
      shippingAddress: (data.shippingAddress as Prisma.InputJsonValue) ?? {},
      billingAddress: (data.billingAddress as Prisma.InputJsonValue) ?? {},
      notes: (data.notes as string) ?? null,
      paymentStatus: (data.paymentStatus as PaymentStatus) ?? PaymentStatus.UNPAID,
    },
  })

  await logOrderAudit(tenantId, order.id, 'ORDER_CREATED', actorId, { orderNumber, total: totals.total })
  return getOrder(tenantId, order.id)
}

/** Create a sales order from an accepted or draft quote (quote-to-order). */
export async function createOrderFromQuote(tenantId: string, quoteId: string, actorId?: string) {
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, tenantId } })
  if (!quote) throw new Error('Quote not found')

  const existing = await prisma.salesOrder.findFirst({ where: { quoteId, tenantId } })
  if (existing) return getOrder(tenantId, existing.id)!

  const orderNumber = await nextOrderNumber(tenantId)
  const order = await prisma.salesOrder.create({
    data: {
      tenantId,
      orderNumber,
      quoteId: quote.id,
      contactId: quote.contactId,
      companyId: quote.companyId,
      ownerId: quote.ownerId ?? actorId ?? null,
      status: SalesOrderStatus.DRAFT,
      items: quote.items as Prisma.InputJsonValue,
      subtotal: quote.subtotal,
      discountTotal: quote.discountTotal,
      taxTotal: quote.taxTotal,
      total: quote.total,
      currency: quote.currency,
      notes: quote.notes,
    },
  })

  await logOrderAudit(tenantId, order.id, 'ORDER_CREATED_FROM_QUOTE', actorId, {
    orderNumber,
    quoteNumber: quote.quoteNumber,
  })

  emitSaiosEvent(tenantId, 'new_order', {
    orderId: order.id,
    orderNumber,
    quoteId,
    total: toNumber(quote.total),
  })

  return getOrder(tenantId, order.id)!
}

export async function updateOrder(tenantId: string, id: string, data: Record<string, unknown>, actorId?: string) {
  const existing = await prisma.salesOrder.findFirst({ where: { id, tenantId } })
  if (!existing) throw new Error('Order not found')

  let updateData: Prisma.SalesOrderUpdateInput = {
    ...(data.paymentStatus !== undefined && { paymentStatus: data.paymentStatus as PaymentStatus }),
    ...(data.notes !== undefined && { notes: (data.notes as string) ?? null }),
    ...(data.shippingAddress !== undefined && {
      shippingAddress: data.shippingAddress as Prisma.InputJsonValue,
    }),
    ...(data.billingAddress !== undefined && {
      billingAddress: data.billingAddress as Prisma.InputJsonValue,
    }),
  }

  if (data.items) {
    const items = normalizeLineItems(data.items as unknown[])
    const shippingCost = data.shippingCost != null ? Number(data.shippingCost) : toNumber(existing.shippingCost)
    const totals = calculateOrderTotals(items, shippingCost)
    updateData = {
      ...updateData,
      items: items as unknown as Prisma.InputJsonValue,
      subtotal: toDecimal(totals.subtotal),
      discountTotal: toDecimal(totals.discountTotal),
      taxTotal: toDecimal(totals.taxTotal),
      shippingCost: toDecimal(shippingCost),
      total: toDecimal(totals.total),
    }
  }

  await prisma.salesOrder.update({ where: { id }, data: updateData })
  await logOrderAudit(tenantId, id, 'ORDER_UPDATED', actorId)
  return getOrder(tenantId, id)
}

export async function confirmOrder(orderId: string, tenantId: string, actorId?: string) {
  const order = await prisma.salesOrder.findFirst({ where: { id: orderId, tenantId } })
  if (!order) throw new Error('Order not found')
  if (order.status === SalesOrderStatus.CONFIRMED) {
    return getOrder(tenantId, orderId)
  }
  if (order.status !== SalesOrderStatus.DRAFT) {
    throw new Error('Order cannot be confirmed in current status')
  }

  const items = parseLineItems(order.items)
  for (const item of items) {
    if (!item.productId) continue
    const balances = await getStockBalance(tenantId, item.productId)
    const available = balances
      .filter((b) => (item.variantId ? b.variantId === item.variantId : true))
      .reduce((s, b) => s + b.quantityAvailable, 0)
    if (available < item.quantity) {
      throw new Error(
        `Insufficient stock for ${item.description}: available ${available}, needed ${item.quantity}`,
      )
    }
  }

  for (const item of items) {
    if (!item.productId) continue
    await reserveStock(tenantId, item.productId, item.quantity, orderId, {
      variantId: item.variantId,
      performedBy: actorId,
    })
  }

  await prisma.salesOrder.update({
    where: { id: orderId },
    data: { status: SalesOrderStatus.CONFIRMED, confirmedAt: new Date() },
  })

  await logOrderAudit(tenantId, orderId, 'ORDER_CONFIRMED', actorId, {
    orderNumber: order.orderNumber,
  })

  const confirmed = await getOrder(tenantId, orderId)
  if (!confirmed) throw new Error('Order not found after confirmation')

  emitSaiosEvent(tenantId, 'order_confirmed', {
    orderId,
    orderNumber: order.orderNumber,
    contactId: order.contactId,
    total: Number(order.total),
    contactEmail: confirmed.contact?.email ?? null,
    contactPhone: confirmed.contact?.phone ?? null,
  })

  return confirmed
}

/**
 * Mark order delivered: deduct stock, emit SalesEvents, create draft invoice, fire ORDER_DELIVERED.
 */
export async function deliverOrder(orderId: string, tenantId: string, actorId?: string) {
  const order = await prisma.salesOrder.findFirst({
    where: { id: orderId, tenantId },
    include: { contact: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } } },
  })
  if (!order) throw new Error('Order not found')
  if (order.status === SalesOrderStatus.CANCELLED) throw new Error('Cannot deliver cancelled order')
  if (order.status === SalesOrderStatus.DELIVERED) {
    return getOrder(tenantId, orderId)
  }

  const deliverableStatuses: SalesOrderStatus[] = [
    SalesOrderStatus.CONFIRMED,
    SalesOrderStatus.PROCESSING,
    SalesOrderStatus.PICKING,
    SalesOrderStatus.PACKED,
    SalesOrderStatus.SHIPPED,
  ]
  if (!deliverableStatuses.includes(order.status)) {
    throw new Error('Order must be confirmed before delivery')
  }

  const items = parseLineItems(order.items)
  const warehouse = await prisma.warehouse.findFirst({
    where: { tenantId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  })
  if (!warehouse) throw new Error('No active warehouse configured')

  const productIds = items.map((i) => i.productId).filter(Boolean) as string[]
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { tenantId, id: { in: productIds } },
        select: { id: true, costPrice: true },
      })
    : []
  const costByProduct = new Map(products.map((p) => [p.id, toNumber(p.costPrice)]))

  for (const item of items) {
    if (!item.productId) continue
    await recordTransaction(tenantId, {
      productId: item.productId,
      variantId: item.variantId,
      warehouseId: warehouse.id,
      transactionType: 'SALE',
      quantity: item.quantity,
      unitCost: costByProduct.get(item.productId) ?? 0,
      referenceType: 'sales_order',
      referenceId: orderId,
      notes: `Order ${order.orderNumber} delivered`,
      performedBy: actorId,
    })
  }

  try {
    await releaseReservation(orderId, tenantId)
  } catch {
    /* reservation may already be released */
  }

  await emitSalesEventsFromOrderLines({
    tenantId,
    orderId,
    contactId: order.contactId,
    channel: 'DIRECT',
    lines: items
      .filter((line) => line.productId)
      .map((line) => ({
        productId: line.productId!,
        quantity: line.quantity,
        lineTotal: line.lineTotal,
        unitPrice: line.unitPrice,
        unitCost: costByProduct.get(line.productId!),
      })),
    timestamp: new Date(),
  })

  await prisma.salesOrder.update({
    where: { id: orderId },
    data: { status: SalesOrderStatus.DELIVERED, deliveredAt: new Date() },
  })

  let invoiceId: string | null = null
  let invoiceNumber: string | null = null
  try {
    const { createFromOrder } = await import('@/lib/finance/invoiceService')
    const invoice = await createFromOrder(orderId, tenantId, actorId)
    invoiceId = invoice?.id ?? null
    invoiceNumber = invoice?.invoiceNumber ?? null
  } catch (err) {
    console.warn('[orderService] Auto-invoice on delivery failed:', err)
  }

  await logOrderAudit(tenantId, orderId, 'ORDER_DELIVERED', actorId, {
    orderNumber: order.orderNumber,
    invoiceId,
  })

  emitSaiosEvent(tenantId, 'order_delivered', {
    orderId,
    orderNumber: order.orderNumber,
    contactId: order.contactId,
    contactEmail: order.contact?.email ?? null,
    contactPhone: order.contact?.phone ?? null,
    contactName: order.contact
      ? `${order.contact.firstName} ${order.contact.lastName}`.trim()
      : null,
    invoiceId,
    invoiceNumber,
    total: toNumber(order.total),
    currency: order.currency,
  })

  return getOrder(tenantId, orderId)
}

export async function fulfillOrder(
  orderId: string,
  tenantId: string,
  fulfillmentData: Record<string, unknown>,
  actorId?: string,
) {
  const order = await prisma.salesOrder.findFirst({ where: { id: orderId, tenantId } })
  if (!order) throw new Error('Order not found')
  if (order.status === SalesOrderStatus.CANCELLED) throw new Error('Cannot fulfill cancelled order')

  const items = parseLineItems(order.items)
  const fulfillmentItems = (fulfillmentData.items as FulfillmentLineItem[]) ?? items.map((_, i) => ({
    orderItemIndex: i,
    quantityFulfilled: items[i].quantity,
  }))

  const fulfillmentStatus = (fulfillmentData.status as FulfillmentStatus) ?? FulfillmentStatus.SHIPPED
  const warehouseId = (fulfillmentData.warehouseId as string) ?? null

  const fulfillment = await prisma.orderFulfillment.create({
    data: {
      orderId,
      tenantId,
      status: fulfillmentStatus,
      warehouseId,
      items: fulfillmentItems as unknown as Prisma.InputJsonValue,
      trackingNumber: (fulfillmentData.trackingNumber as string) ?? null,
      carrier: (fulfillmentData.carrier as string) ?? null,
      notes: (fulfillmentData.notes as string) ?? null,
      shippedAt: fulfillmentStatus === FulfillmentStatus.SHIPPED ? new Date() : null,
      deliveredAt: fulfillmentStatus === FulfillmentStatus.DELIVERED ? new Date() : null,
    },
  })

  const statusMap: Partial<Record<FulfillmentStatus, SalesOrderStatus>> = {
    PICKING: SalesOrderStatus.PICKING,
    PACKED: SalesOrderStatus.PACKED,
    SHIPPED: SalesOrderStatus.SHIPPED,
    DELIVERED: SalesOrderStatus.DELIVERED,
  }
  const newOrderStatus = statusMap[fulfillmentStatus] ?? SalesOrderStatus.PROCESSING

  if (fulfillmentStatus === FulfillmentStatus.DELIVERED || fulfillmentData.deliverAfter) {
    return deliverOrder(orderId, tenantId, actorId)
  }

  await prisma.salesOrder.update({
    where: { id: orderId },
    data: { status: newOrderStatus },
  })

  await logOrderAudit(tenantId, orderId, 'ORDER_FULFILLED', actorId, {
    fulfillmentId: fulfillment.id,
    status: fulfillmentStatus,
    trackingNumber: fulfillmentData.trackingNumber,
  })

  if (fulfillmentStatus === FulfillmentStatus.SHIPPED) {
    emitSaiosEvent(tenantId, 'new_order', {
      orderId,
      orderNumber: order.orderNumber,
      status: 'SHIPPED',
      total: toNumber(order.total),
    })
  }

  return getOrder(tenantId, orderId)
}

export async function cancelOrder(orderId: string, tenantId: string, reason: string, actorId?: string) {
  const order = await prisma.salesOrder.findFirst({ where: { id: orderId, tenantId } })
  if (!order) throw new Error('Order not found')
  if (order.status === SalesOrderStatus.CANCELLED) throw new Error('Order already cancelled')
  if (order.status === SalesOrderStatus.DELIVERED) throw new Error('Cannot cancel delivered order')

  if (
    order.status === SalesOrderStatus.CONFIRMED ||
    order.status === SalesOrderStatus.PROCESSING ||
    order.status === SalesOrderStatus.PICKING ||
    order.status === SalesOrderStatus.PACKED
  ) {
    try {
      await releaseReservation(orderId, tenantId)
    } catch {
      /* no reservation */
    }
  }

  await prisma.salesOrder.update({
    where: { id: orderId },
    data: {
      status: SalesOrderStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: reason,
    },
  })

  await logOrderAudit(tenantId, orderId, 'ORDER_CANCELLED', actorId, { reason })
  return getOrder(tenantId, orderId)
}

export async function getOrderTimeline(orderId: string, tenantId: string) {
  const [auditLogs, fulfillments, order] = await Promise.all([
    prisma.auditLog.findMany({
      where: { tenantId, resourceType: 'sales_order', resourceId: orderId },
      orderBy: { timestamp: 'asc' },
      include: { user: { select: { fullName: true } } },
    }),
    prisma.orderFulfillment.findMany({
      where: { orderId, tenantId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.salesOrder.findFirst({ where: { id: orderId, tenantId } }),
  ])

  if (!order) throw new Error('Order not found')

  const events: Array<{
    id: string
    type: string
    message: string
    createdAt: string
    actorName?: string | null
    metadata?: Record<string, unknown>
  }> = []

  events.push({
    id: `created-${order.id}`,
    type: 'ORDER_CREATED',
    message: `Order ${order.orderNumber} created`,
    createdAt: order.createdAt.toISOString(),
  })

  for (const log of auditLogs) {
    events.push({
      id: log.id,
      type: log.action,
      message: log.action.replace(/_/g, ' '),
      createdAt: log.timestamp.toISOString(),
      actorName: log.user?.fullName,
      metadata: (log.newValue as Record<string, unknown>) ?? undefined,
    })
  }

  for (const f of fulfillments) {
    events.push({
      id: f.id,
      type: 'FULFILLMENT',
      message: `Fulfillment ${f.status}${f.trackingNumber ? ` — ${f.trackingNumber}` : ''}`,
      createdAt: f.createdAt.toISOString(),
      metadata: { carrier: f.carrier, trackingNumber: f.trackingNumber },
    })
  }

  events.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return events
}
