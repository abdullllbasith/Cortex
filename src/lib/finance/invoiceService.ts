import {
  FinancePaymentMethod,
  FinancePaymentType,
  InvoiceStatus,
  Prisma,
} from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/db/prisma'
import { NotificationSeverity, NotificationType } from '@prisma/client'
import { notificationService } from '@/lib/notifications/notificationService'
import { writeInAppNotification } from '@/lib/notifications/channels/inAppChannel'
import { parseTenantSettings } from '@/lib/settings/types'
import { calculateOrderTotals } from '@/lib/sales/salesTypes'
import { parseLineItems } from '@/lib/sales/salesTypes'
import { emitSaiosEvent } from '@/lib/workflows/eventBus'
import { GL_ACCOUNTS, resolveAccount } from './accountResolver'
import { buildInvoicePdf } from './invoicePdfDocument'
import { sendInvoiceEmail } from './invoiceEmail'
import {
  computeInvoiceStatus,
  normalizeInvoiceItems,
  parseInvoiceItems,
  type ArAgingBucket,
  type InvoiceLineItem,
  type InvoicePdfData,
  type InvoiceSummary,
} from './invoiceTypes'
import { post, voidEntry } from './journalEngine'
import { toNumber } from './financeTypes'

function toDecimal(v: number): Decimal {
  return new Decimal(v)
}

async function logInvoiceAudit(
  tenantId: string,
  invoiceId: string,
  action: string,
  userId?: string,
  newValue?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action,
      resourceType: 'invoice',
      resourceId: invoiceId,
      newValue: newValue as Prisma.InputJsonValue | undefined,
    },
  })
}

async function nextInvoiceNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`
  const latest = await prisma.invoice.findFirst({
    where: { tenantId, invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  })
  const lastSeq = latest ? parseInt(latest.invoiceNumber.split('-').pop() ?? '0', 10) : 0
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`
}

function mapInvoiceRow(invoice: {
  id: string
  invoiceNumber: string
  status: InvoiceStatus
  issueDate: Date
  dueDate: Date
  subtotal: Decimal
  discountTotal: Decimal
  taxTotal: Decimal
  total: Decimal
  amountPaid: Decimal
  amountDue: Decimal
  currency: string
  contactId: string | null
  companyId: string | null
  orderId: string | null
  sentAt: Date | null
  paidAt: Date | null
  createdAt: Date
  contact?: { firstName: string; lastName: string; email: string | null } | null
  company?: { name: string } | null
  order?: { orderNumber: string } | null
}) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    issueDate: invoice.issueDate.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    subtotal: toNumber(invoice.subtotal),
    discountTotal: toNumber(invoice.discountTotal),
    taxTotal: toNumber(invoice.taxTotal),
    total: toNumber(invoice.total),
    amountPaid: toNumber(invoice.amountPaid),
    amountDue: toNumber(invoice.amountDue),
    currency: invoice.currency,
    contactId: invoice.contactId,
    companyId: invoice.companyId,
    orderId: invoice.orderId,
    contactName: invoice.contact
      ? `${invoice.contact.firstName} ${invoice.contact.lastName}`.trim()
      : null,
    companyName: invoice.company?.name ?? null,
    orderNumber: invoice.order?.orderNumber ?? null,
    sentAt: invoice.sentAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
  }
}

