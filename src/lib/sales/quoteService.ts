import { ActivityType, Prisma, QuoteStatus } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/db/prisma'
import { moveDeal } from '@/lib/crm/pipelineService'
import { parseTenantSettings } from '@/lib/settings/types'
import { buildQuotePdf } from './quotePdfDocument'
import { createOrderFromQuote, getOrder } from './orderService'
import { sendQuoteEmail } from './salesEmail'
import {
  calculateOrderTotals,
  normalizeLineItems,
  parseLineItems,
  type SalesLineItem,
} from './salesTypes'
import { emitSaiosEvent } from '@/lib/workflows/eventBus'

export interface QuotePdfData {
  tenantName: string
  tenantAddress?: string | null
  quoteNumber: string
  quoteDate: string
  validUntil?: string | null
  customerName: string
  customerEmail?: string | null
  customerCompany?: string | null
  currency: string
  lines: Array<{ description: string; quantity: number; unitPrice: number; lineTotal: number }>
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
  notes?: string | null
  terms?: string | null
}

function toNumber(v: Decimal | number): number {
  return typeof v === 'number' ? v : v.toNumber()
}

function toDecimal(v: number): Decimal {
  return new Decimal(v)
}

async function logSalesAudit(
  tenantId: string,
  resourceType: 'quote' | 'sales_order',
  resourceId: string,
  action: string,
  userId?: string,
  newValue?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action,
      resourceType,
      resourceId,
      newValue: newValue as Prisma.InputJsonValue,
    },
  })
}

