import {
  BillStatus,
  FinancePaymentMethod,
  Prisma,
} from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/db/prisma'
import { writeInAppNotification } from '@/lib/notifications/channels/inAppChannel'
import { parsePoItems, type POItem } from '@/lib/inventory/purchaseOrderTypes'
import { emitSaiosEvent } from '@/lib/workflows/eventBus'
import { GL_ACCOUNTS, resolveAccount } from './accountResolver'
import {
  calculateBillTotals,
  computeBillStatus,
  normalizeBillItems,
  parseBillItems,
  type BillLineItem,
} from './billTypes'
import { toNumber } from './financeTypes'
import { post } from './journalEngine'

function toDecimal(v: number): Decimal {
  return new Decimal(v)
}

export interface ApAgingBucket {
  label: string
  count: number
  total: number
}

async function logBillAudit(
  tenantId: string,
  billId: string,
  action: string,
  userId?: string,
  newValue?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action,
      resourceType: 'bill',
      resourceId: billId,
      newValue: newValue as Prisma.InputJsonValue | undefined,
    },
  })
}

async function nextBillNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `BILL-${year}-`
  const latest = await prisma.bill.findFirst({
    where: { tenantId, billNumber: { startsWith: prefix } },
    orderBy: { billNumber: 'desc' },
    select: { billNumber: true },
  })
  const lastSeq = latest ? parseInt(latest.billNumber.split('-').pop() ?? '0', 10) : 0
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`
}

function mapBillRow(bill: {
  id: string
  billNumber: string
  status: BillStatus
  issueDate: Date
  dueDate: Date
  subtotal: Decimal
  taxTotal: Decimal
  total: Decimal
  amountPaid: Decimal
  amountDue: Decimal
  currency: string
  supplierId: string
  purchaseOrderId: string | null
  createdAt: Date
  supplier?: { name: string } | null
  purchaseOrder?: { poNumber: string } | null
}) {
  return {
    id: bill.id,
    billNumber: bill.billNumber,
    status: bill.status,
    issueDate: bill.issueDate.toISOString(),
    dueDate: bill.dueDate.toISOString(),
    subtotal: toNumber(bill.subtotal),
    taxTotal: toNumber(bill.taxTotal),
    total: toNumber(bill.total),
    amountPaid: toNumber(bill.amountPaid),
    amountDue: toNumber(bill.amountDue),
    currency: bill.currency,
    supplierId: bill.supplierId,
    purchaseOrderId: bill.purchaseOrderId,
    supplierName: bill.supplier?.name ?? null,
    poNumber: bill.purchaseOrder?.poNumber ?? null,
    createdAt: bill.createdAt.toISOString(),
  }
}

function buildBillItemsFromPoItems(
  poItems: POItem[],
  productNames: Map<string, string>,
): BillLineItem[] {
  const lines: BillLineItem[] = []
  for (const item of poItems) {
    if (item.quantityReceived <= 0) continue
    const description = productNames.get(item.productId) ?? `Product ${item.productId.slice(-6)}`
    lines.push({
      description,
      quantity: item.quantityReceived,
      unitCost: item.unitCost,
      taxRate: item.taxRate,
      lineTotal: 0,
      productId: item.productId,
    })
  }
  return normalizeBillItems(lines as unknown[])
}

export async function listBills(
  tenantId: string,
  filters: {
    status?: string
    search?: string
    purchaseOrderId?: string
    page?: number
    limit?: number
  } = {},
) {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 24
  const where: Prisma.BillWhereInput = {
    tenantId,
    ...(filters.status && { status: filters.status as BillStatus }),
    ...(filters.purchaseOrderId && { purchaseOrderId: filters.purchaseOrderId }),
    ...(filters.search && {
      OR: [
        { billNumber: { contains: filters.search, mode: 'insensitive' } },
        { supplier: { name: { contains: filters.search, mode: 'insensitive' } } },
      ],
    }),
  }

  const [items, total] = await Promise.all([
    prisma.bill.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        purchaseOrder: { select: { poNumber: true } },
      },
      orderBy: [{ issueDate: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.bill.count({ where }),
  ])

  return { items: items.map(mapBillRow), total, page, limit }
}

export async function getBill(tenantId: string, id: string) {
  const bill = await prisma.bill.findFirst({
    where: { id, tenantId },
    include: {
      supplier: true,
      purchaseOrder: { select: { id: true, poNumber: true, status: true } },
      creator: { select: { id: true, fullName: true } },
      payments: { orderBy: { paymentDate: 'desc' } },
    },
  })
  if (!bill) throw new Error('Bill not found')

  return {
    ...mapBillRow(bill),
    items: parseBillItems(bill.items),
    notes: bill.notes,
    supplier: bill.supplier,
    purchaseOrder: bill.purchaseOrder,
    creator: bill.creator,
    payments: bill.payments.map((p) => ({
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

export async function createBill(
  tenantId: string,
  data: {
    supplierId: string
    purchaseOrderId?: string | null
    issueDate?: string
    dueDate?: string
    items: Array<Omit<BillLineItem, 'lineTotal'> & { lineTotal?: number }>
    notes?: string | null
    currency?: string
  },
  actorId?: string,
) {
  const items = normalizeBillItems(data.items as unknown[])
  if (!items.length) throw new Error('Bill requires at least one line item')

  const supplier = await prisma.supplier.findFirst({
    where: { id: data.supplierId, tenantId },
  })
  if (!supplier) throw new Error('Supplier not found')

  const totals = calculateBillTotals(items)
  const issueDate = data.issueDate ? new Date(data.issueDate) : new Date()
  const dueDate = data.dueDate
    ? new Date(data.dueDate)
    : new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000)

  const bill = await prisma.bill.create({
    data: {
      tenantId,
      billNumber: await nextBillNumber(tenantId),
      supplierId: data.supplierId,
      purchaseOrderId: data.purchaseOrderId ?? null,
      status: 'DRAFT',
      issueDate,
      dueDate,
      items: items as unknown as Prisma.InputJsonValue,
      subtotal: toDecimal(totals.subtotal),
      taxTotal: toDecimal(totals.taxTotal),
      total: toDecimal(totals.total),
      amountPaid: toDecimal(0),
      amountDue: toDecimal(totals.total),
      currency: data.currency ?? 'USD',
      notes: data.notes ?? null,
      createdBy: actorId ?? null,
    },
  })

  await logBillAudit(tenantId, bill.id, 'BILL_CREATED', actorId, {
    billNumber: bill.billNumber,
    total: totals.total,
  })

  return getBill(tenantId, bill.id)
}

export async function createFromPO(purchaseOrderId: string, tenantId: string, actorId?: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, tenantId },
    include: {
      supplier: true,
      receipts: { orderBy: { receivedAt: 'desc' }, take: 1 },
    },
  })
  if (!po) throw new Error('Purchase order not found')

  const existing = await prisma.bill.findFirst({
    where: { tenantId, purchaseOrderId, status: { not: 'VOID' } },
  })

  const poItems = parsePoItems(po.items)
  const productIds = poItems.map((i) => i.productId)
  const products = await prisma.product.findMany({
    where: { tenantId, id: { in: productIds } },
    select: { id: true, name: true },
  })
  const productNames = new Map(products.map((p) => [p.id, p.name]))
  const billItems = buildBillItemsFromPoItems(poItems, productNames)

  if (!billItems.length) {
    throw new Error('No received items on purchase order to bill')
  }

  const totals = calculateBillTotals(billItems)
  const issueDate = po.receipts[0]?.receivedAt ?? new Date()
  const dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000)

  if (existing) {
    if (existing.status !== 'DRAFT') return getBill(tenantId, existing.id)
    if (toNumber(existing.amountPaid) > 0) return getBill(tenantId, existing.id)

    await prisma.bill.update({
      where: { id: existing.id },
      data: {
        items: billItems as unknown as Prisma.InputJsonValue,
        subtotal: toDecimal(totals.subtotal),
        taxTotal: toDecimal(totals.taxTotal),
        total: toDecimal(totals.total),
        amountDue: toDecimal(totals.total),
        issueDate,
        dueDate,
      },
    })
    await logBillAudit(tenantId, existing.id, 'BILL_UPDATED_FROM_PO', actorId)
    return getBill(tenantId, existing.id)
  }

  return createBill(
    tenantId,
    {
      supplierId: po.supplierId,
      purchaseOrderId: po.id,
      issueDate: issueDate.toISOString(),
      dueDate: dueDate.toISOString(),
      items: billItems,
      notes: po.notes,
      currency: po.currency,
    },
    actorId,
  )
}

export async function updateBill(
  tenantId: string,
  id: string,
  data: Partial<{
    supplierId: string
    issueDate: string
    dueDate: string
    items: Array<Omit<BillLineItem, 'lineTotal'> & { lineTotal?: number }>
    notes: string | null
    status: BillStatus
  }>,
  actorId?: string,
) {
  const existing = await prisma.bill.findFirst({ where: { id, tenantId } })
  if (!existing) throw new Error('Bill not found')
  if (existing.status === 'VOID') throw new Error('Cannot edit voided bill')
  if (existing.status === 'PAID') throw new Error('Cannot edit paid bill')
  if (toNumber(existing.amountPaid) > 0 && data.items) {
    throw new Error('Cannot change line items after payments recorded')
  }

  let items = parseBillItems(existing.items)
  if (data.items) items = normalizeBillItems(data.items as unknown[])
  const totals = calculateBillTotals(items)
  const amountPaid = toNumber(existing.amountPaid)
  const amountDue = Math.max(0, Math.round((totals.total - amountPaid) * 100) / 100)
  const dueDate = data.dueDate ? new Date(data.dueDate) : existing.dueDate

  let status = existing.status
  if (data.status === 'PENDING' && existing.status === 'DRAFT') {
    await ensureBillAccrual(id, tenantId, actorId)
    status = 'PENDING'
  } else if (data.status) {
    status = data.status
  } else {
    status = computeBillStatus(amountDue, amountPaid, dueDate, existing.status)
  }

  await prisma.bill.update({
    where: { id },
    data: {
      ...(data.supplierId && { supplierId: data.supplierId }),
      ...(data.issueDate && { issueDate: new Date(data.issueDate) }),
      ...(data.dueDate && { dueDate }),
      ...(data.items && { items: items as unknown as Prisma.InputJsonValue }),
      ...(data.notes !== undefined && { notes: data.notes }),
      subtotal: toDecimal(totals.subtotal),
      taxTotal: toDecimal(totals.taxTotal),
      total: toDecimal(totals.total),
      amountDue: toDecimal(amountDue),
      status,
    },
  })

  await logBillAudit(tenantId, id, 'BILL_UPDATED', actorId)
  return getBill(tenantId, id)
}

export async function ensureBillAccrual(billId: string, tenantId: string, actorId?: string) {
  const bill = await prisma.bill.findFirst({ where: { id: billId, tenantId } })
  if (!bill) throw new Error('Bill not found')
  if (bill.status === 'VOID') throw new Error('Cannot accrue voided bill')

  const existingJe = await prisma.journalEntry.findFirst({
    where: {
      tenantId,
      referenceType: 'BILL',
      referenceId: billId,
      status: 'POSTED',
    },
  })
  if (existingJe) return existingJe

  const total = toNumber(bill.total)
  if (total <= 0) return null

  const inventoryAccount = await resolveAccount(tenantId, GL_ACCOUNTS.INVENTORY.subtype, [...GL_ACCOUNTS.INVENTORY.codes])
  const apAccount = await resolveAccount(tenantId, GL_ACCOUNTS.AP.subtype, [...GL_ACCOUNTS.AP.codes])

  const journal = await post(
    tenantId,
    {
      date: bill.issueDate,
      description: `Bill ${bill.billNumber} — accrual`,
      reference: bill.billNumber,
      referenceType: 'BILL',
      referenceId: billId,
      lines: [
        {
          accountId: inventoryAccount.id,
          description: `Inventory — ${bill.billNumber}`,
          debit: total,
          credit: 0,
          currency: bill.currency,
        },
        {
          accountId: apAccount.id,
          description: `AP — ${bill.billNumber}`,
          debit: 0,
          credit: total,
          currency: bill.currency,
        },
      ],
      post: true,
    },
    actorId,
  )

  if (bill.status === 'DRAFT') {
    await prisma.bill.update({
      where: { id: billId },
      data: { status: 'PENDING' },
    })
  }

  return journal
}

export async function recordPayment(
  billId: string,
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
  const bill = await prisma.bill.findFirst({
    where: { id: billId, tenantId },
    include: { supplier: true },
  })
  if (!bill) throw new Error('Bill not found')
  if (['VOID', 'PAID'].includes(bill.status)) {
    throw new Error('Cannot record payment on this bill')
  }
  if (payment.amount <= 0) throw new Error('Payment amount must be positive')

  await ensureBillAccrual(billId, tenantId, actorId)

  const amountDue = toNumber(bill.amountDue)
  if (payment.amount > amountDue + 0.01) {
    throw new Error(`Payment exceeds amount due (${amountDue})`)
  }

  const apAccount = await resolveAccount(tenantId, GL_ACCOUNTS.AP.subtype, [...GL_ACCOUNTS.AP.codes])
  const bankAccount = await resolveAccount(tenantId, GL_ACCOUNTS.BANK.subtype, [...GL_ACCOUNTS.BANK.codes])

  const journal = await post(
    tenantId,
    {
      date: payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
      description: `Payment for ${bill.billNumber}`,
      reference: payment.reference ?? bill.billNumber,
      referenceType: 'PAYMENT',
      referenceId: billId,
      lines: [
        {
          accountId: apAccount.id,
          description: `AP clearance — ${bill.billNumber}`,
          debit: payment.amount,
          credit: 0,
          currency: bill.currency,
        },
        {
          accountId: bankAccount.id,
          description: `Bank — ${bill.billNumber}`,
          debit: 0,
          credit: payment.amount,
          currency: bill.currency,
        },
      ],
      post: true,
    },
    actorId,
  )

  await prisma.billPayment.create({
    data: {
      tenantId,
      billId,
      supplierId: bill.supplierId,
      amount: toDecimal(payment.amount),
      currency: bill.currency,
      paymentMethod: payment.paymentMethod ?? FinancePaymentMethod.BANK_TRANSFER,
      paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
      reference: payment.reference ?? null,
      notes: payment.notes ?? null,
      journalEntryId: journal.id,
    },
  })

  const newAmountPaid = toNumber(bill.amountPaid) + payment.amount
  const newAmountDue = Math.max(0, Math.round((toNumber(bill.total) - newAmountPaid) * 100) / 100)
  const newStatus = computeBillStatus(newAmountDue, newAmountPaid, bill.dueDate, bill.status)

  await prisma.bill.update({
    where: { id: billId },
    data: {
      amountPaid: toDecimal(newAmountPaid),
      amountDue: toDecimal(newAmountDue),
      status: newStatus,
    },
  })

  await logBillAudit(tenantId, billId, 'BILL_PAYMENT', actorId, { amount: payment.amount })
  emitSaiosEvent(tenantId, 'payment_received', {
    billId,
    billNumber: bill.billNumber,
    amount: payment.amount,
    supplierId: bill.supplierId,
  })

  return getBill(tenantId, billId)
}

export async function getApAgingReport(tenantId: string): Promise<{
  buckets: ApAgingBucket[]
  totalOutstanding: number
}> {
  const now = new Date()
  const openStatuses: BillStatus[] = ['PENDING', 'PARTIAL', 'OVERDUE']

  const bills = await prisma.bill.findMany({
    where: { tenantId, status: { in: openStatuses }, amountDue: { gt: 0 } },
    select: { amountDue: true, dueDate: true },
  })

  const buckets: ApAgingBucket[] = [
    { label: 'Current', count: 0, total: 0 },
    { label: '1–30 days', count: 0, total: 0 },
    { label: '31–60 days', count: 0, total: 0 },
    { label: '60+ days', count: 0, total: 0 },
  ]

  for (const bill of bills) {
    const due = toNumber(bill.amountDue)
    const daysPast = Math.floor((now.getTime() - bill.dueDate.getTime()) / (1000 * 60 * 60 * 24))
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

export async function getUpcomingBills(tenantId: string, days = 14) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  const bills = await prisma.bill.findMany({
    where: {
      tenantId,
      status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
      amountDue: { gt: 0 },
      dueDate: { gte: now, lte: end },
    },
    include: { supplier: { select: { name: true } } },
    orderBy: { dueDate: 'asc' },
    take: 20,
  })

  return bills.map((b) => ({
    id: b.id,
    billNumber: b.billNumber,
    supplierName: b.supplier.name,
    dueDate: b.dueDate.toISOString(),
    amountDue: toNumber(b.amountDue),
    currency: b.currency,
    status: b.status,
  }))
}

export async function checkOverdue(tenantId: string) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const overdueCandidates = await prisma.bill.findMany({
    where: {
      tenantId,
      dueDate: { lt: now },
      status: { in: ['PENDING', 'PARTIAL'] },
      amountDue: { gt: 0 },
    },
    include: { supplier: { select: { name: true } } },
  })

  let updated = 0
  for (const bill of overdueCandidates) {
    await prisma.bill.update({
      where: { id: bill.id },
      data: { status: 'OVERDUE' },
    })
    updated += 1

    emitSaiosEvent(tenantId, 'bill_overdue', {
      billId: bill.id,
      billNumber: bill.billNumber,
      amountDue: toNumber(bill.amountDue),
      supplierId: bill.supplierId,
    })

    const financeUsers = await prisma.user.findMany({
      where: { tenantId, role: { in: ['OWNER', 'CEO', 'FINANCE_OFFICER'] }, isActive: true },
      select: { id: true },
      take: 5,
    })

    for (const user of financeUsers) {
      await writeInAppNotification({
        tenantId,
        userId: user.id,
        type: 'ALERT',
        title: `Overdue bill ${bill.billNumber}`,
        body: `${bill.supplier.name} — ${toNumber(bill.amountDue)} ${bill.currency} past due.`,
        severity: 'WARNING',
        actionUrl: '/finance',
        actionLabel: 'View finance',
        metadata: { billId: bill.id },
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