async function buildPdfData(tenantId: string, invoiceId: string): Promise<InvoicePdfData> {
  const [tenant, invoice] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { contact: true, company: true },
    }),
  ])
  if (!tenant || !invoice) throw new Error('Invoice not found')

  const settings = parseTenantSettings(tenant.settings) as {
    address?: string
    finance?: { bankDetails?: string }
  }
  const items = parseInvoiceItems(invoice.items)

  return {
    tenantName: tenant.name,
    tenantAddress: settings.address ?? null,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate.toLocaleDateString(),
    dueDate: invoice.dueDate.toLocaleDateString(),
    customerName: invoice.contact
      ? `${invoice.contact.firstName} ${invoice.contact.lastName}`.trim()
      : 'Customer',
    customerEmail: invoice.contact?.email,
    customerCompany: invoice.company?.name ?? invoice.contact?.company,
    currency: invoice.currency,
    lines: items.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
    subtotal: toNumber(invoice.subtotal),
    discountTotal: toNumber(invoice.discountTotal),
    taxTotal: toNumber(invoice.taxTotal),
    total: toNumber(invoice.total),
    amountPaid: toNumber(invoice.amountPaid),
    amountDue: toNumber(invoice.amountDue),
    notes: invoice.notes,
    terms: invoice.termsAndConditions,
    bankDetails:
      settings.finance?.bankDetails ??
      process.env.FINANCE_BANK_DETAILS ??
      'Please remit payment via bank transfer. Contact accounts receivable for details.',
  }
}

export async function generateInvoicePDF(invoiceId: string, tenantId: string): Promise<Buffer> {
  const data = await buildPdfData(tenantId, invoiceId)
  const doc = buildInvoicePdf(data)
  return renderToBuffer(doc)
}

const UNPAID_STATUSES: InvoiceStatus[] = ['SENT', 'VIEWED', 'PARTIAL', 'OVERDUE']

export async function listInvoices(
  tenantId: string,
  filters: {
    status?: string
    search?: string
    orderId?: string
    page?: number
    limit?: number
  } = {},
) {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 24
  const where: Prisma.InvoiceWhereInput = {
    tenantId,
    ...(filters.status === 'UNPAID' && { status: { in: UNPAID_STATUSES } }),
    ...(filters.status &&
      filters.status !== 'UNPAID' && { status: filters.status as InvoiceStatus }),
    ...(filters.orderId && { orderId: filters.orderId }),
    ...(filters.search && {
      OR: [
        { invoiceNumber: { contains: filters.search, mode: 'insensitive' } },
        { contact: { firstName: { contains: filters.search, mode: 'insensitive' } } },
        { contact: { lastName: { contains: filters.search, mode: 'insensitive' } } },
      ],
    }),
  }

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        contact: { select: { firstName: true, lastName: true, email: true } },
        company: { select: { name: true } },
        order: { select: { orderNumber: true } },
      },
      orderBy: [{ issueDate: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.invoice.count({ where }),
  ])

  return {
    items: items.map(mapInvoiceRow),
    total,
    page,
    limit,
  }
}

export async function getInvoice(tenantId: string, id: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, tenantId },
    include: {
      contact: true,
      company: true,
      order: { select: { id: true, orderNumber: true, status: true } },
      creator: { select: { id: true, fullName: true } },
      payments: { orderBy: { paymentDate: 'desc' } },
    },
  })
  if (!invoice) throw new Error('Invoice not found')

  return {
    ...mapInvoiceRow(invoice),
    items: parseInvoiceItems(invoice.items),
    notes: invoice.notes,
    termsAndConditions: invoice.termsAndConditions,
    viewedAt: invoice.viewedAt?.toISOString() ?? null,
    contact: invoice.contact,
    company: invoice.company,
    order: invoice.order,
    creator: invoice.creator,
    payments: invoice.payments.map((p) => ({
      id: p.id,
      amount: toNumber(p.amount),
      currency: p.currency,
      paymentMethod: p.paymentMethod,
      paymentDate: p.paymentDate.toISOString(),
      reference: p.reference,
      notes: p.notes,
    })),
  }
}