async function nextQuoteNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `QUO-${year}-`
  const latest = await prisma.quote.findFirst({
    where: {
      tenantId,
      OR: [{ quoteNumber: { startsWith: prefix } }, { quoteNumber: { startsWith: `QT-${year}-` } }],
    },
    orderBy: { quoteNumber: 'desc' },
    select: { quoteNumber: true },
  })
  const lastSeq = latest ? parseInt(latest.quoteNumber.split('-').pop() ?? '0', 10) : 0
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`
}

async function logDealActivity(
  tenantId: string,
  dealId: string,
  contactId: string | null,
  subject: string,
  description: string,
  actorId?: string,
) {
  await prisma.crmActivity.create({
    data: {
      tenantId,
      dealId,
      contactId,
      type: ActivityType.NOTE,
      subject,
      description,
      createdBy: actorId ?? null,
      isCompleted: true,
      completedAt: new Date(),
    },
  })
}

async function enrichLineItems(tenantId: string, items: SalesLineItem[]): Promise<SalesLineItem[]> {
  const enriched: SalesLineItem[] = []
  for (const item of items) {
    if (item.productId) {
      const product = await prisma.product.findFirst({
        where: { id: item.productId, tenantId },
        select: { name: true, sku: true, sellingPrice: true, taxRate: true, imageUrls: true },
      })
      if (product) {
        enriched.push({
          ...item,
          description: item.description || product.name,
          sku: product.sku,
          unitPrice: item.unitPrice || toNumber(product.sellingPrice),
          taxRate: item.taxRate || toNumber(product.taxRate),
          imageUrl: product.imageUrls[0] ?? null,
        })
        continue
      }
    }
    enriched.push(item)
  }
  return normalizeLineItems(enriched)
}

export async function listQuotes(
  tenantId: string,
  filters: { status?: string; search?: string; page?: number; limit?: number } = {},
) {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 24
  const where: Prisma.QuoteWhereInput = {
    tenantId,
    ...(filters.status && { status: filters.status as QuoteStatus }),
    ...(filters.search && {
      OR: [
        { quoteNumber: { contains: filters.search, mode: 'insensitive' } },
        { contact: { firstName: { contains: filters.search, mode: 'insensitive' } } },
        { contact: { lastName: { contains: filters.search, mode: 'insensitive' } } },
      ],
    }),
  }

  const [items, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        owner: { select: { fullName: true } },
      },
    }),
    prisma.quote.count({ where }),
  ])

  return {
    items: items.map((q) => ({
      ...q,
      subtotal: toNumber(q.subtotal),
      discountTotal: toNumber(q.discountTotal),
      taxTotal: toNumber(q.taxTotal),
      total: toNumber(q.total),
      contactName: q.contact ? `${q.contact.firstName} ${q.contact.lastName}`.trim() : null,
    })),
    total,
    page,
    limit,
  }
}

export async function getQuote(tenantId: string, id: string) {
  const quote = await prisma.quote.findFirst({
    where: { id, tenantId },
    include: {
      contact: true,
      company: true,
      deal: { select: { id: true, title: true } },
      owner: { select: { id: true, fullName: true, email: true } },
    },
  })
  if (!quote) return null
  return {
    ...quote,
    items: parseLineItems(quote.items),
    subtotal: toNumber(quote.subtotal),
    discountTotal: toNumber(quote.discountTotal),
    taxTotal: toNumber(quote.taxTotal),
    total: toNumber(quote.total),
  }
}

export async function createQuote(tenantId: string, data: Record<string, unknown>, actorId?: string) {
  const items = await enrichLineItems(tenantId, normalizeLineItems((data.items as unknown[]) ?? []))
  const totals = calculateOrderTotals(items)
  const quoteNumber = await nextQuoteNumber(tenantId)

  const quote = await prisma.quote.create({
    data: {
      tenantId,
      quoteNumber,
      contactId: (data.contactId as string) ?? null,
      companyId: (data.companyId as string) ?? null,
      dealId: (data.dealId as string) ?? null,
      ownerId: (data.ownerId as string) ?? actorId ?? null,
      status: (data.status as QuoteStatus) ?? QuoteStatus.DRAFT,
      validUntil: data.validUntil ? new Date(String(data.validUntil)) : null,
      items: items as unknown as Prisma.InputJsonValue,
      subtotal: toDecimal(totals.subtotal),
      discountTotal: toDecimal(totals.discountTotal),
      taxTotal: toDecimal(totals.taxTotal),
      total: toDecimal(totals.total),
      currency: String(data.currency ?? 'USD'),
      notes: (data.notes as string) ?? null,
      termsAndConditions: (data.termsAndConditions as string) ?? null,
    },
  })

  await logSalesAudit(tenantId, 'quote', quote.id, 'QUOTE_CREATED', actorId, { quoteNumber, total: totals.total })

  if (quote.dealId) {
    await logDealActivity(
      tenantId,
      quote.dealId,
      quote.contactId,
      'Quote created',
      `Quote ${quoteNumber} created (${quote.currency} ${totals.total.toLocaleString()})`,
      actorId,
    )
  }

  return getQuote(tenantId, quote.id)
}

export async function updateQuote(tenantId: string, id: string, data: Record<string, unknown>, actorId?: string) {
  const existing = await prisma.quote.findFirst({ where: { id, tenantId } })
  if (!existing) throw new Error('Quote not found')
  if (existing.status === QuoteStatus.ACCEPTED) throw new Error('Cannot edit accepted quote')

  let items = parseLineItems(existing.items)
  if (data.items) {
    items = await enrichLineItems(tenantId, normalizeLineItems(data.items as unknown[]))
  }
  const totals = calculateOrderTotals(items)

  await prisma.quote.update({
    where: { id },
    data: {
      ...(data.contactId !== undefined && { contactId: (data.contactId as string) ?? null }),
      ...(data.companyId !== undefined && { companyId: (data.companyId as string) ?? null }),
      ...(data.dealId !== undefined && { dealId: (data.dealId as string) ?? null }),
      ...(data.validUntil !== undefined && {
        validUntil: data.validUntil ? new Date(String(data.validUntil)) : null,
      }),
      ...(data.items !== undefined && { items: items as unknown as Prisma.InputJsonValue }),
      subtotal: toDecimal(totals.subtotal),
      discountTotal: toDecimal(totals.discountTotal),
      taxTotal: toDecimal(totals.taxTotal),
      total: toDecimal(totals.total),
      ...(data.notes !== undefined && { notes: (data.notes as string) ?? null }),
      ...(data.termsAndConditions !== undefined && {
        termsAndConditions: (data.termsAndConditions as string) ?? null,
      }),
    },
  })

  await logSalesAudit(tenantId, 'quote', id, 'QUOTE_UPDATED', actorId, { total: totals.total })
  return getQuote(tenantId, id)
}

export async function buildQuotePdfData(tenantId: string, quoteId: string): Promise<QuotePdfData> {
  const quote = await getQuote(tenantId, quoteId)
  if (!quote) throw new Error('Quote not found')

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  const settings = parseTenantSettings(tenant?.settings)
  const customerName = quote.contact
    ? `${quote.contact.firstName} ${quote.contact.lastName}`.trim()
    : quote.company?.name ?? 'Customer'

  return {
    tenantName: tenant?.name ?? 'Cortex',
    tenantAddress: (settings as { address?: string }).address ?? null,
    quoteNumber: quote.quoteNumber,
    quoteDate: quote.createdAt.toLocaleDateString(),
    validUntil: quote.validUntil?.toLocaleDateString() ?? null,
    customerName,
    customerEmail: quote.contact?.email,
    customerCompany: quote.company?.name ?? quote.contact?.company,
    currency: quote.currency,
    lines: parseLineItems(quote.items).map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
    subtotal: quote.subtotal,
    discountTotal: quote.discountTotal,
    taxTotal: quote.taxTotal,
    total: quote.total,
    notes: quote.notes,
    terms: quote.termsAndConditions,
  }
}

export async function generateQuotePDF(tenantId: string, quoteId: string): Promise<Buffer> {
  const pdfData = await buildQuotePdfData(tenantId, quoteId)
  return renderToBuffer(buildQuotePdf(pdfData))
}

export async function sendQuote(quoteId: string, tenantId: string, actorId?: string) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, tenantId },
    include: { contact: true, tenant: { select: { name: true } } },
  })
  if (!quote) throw new Error('Quote not found')
  if (!quote.contact?.email) throw new Error('Contact has no email address')

  const pdfBuffer = await generateQuotePDF(tenantId, quoteId)
  const companyName = quote.tenant?.name ?? 'Cortex'

  await sendQuoteEmail({
    to: quote.contact.email,
    subject: `Quote #${quote.quoteNumber} from ${companyName}`,
    body: `Dear ${quote.contact.firstName},\n\nPlease find attached quote ${quote.quoteNumber} from ${companyName}.\n\nThank you,\n${companyName} Sales Team`,
    pdfBuffer,
    pdfFilename: `${quote.quoteNumber}.pdf`,
  })

  await prisma.quote.update({
    where: { id: quoteId },
    data: { status: QuoteStatus.SENT, sentAt: new Date() },
  })

  await logSalesAudit(tenantId, 'quote', quoteId, 'QUOTE_SENT', actorId, {
    quoteNumber: quote.quoteNumber,
    email: quote.contact.email,
  })

  if (quote.dealId) {
    await logDealActivity(
      tenantId,
      quote.dealId,
      quote.contactId,
      'Quote sent',
      `Quote ${quote.quoteNumber} emailed to ${quote.contact.email}`,
      actorId,
    )
  }

  return getQuote(tenantId, quoteId)
}

