import { prisma } from '@/lib/db/prisma'

export interface EmitSalesEventInput {
  tenantId: string
  productId: string
  customerId?: string | null
  quantity: number
  revenue: number
  cost?: number
  channel?: string
  branchId?: string | null
  timestamp?: Date
  referenceType?: string
  referenceId?: string
}

function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

export async function emitSalesEvent(input: EmitSalesEventInput): Promise<{ created: boolean; id?: string }> {
  const {
    tenantId,
    productId,
    customerId,
    quantity,
    revenue,
    cost: inputCost,
    channel = 'DIRECT',
    branchId,
    timestamp = new Date(),
    referenceType,
    referenceId,
  } = input

  if (referenceType && referenceId) {
    const existing = await prisma.salesEvent.findFirst({
      where: {
        tenantId,
        productId,
        ...(referenceType === 'sales_order'
          ? { customerId: customerId ?? undefined }
          : {}),
      },
      orderBy: { timestamp: 'desc' },
    })
    if (
      existing &&
      referenceType === 'sales_order' &&
      existing.timestamp >= new Date(timestamp.getTime() - 86400000) &&
      Math.abs(existing.revenue - revenue) < 0.01 &&
      existing.quantity === quantity
    ) {
      return { created: false, id: existing.id }
    }
  }

  let cost = inputCost ?? 0
  if (cost === 0) {
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { costPrice: true },
    })
    cost = toNumber(product?.costPrice) * quantity
  }

  const margin = Math.round((revenue - cost) * 100) / 100

  const event = await prisma.salesEvent.create({
    data: {
      tenantId,
      productId,
      customerId: customerId ?? null,
      quantity,
      revenue: Math.round(revenue * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      margin,
      channel: channel.toUpperCase(),
      branchId: branchId ?? null,
      timestamp,
    },
  })

  return { created: true, id: event.id }
}

export async function emitSalesEventsFromOrderLines(params: {
  tenantId: string
  orderId: string
  contactId?: string | null
  channel?: string
  branchId?: string | null
  lines: Array<{
    productId: string
    quantity: number
    unitPrice?: number
    lineTotal?: number
    unitCost?: number
  }>
  timestamp?: Date
}): Promise<number> {
  let created = 0
  for (const line of params.lines) {
    if (!line.productId || line.quantity <= 0) continue
    const revenue =
      line.lineTotal != null
        ? line.lineTotal
        : (line.unitPrice ?? 0) * line.quantity
    const result = await emitSalesEvent({
      tenantId: params.tenantId,
      productId: line.productId,
      customerId: params.contactId,
      quantity: line.quantity,
      revenue,
      cost: line.unitCost != null ? line.unitCost * line.quantity : undefined,
      channel: params.channel ?? 'DIRECT',
      branchId: params.branchId,
      timestamp: params.timestamp,
      referenceType: 'sales_order',
      referenceId: params.orderId,
    })
    if (result.created) created += 1
  }
  return created
}