export async function createInvoice(
  tenantId: string,
  data: {
    contactId?: string | null
    companyId?: string | null
    orderId?: string | null
    issueDate?: string
    dueDate?: string
    items: Array<Omit<InvoiceLineItem, 'lineTotal'> & { lineTotal?: number }>
    notes?: string | null
    termsAndConditions?: string | null
    currency?: string
  },
  actorId?: string,
) {
  const items = normalizeInvoiceItems(data.items as unknown[])
  if (!items.length || items.every((i) => !i.description)) {
    throw new Error('Invoice requires at least one line item')
  }

  const totals = calculateOrderTotals(
    items.map((i) => ({
      ...i,
      productId: i.productId ?? null,
      variantId: null,
    })),
  )

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  const tenantSettings = (tenant?.settings ?? {}) as { currency?: string }

  const issueDate = data.issueDate ? new Date(data.issueDate) : new Date()
  const dueDate = data.dueDate
    ? new Date(data.dueDate)
    : new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000)

  const invoice = await prisma.invoice.create({
    data: {
      tenantId,
      invoiceNumber: await nextInvoiceNumber(tenantId),
      contactId: data.contactId ?? null,
      companyId: data.companyId ?? null,
      orderId: data.orderId ?? null,
      status: 'DRAFT',
      issueDate,
      dueDate,
      items: items as unknown as Prisma.InputJsonValue,
      subtotal: toDecimal(totals.subtotal),
      discountTotal: toDecimal(totals.discountTotal),
      taxTotal: toDecimal(totals.taxTotal),
      total: toDecimal(totals.total),
      amountPaid: toDecimal(0),
      amountDue: toDecimal(totals.total),
      currency: data.currency ?? tenantSettings.currency ?? 'USD',
      notes: data.notes ?? null,
      termsAndConditions:
        data.termsAndConditions ??
        ((tenant?.settings as { finance?: { invoiceTerms?: string } })?.finance?.invoiceTerms ??
          'Payment due within 30 days of invoice date.'),
      createdBy: actorId ?? null,
    },
  })

  await logInvoiceAudit(tenantId, invoice.id, 'INVOICE_CREATED', actorId, {
    invoiceNumber: invoice.invoiceNumber,
    total: totals.total,
  })

  return getInvoice(tenantId, invoice.id)
}

export async function createFromOrder(orderId: string, tenantId: string, actorId?: string) {
  const existing = await prisma.invoice.findFirst({
    where: { tenantId, orderId, status: { notIn: ['VOID', 'CANCELLED'] } },
  })
  if (existing) return getInvoice(tenantId, existing.id)

  const order = await prisma.salesOrder.findFirst({
    where: { id: orderId, tenantId },
    include: { contact: true, company: true },
  })
  if (!order) throw new Error('Order not found')

  const orderItems = parseLineItems(order.items)
  const items: InvoiceLineItem[] = orderItems.map((line) => ({
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discount: line.discount,
    taxRate: line.taxRate,
    lineTotal: line.lineTotal,
    productId: line.productId,
    sku: line.sku,
  }))

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } })
  const settings = parseTenantSettings(tenant?.settings)
  const paymentDays = settings.finance?.defaultPaymentTermsDays ?? 30

  const issueDate = new Date()
  const dueDate = new Date(issueDate.getTime() + paymentDays * 24 * 60 * 60 * 1000)

  return createInvoice(
    tenantId,
    {
      contactId: order.contactId,
      companyId: order.companyId,
      orderId: order.id,
      issueDate: issueDate.toISOString(),
      dueDate: dueDate.toISOString(),
      items,
      notes: order.notes,
      termsAndConditions:
        settings.finance?.invoiceTerms ?? `Payment due within ${paymentDays} days of invoice date.`,
      currency: order.currency,
    },
    actorId,
  )
}