/** Accept quote → create sales order, log CRM activity, advance linked deal to Negotiation. */
export async function acceptQuote(quoteId: string, tenantId: string, actorId?: string) {
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, tenantId } })
  if (!quote) throw new Error('Quote not found')
  if (quote.status === QuoteStatus.ACCEPTED) {
    const existing = await prisma.salesOrder.findFirst({ where: { quoteId, tenantId } })
    if (existing) return getOrder(tenantId, existing.id)
  }
  if (quote.status === QuoteStatus.REJECTED || quote.status === QuoteStatus.EXPIRED) {
    throw new Error('Cannot accept quote in current status')
  }

  const order = await createOrderFromQuote(tenantId, quoteId, actorId)
  if (!order) throw new Error('Failed to create order from quote')

  await prisma.quote.update({
    where: { id: quoteId },
    data: { status: QuoteStatus.ACCEPTED, acceptedAt: new Date() },
  })

  if (quote.dealId) {
    await logDealActivity(
      tenantId,
      quote.dealId,
      quote.contactId,
      'Quote accepted, order created',
      `Quote ${quote.quoteNumber} accepted — order ${order.orderNumber} created`,
      actorId,
    )
    try {
      await moveDeal(quote.dealId, 'negotiation', tenantId, actorId)
    } catch {
      /* pipeline may use different stage ids */
    }
  }

  await logSalesAudit(tenantId, 'quote', quoteId, 'QUOTE_ACCEPTED', actorId, {
    orderId: order.id,
    orderNumber: order.orderNumber,
  })

  return order
}

/** Create sales order from quote (marks accepted if not already). */
export async function convertToOrder(quoteId: string, tenantId: string, actorId?: string) {
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, tenantId } })
  if (!quote) throw new Error('Quote not found')

  const existing = await prisma.salesOrder.findFirst({ where: { quoteId, tenantId } })
  if (existing) return getOrder(tenantId, existing.id)

  const order = await createOrderFromQuote(tenantId, quoteId, actorId)
  if (!order) throw new Error('Failed to create order from quote')

  if (quote.status !== QuoteStatus.ACCEPTED) {
    await prisma.quote.update({
      where: { id: quoteId },
      data: { status: QuoteStatus.ACCEPTED, acceptedAt: new Date() },
    })
  }

  if (quote.dealId) {
    await logDealActivity(
      tenantId,
      quote.dealId,
      quote.contactId,
      'Quote converted to order',
      `Order ${order.orderNumber} created from quote ${quote.quoteNumber}`,
      actorId,
    )
  }

  return order
}

export async function markQuoteViewed(quoteId: string, tenantId: string) {
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, tenantId } })
  if (!quote || quote.viewedAt) return
  if (quote.status === QuoteStatus.SENT) {
    await prisma.quote.update({
      where: { id: quoteId },
      data: { status: QuoteStatus.VIEWED, viewedAt: new Date() },
    })
  }
}