export async function updateInvoice(
  tenantId: string,
  id: string,
  data: Partial<{
    contactId: string | null
    companyId: string | null
    issueDate: string
    dueDate: string
    items: Array<Omit<InvoiceLineItem, 'lineTotal'> & { lineTotal?: number }>
    notes: string | null
    termsAndConditions: string | null
    currency?: string
  }>,
  actorId?: string,
) {
  const existing = await prisma.invoice.findFirst({ where: { id, tenantId } })
  if (!existing) throw new Error('Invoice not found')
  if (!['DRAFT', 'SENT', 'VIEWED'].includes(existing.status)) {
    throw new Error('Invoice cannot be edited in current status')
  }

  let items = parseInvoiceItems(existing.items)
  if (data.items) items = normalizeInvoiceItems(data.items as unknown[])
  const totals = calculateOrderTotals(
    items.map((i) => ({ ...i, productId: i.productId ?? null, variantId: null })),
  )
  const amountPaid = toNumber(existing.amountPaid)
  const amountDue = Math.max(0, Math.round((totals.total - amountPaid) * 100) / 100)

  await prisma.invoice.update({
    where: { id },
    data: {
      ...(data.contactId !== undefined && { contactId: data.contactId }),
      ...(data.companyId !== undefined && { companyId: data.companyId }),
      ...(data.issueDate && { issueDate: new Date(data.issueDate) }),
      ...(data.dueDate && { dueDate: new Date(data.dueDate) }),
      ...(data.items && { items: items as unknown as Prisma.InputJsonValue }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.termsAndConditions !== undefined && { termsAndConditions: data.termsAndConditions }),
      ...(data.currency !== undefined && { currency: data.currency }),
      subtotal: toDecimal(totals.subtotal),
      discountTotal: toDecimal(totals.discountTotal),
      taxTotal: toDecimal(totals.taxTotal),
      total: toDecimal(totals.total),
      amountDue: toDecimal(amountDue),
      status: computeInvoiceStatus(amountDue, amountPaid, data.dueDate ? new Date(data.dueDate) : existing.dueDate, existing.status),
    },
  })

  await logInvoiceAudit(tenantId, id, 'INVOICE_UPDATED', actorId)
  return getInvoice(tenantId, id)
}

export async function sendInvoice(invoiceId: string, tenantId: string, actorId?: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: { contact: true },
  })
  if (!invoice) throw new Error('Invoice not found')
  if (invoice.status === 'VOID' || invoice.status === 'CANCELLED') {
    throw new Error('Cannot send void or cancelled invoice')
  }
  if (!invoice.contact?.email) throw new Error('Contact email required to send invoice')

  const total = toNumber(invoice.total)
  const subtotal = toNumber(invoice.subtotal)
  const taxTotal = toNumber(invoice.taxTotal)
  const arAccount = await resolveAccount(tenantId, GL_ACCOUNTS.AR.subtype, [...GL_ACCOUNTS.AR.codes])
  const salesAccount = await resolveAccount(tenantId, GL_ACCOUNTS.SALES.subtype, [...GL_ACCOUNTS.SALES.codes])

  const existingJe = await prisma.journalEntry.findFirst({
    where: {
      tenantId,
      referenceType: 'INVOICE',
      referenceId: invoiceId,
      status: 'POSTED',
    },
  })

  if (!existingJe) {
    const journalLines: Array<{
      accountId: string
      description: string
      debit: number
      credit: number
      currency: string
    }> = [
      {
        accountId: arAccount.id,
        description: `AR — ${invoice.invoiceNumber}`,
        debit: total,
        credit: 0,
        currency: invoice.currency,
      },
      {
        accountId: salesAccount.id,
        description: `Sales revenue — ${invoice.invoiceNumber}`,
        debit: 0,
        credit: subtotal,
        currency: invoice.currency,
      },
    ]

    if (taxTotal > 0) {
      const taxAccount = await resolveAccount(tenantId, GL_ACCOUNTS.TAX_PAYABLE.subtype, [
        ...GL_ACCOUNTS.TAX_PAYABLE.codes,
      ])
      journalLines.push({
        accountId: taxAccount.id,
        description: `Tax payable — ${invoice.invoiceNumber}`,
        debit: 0,
        credit: taxTotal,
        currency: invoice.currency,
      })
    }

    await post(
      tenantId,
      {
        date: invoice.issueDate,
        description: `Invoice ${invoice.invoiceNumber}`,
        reference: invoice.invoiceNumber,
        referenceType: 'INVOICE',
        referenceId: invoiceId,
        lines: journalLines,
        post: true,
      },
      actorId,
    )
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  const pdfBuffer = await generateInvoicePDF(invoiceId, tenantId)
  await sendInvoiceEmail({
    to: invoice.contact.email,
    subject: `Invoice #${invoice.invoiceNumber}`,
    body: `Please find attached invoice ${invoice.invoiceNumber} from ${tenant?.name ?? 'Cortex'}. Amount due: ${total} ${invoice.currency}. Due date: ${invoice.dueDate.toLocaleDateString()}.`,
    pdfBuffer,
    pdfFilename: `${invoice.invoiceNumber}.pdf`,
  })

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'SENT', sentAt: new Date() },
  })

  await logInvoiceAudit(tenantId, invoiceId, 'INVOICE_SENT', actorId)
  emitSaiosEvent(tenantId, 'invoice_sent', {
    invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    total,
    contactId: invoice.contactId,
  })

  return getInvoice(tenantId, invoiceId)
}

export async function recordPayment(
  invoiceId: string,
  tenantId: string,
  payment: {
    amount: number
    paymentMethod?: FinancePaymentMethod
    paymentDate?: string
    reference?: string
    notes?: string
  },
  actorId?: string,
) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: { contact: true },
  })
  if (!invoice) throw new Error('Invoice not found')
  if (['VOID', 'CANCELLED', 'PAID'].includes(invoice.status)) {
    throw new Error('Cannot record payment on this invoice')
  }
  if (payment.amount <= 0) throw new Error('Payment amount must be positive')

  const amountDue = toNumber(invoice.amountDue)
  if (payment.amount > amountDue + 0.01) {
    throw new Error(`Payment exceeds amount due (${amountDue})`)
  }

  const bankAccount = await resolveAccount(tenantId, GL_ACCOUNTS.BANK.subtype, [...GL_ACCOUNTS.BANK.codes])
  const arAccount = await resolveAccount(tenantId, GL_ACCOUNTS.AR.subtype, [...GL_ACCOUNTS.AR.codes])

  const journal = await post(
    tenantId,
    {
      date: payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
      description: `Payment for ${invoice.invoiceNumber}`,
      reference: payment.reference ?? invoice.invoiceNumber,
      referenceType: 'PAYMENT',
      referenceId: invoiceId,
      lines: [
        {
          accountId: bankAccount.id,
          description: `Payment received — ${invoice.invoiceNumber}`,
          debit: payment.amount,
          credit: 0,
          currency: invoice.currency,
        },
        {
          accountId: arAccount.id,
          description: `AR clearance — ${invoice.invoiceNumber}`,
          debit: 0,
          credit: payment.amount,
          currency: invoice.currency,
        },
      ],
      post: true,
    },
    actorId,
  )

  const paymentRow = await prisma.payment.create({
    data: {
      tenantId,
      type: FinancePaymentType.INVOICE_PAYMENT,
      invoiceId,
      contactId: invoice.contactId,
      amount: toDecimal(payment.amount),
      currency: invoice.currency,
      paymentMethod: payment.paymentMethod ?? FinancePaymentMethod.BANK_TRANSFER,
      paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
      reference: payment.reference ?? null,
      notes: payment.notes ?? null,
      journalEntryId: journal.id,
    },
  })

  const newAmountPaid = toNumber(invoice.amountPaid) + payment.amount
  const newAmountDue = Math.max(0, Math.round((toNumber(invoice.total) - newAmountPaid) * 100) / 100)
  const newStatus = computeInvoiceStatus(newAmountDue, newAmountPaid, invoice.dueDate, invoice.status)

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid: toDecimal(newAmountPaid),
      amountDue: toDecimal(newAmountDue),
      status: newStatus,
      ...(newStatus === 'PAID' && { paidAt: new Date() }),
    },
  })

  await logInvoiceAudit(tenantId, invoiceId, 'INVOICE_PAYMENT', actorId, {
    paymentId: paymentRow.id,
    amount: payment.amount,
  })

  return getInvoice(tenantId, invoiceId)
}

export async function voidInvoice(invoiceId: string, tenantId: string, reason: string, actorId?: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } })
  if (!invoice) throw new Error('Invoice not found')
  if (invoice.status === 'VOID') throw new Error('Invoice already voided')
  if (toNumber(invoice.amountPaid) > 0) throw new Error('Cannot void invoice with payments')

  const postedEntry = await prisma.journalEntry.findFirst({
    where: { tenantId, referenceType: 'INVOICE', referenceId: invoiceId, status: 'POSTED' },
  })
  if (postedEntry) {
    await voidEntry(postedEntry.id, tenantId, reason, actorId)
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'VOID' },
  })

  await logInvoiceAudit(tenantId, invoiceId, 'INVOICE_VOIDED', actorId, { reason })
  return getInvoice(tenantId, invoiceId)
}

export async function getInvoiceSummary(tenantId: string): Promise<InvoiceSummary> {
  const now = new Date()

  const openStatuses: InvoiceStatus[] = ['SENT', 'VIEWED', 'PARTIAL', 'OVERDUE']

  const [openInvoices, monthPayments, paidWithDates] = await Promise.all([
    prisma.invoice.findMany({
      where: { tenantId, status: { in: openStatuses } },
      select: { amountDue: true, status: true, dueDate: true },
    }),
    prisma.payment.aggregate({
      where: { tenantId, paymentDate: { gte: new Date(now.getFullYear(), now.getMonth(), 1) }, type: 'INVOICE_PAYMENT' },
      _sum: { amount: true },
    }),
    prisma.invoice.findMany({
      where: { tenantId, status: 'PAID', paidAt: { not: null } },
      select: { issueDate: true, paidAt: true },
      take: 200,
      orderBy: { paidAt: 'desc' },
    }),
  ])

  const unpaidTotal = openInvoices.reduce((s, i) => s + toNumber(i.amountDue), 0)
  const overdueTotal = openInvoices
    .filter((i) => i.status === 'OVERDUE' || i.dueDate < now)
    .reduce((s, i) => s + toNumber(i.amountDue), 0)

  let avgDays = 0
  if (paidWithDates.length) {
    const totalDays = paidWithDates.reduce((s, inv) => {
      const days = (inv.paidAt!.getTime() - inv.issueDate.getTime()) / (1000 * 60 * 60 * 24)
      return s + Math.max(0, days)
    }, 0)
    avgDays = Math.round(totalDays / paidWithDates.length)
  }

  return {
    unpaidTotal: Math.round(unpaidTotal * 100) / 100,
    overdueTotal: Math.round(overdueTotal * 100) / 100,
    paidThisMonth: Math.round(toNumber(monthPayments._sum.amount) * 100) / 100,
    avgDaysToPayment: avgDays,
  }
}

export async function getArAgingReport(tenantId: string): Promise<{
  buckets: ArAgingBucket[]
  totalOutstanding: number
}> {
  const now = new Date()
  const openStatuses: InvoiceStatus[] = ['SENT', 'VIEWED', 'PARTIAL', 'OVERDUE']

  const invoices = await prisma.invoice.findMany({
    where: { tenantId, status: { in: openStatuses }, amountDue: { gt: 0 } },
    select: { amountDue: true, dueDate: true },
  })

  const buckets: ArAgingBucket[] = [
    { label: 'Current', count: 0, total: 0 },
    { label: '1–30 days', count: 0, total: 0 },
    { label: '31–60 days', count: 0, total: 0 },
    { label: '60+ days', count: 0, total: 0 },
  ]

  for (const inv of invoices) {
    const due = toNumber(inv.amountDue)
    const daysPast = Math.floor((now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24))
    let idx = 0
    if (daysPast <= 0) idx = 0
    else if (daysPast <= 30) idx = 1
    else if (daysPast <= 60) idx = 2
    else idx = 3
    buckets[idx].count += 1
    buckets[idx].total = Math.round((buckets[idx].total + due) * 100) / 100
  }

  const totalOutstanding = buckets.reduce((s, b) => s + b.total, 0)
  return { buckets, totalOutstanding: Math.round(totalOutstanding * 100) / 100 }
}

export async function checkOverdue(tenantId: string) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const overdueCandidates = await prisma.invoice.findMany({
    where: {
      tenantId,
      dueDate: { lt: now },
      status: { in: ['SENT', 'VIEWED', 'PARTIAL'] },
      amountDue: { gt: 0 },
    },
    include: { contact: { select: { firstName: true, lastName: true, email: true } } },
  })

  let updated = 0
  for (const invoice of overdueCandidates) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'OVERDUE' },
    })
    updated += 1

    emitSaiosEvent(tenantId, 'invoice_overdue', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amountDue: toNumber(invoice.amountDue),
      contactId: invoice.contactId,
    })

    const financeUsers = await prisma.user.findMany({
      where: { tenantId, role: { in: ['OWNER', 'CEO', 'FINANCE_OFFICER'] }, isActive: true },
      select: { id: true },
      take: 5,
    })

    const customerName = invoice.contact
      ? `${invoice.contact.firstName} ${invoice.contact.lastName}`.trim()
      : 'Customer'

    await notificationService.send({
      tenantId,
      roleTarget: 'FINANCE_OFFICER',
      type: NotificationType.ALERT,
      severity: NotificationSeverity.WARNING,
      title: `Overdue invoice ${invoice.invoiceNumber}`,
      body: `${customerName} — ${toNumber(invoice.amountDue)} ${invoice.currency} past due.`,
      actionUrl: '/finance/invoices',
      actionLabel: 'View invoices',
      entityId: `invoice-overdue-${invoice.id}`,
      metadata: { invoiceId: invoice.id },
    }).catch(() => undefined)

    for (const user of financeUsers) {
      await writeInAppNotification({
        tenantId,
        userId: user.id,
        type: 'ALERT',
        title: `Overdue invoice ${invoice.invoiceNumber}`,
        body: `${customerName} — ${toNumber(invoice.amountDue)} ${invoice.currency} past due.`,
        severity: 'WARNING',
        actionUrl: `/finance/invoices`,
        actionLabel: 'View invoices',
        metadata: { invoiceId: invoice.id },
      }).catch(() => undefined)
    }
  }

  return { tenantId, updated, checked: overdueCandidates.length }
}

export async function checkOverdueAllTenants() {
  const tenants = await prisma.tenant.findMany({ select: { id: true } })
  const results = []
  for (const t of tenants) {
    results.push(await checkOverdue(t.id))
  }
  return results
}

export async function getInvoiceDefaults(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  const settings = (tenant?.settings ?? {}) as {
    currency?: string
    finance?: { invoiceTerms?: string; bankDetails?: string }
  }
  return {
    currency: settings.currency ?? 'USD',
    termsAndConditions:
      settings.finance?.invoiceTerms ?? 'Payment due within 30 days of invoice date.',
  }
}

/** Alias for scheduled overdue job. */
export const checkAndMarkOverdue = checkOverdue

/** Alias for PDF generation. */
export const generatePDF = generateInvoicePDF

export async function duplicateInvoice(
  invoiceId: string,
  tenantId: string,
  actorId?: string,
) {
  const source = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
  })
  if (!source) throw new Error('Invoice not found')

  const items = parseInvoiceItems(source.items)
  const issueDate = new Date()
  const dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000)

  return createInvoice(
    tenantId,
    {
      contactId: source.contactId,
      companyId: source.companyId,
      items,
      notes: source.notes,
      termsAndConditions: source.termsAndConditions,
      currency: source.currency,
      issueDate: issueDate.toISOString(),
      dueDate: dueDate.toISOString(),
    },
    actorId,
  )
}
