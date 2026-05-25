import {
  PurchaseOrderStatus,
  GoodsReceiptStatus,
  Prisma,
  type UserRole,
} from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/db/prisma'
import type { TenantSettings } from '@/lib/settings/types'
import { recordTransaction } from './stockEngine'
import { buildPurchaseOrderPdf } from './poPdfDocument'
import {
  extractSupplierAddress,
  extractSupplierEmail,
  formatWarehouseAddress,
  sendSupplierEmail,
} from './supplierEmail'
import { emitPOStatusChanged } from './inventoryWebhooks'
import { emitSaiosEvent } from '@/lib/workflows/eventBus'
import type { CreatePOInput, ReceiveGoodsInput, UpdatePOInput } from './purchaseOrderSchemas'
import { parsePoItems, type POItem, type ReceiptItem } from './purchaseOrderTypes'

export type { POItem, ReceiptItem } from './purchaseOrderTypes'

export interface POPdfLine {
  sku: string
  name: string
  quantity: number
  unitCost: number
  taxRate: number
  totalCost: number
}

export interface POPdfData {
  tenantName: string
  tenantAddress?: string | null
  poNumber: string
  orderDate: string
  supplierName: string
  supplierEmail?: string | null
  supplierAddress?: string | null
  warehouseName: string
  warehouseAddress?: string | null
  expectedDelivery?: string | null
  currency: string
  lines: POPdfLine[]
  subtotal: number
  taxTotal: number
  shippingCost: number
  grandTotal: number
  terms?: string | null
  notes?: string | null
}

export interface POListStats {
  pendingApproval: number
  overdueDeliveries: number
  monthTotal: number
}

export interface POListFilters {
  page?: number
  limit?: number
  status?: PurchaseOrderStatus
  supplierId?: string
  warehouseId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export class PurchaseOrderError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOT_FOUND'
      | 'INVALID_STATE'
      | 'APPROVAL_REQUIRED'
      | 'APPROVAL_DENIED'
      | 'VALIDATION_ERROR'
      | 'SUPPLIER_EMAIL_MISSING',
  ) {
    super(message)
    this.name = 'PurchaseOrderError'
  }
}

function toNumber(value: Decimal | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

function toDecimal(value: number): Decimal {
  return new Decimal(value)
}

function parseItems(raw: unknown): POItem[] {
  return parsePoItems(raw)
}

function buildLineItems(items: CreatePOInput['items']): POItem[] {
  return items.map((item) => {
    const lineSubtotal = item.quantity * item.unitCost
    const lineTax = lineSubtotal * (item.taxRate / 100)
    return {
      productId: item.productId,
      variantId: item.variantId ?? null,
      quantity: item.quantity,
      unitCost: item.unitCost,
      taxRate: item.taxRate,
      totalCost: lineSubtotal + lineTax,
      quantityReceived: 0,
    }
  })
}

function computeTotals(items: POItem[], shippingCost: number) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitCost, 0)
  const taxTotal = items.reduce(
    (s, i) => s + i.quantity * i.unitCost * (i.taxRate / 100),
    0,
  )
  const grandTotal = subtotal + taxTotal + shippingCost
  return { subtotal, taxTotal, grandTotal }
}

async function logPoAudit(
  tenantId: string,
  poId: string,
  action: string,
  userId: string | undefined,
  newValue?: Record<string, unknown>,
  previousValue?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action,
      resourceType: 'purchase_order',
      resourceId: poId,
      newValue: newValue as Prisma.InputJsonValue,
      previousValue: previousValue as Prisma.InputJsonValue,
    },
  })
}

async function nextPoNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PO-${year}-`
  const latest = await prisma.purchaseOrder.findFirst({
    where: { tenantId, poNumber: { startsWith: prefix } },
    orderBy: { poNumber: 'desc' },
    select: { poNumber: true },
  })
  const lastSeq = latest ? parseInt(latest.poNumber.split('-').pop() ?? '0', 10) : 0
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`
}

async function nextReceiptNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `GR-${year}-`
  const latest = await prisma.goodsReceipt.findFirst({
    where: { tenantId, receiptNumber: { startsWith: prefix } },
    orderBy: { receiptNumber: 'desc' },
    select: { receiptNumber: true },
  })
  const lastSeq = latest ? parseInt(latest.receiptNumber.split('-').pop() ?? '0', 10) : 0
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`
}

export async function getApprovalRuleForAmount(
  tenantId: string,
  amount: number,
): Promise<{ requiredApproverRole: UserRole } | null> {
  const rules = await prisma.pOApprovalRule.findMany({
    where: { tenantId, isActive: true },
    orderBy: { minAmount: 'desc' },
  })

  for (const rule of rules) {
    const min = toNumber(rule.minAmount)
    const max = rule.maxAmount != null ? toNumber(rule.maxAmount) : Infinity
    if (amount >= min && amount <= max) {
      return { requiredApproverRole: rule.requiredApproverRole }
    }
  }
  return null
}

export async function requiresApproval(tenantId: string, grandTotal: number): Promise<boolean> {
  const rule = await getApprovalRuleForAmount(tenantId, grandTotal)
  return rule != null
}

export async function createPO(
  tenantId: string,
  data: CreatePOInput,
  createdBy?: string,
): Promise<{ id: string; poNumber: string }> {
  const [supplier, warehouse] = await Promise.all([
    prisma.supplier.findFirst({ where: { id: data.supplierId, tenantId } }),
    prisma.warehouse.findFirst({ where: { id: data.warehouseId, tenantId, isActive: true } }),
  ])
  if (!supplier) throw new PurchaseOrderError('Supplier not found', 'NOT_FOUND')
  if (!warehouse) throw new PurchaseOrderError('Warehouse not found', 'NOT_FOUND')

  const productIds = data.items.map((i) => i.productId)
  const productCount = await prisma.product.count({
    where: { tenantId, id: { in: productIds }, isActive: true },
  })
  if (productCount !== productIds.length) {
    throw new PurchaseOrderError('One or more products not found', 'VALIDATION_ERROR')
  }

  const items = buildLineItems(data.items)
  const { subtotal, taxTotal, grandTotal } = computeTotals(items, data.shippingCost)
  const poNumber = await nextPoNumber(tenantId)

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  })
  const settings = (tenant?.settings ?? {}) as TenantSettings
  const currency = data.currency ?? settings.currency ?? 'USD'

  const po = await prisma.purchaseOrder.create({
    data: {
      tenantId,
      poNumber,
      supplierId: data.supplierId,
      warehouseId: data.warehouseId,
      items: items as unknown as Prisma.InputJsonValue,
      subtotal: toDecimal(subtotal),
      taxTotal: toDecimal(taxTotal),
      shippingCost: toDecimal(data.shippingCost),
      grandTotal: toDecimal(grandTotal),
      currency,
      expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null,
      terms: data.terms ?? null,
      notes: data.notes ?? null,
      createdBy,
      status: PurchaseOrderStatus.DRAFT,
    },
  })

  await logPoAudit(tenantId, po.id, 'PO_CREATED', createdBy, { poNumber, grandTotal })
  return { id: po.id, poNumber: po.poNumber }
}

export async function updatePO(
  tenantId: string,
  poId: string,
  data: UpdatePOInput,
  actorId?: string,
): Promise<void> {
  const existing = await prisma.purchaseOrder.findFirst({ where: { id: poId, tenantId } })
  if (!existing) throw new PurchaseOrderError('Purchase order not found', 'NOT_FOUND')
  if (existing.status !== PurchaseOrderStatus.DRAFT) {
    throw new PurchaseOrderError('Only draft POs can be edited', 'INVALID_STATE')
  }

  let items = parseItems(existing.items)
  if (data.items) {
    items = buildLineItems(data.items)
  }
  const shippingCost = data.shippingCost ?? toNumber(existing.shippingCost)
  const { subtotal, taxTotal, grandTotal } = computeTotals(items, shippingCost)

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      ...(data.supplierId && { supplierId: data.supplierId }),
      ...(data.warehouseId && { warehouseId: data.warehouseId }),
      ...(data.items && { items: items as unknown as Prisma.InputJsonValue }),
      ...(data.shippingCost !== undefined && { shippingCost: toDecimal(data.shippingCost) }),
      ...(data.currency && { currency: data.currency }),
      ...(data.expectedDelivery !== undefined && {
        expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null,
      }),
      ...(data.terms !== undefined && { terms: data.terms }),
      ...(data.notes !== undefined && { notes: data.notes }),
      subtotal: toDecimal(subtotal),
      taxTotal: toDecimal(taxTotal),
      grandTotal: toDecimal(grandTotal),
      approvedBy: null,
      approvedAt: null,
    },
  })

  await logPoAudit(tenantId, poId, 'PO_UPDATED', actorId, { grandTotal })
}

export async function deletePO(tenantId: string, poId: string, actorId?: string): Promise<void> {
  const existing = await prisma.purchaseOrder.findFirst({ where: { id: poId, tenantId } })
  if (!existing) throw new PurchaseOrderError('Purchase order not found', 'NOT_FOUND')
  if (existing.status !== PurchaseOrderStatus.DRAFT) {
    throw new PurchaseOrderError('Only draft POs can be deleted', 'INVALID_STATE')
  }
  await prisma.purchaseOrder.delete({ where: { id: poId } })
  await logPoAudit(tenantId, poId, 'PO_DELETED', actorId, { poNumber: existing.poNumber })
}

export async function approvePO(
  poId: string,
  approverId: string,
  approverRole: UserRole,
): Promise<void> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { supplier: true },
  })
  if (!po) throw new PurchaseOrderError('Purchase order not found', 'NOT_FOUND')
  if (po.status !== PurchaseOrderStatus.DRAFT) {
    throw new PurchaseOrderError('Only draft POs can be approved', 'INVALID_STATE')
  }

  const grandTotal = toNumber(po.grandTotal)
  const rule = await getApprovalRuleForAmount(po.tenantId, grandTotal)
  if (rule && approverRole !== rule.requiredApproverRole && !['OWNER', 'CEO'].includes(approverRole)) {
    throw new PurchaseOrderError(
      `This PO requires approval from ${rule.requiredApproverRole}`,
      'APPROVAL_DENIED',
    )
  }

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { approvedBy: approverId, approvedAt: new Date() },
  })

  await logPoAudit(po.tenantId, poId, 'PO_APPROVED', approverId, {
    poNumber: po.poNumber,
    grandTotal,
  })
}

export async function generatePODocument(poId: string): Promise<Buffer> {
  const data = await loadPdfData(poId)
  const element = buildPurchaseOrderPdf(data)
  return renderToBuffer(element)
}

async function loadPdfData(poId: string): Promise<POPdfData> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: {
      tenant: { select: { name: true, settings: true } },
      supplier: { select: { name: true, supplierInfo: true } },
      warehouse: { select: { name: true, address: true } },
    },
  })
  if (!po) throw new PurchaseOrderError('Purchase order not found', 'NOT_FOUND')

  const items = parseItems(po.items)
  const productIds = items.map((i) => i.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, sku: true, name: true },
  })
  const productMap = new Map(products.map((p) => [p.id, p]))

  const settings = (po.tenant.settings ?? {}) as TenantSettings

  return {
    tenantName: po.tenant.name,
    tenantAddress: settings.website ?? null,
    poNumber: po.poNumber,
    orderDate: po.createdAt.toLocaleDateString('en-US'),
    supplierName: po.supplier.name,
    supplierEmail: extractSupplierEmail(po.supplier.supplierInfo),
    supplierAddress: extractSupplierAddress(po.supplier.supplierInfo),
    warehouseName: po.warehouse.name,
    warehouseAddress: formatWarehouseAddress(po.warehouse.address),
    expectedDelivery: po.expectedDelivery?.toLocaleDateString('en-US') ?? null,
    currency: po.currency,
    lines: items.map((item) => {
      const product = productMap.get(item.productId)
      return {
        sku: product?.sku ?? item.productId,
        name: product?.name ?? 'Unknown product',
        quantity: item.quantity,
        unitCost: item.unitCost,
        taxRate: item.taxRate,
        totalCost: item.totalCost,
      }
    }),
    subtotal: toNumber(po.subtotal),
    taxTotal: toNumber(po.taxTotal),
    shippingCost: toNumber(po.shippingCost),
    grandTotal: toNumber(po.grandTotal),
    terms: po.terms,
    notes: po.notes,
  }
}

export async function sendPO(poId: string, actorId?: string): Promise<void> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { supplier: { select: { name: true, supplierInfo: true } } },
  })
  if (!po) throw new PurchaseOrderError('Purchase order not found', 'NOT_FOUND')
  if (po.status !== PurchaseOrderStatus.DRAFT) {
    throw new PurchaseOrderError('Only draft POs can be sent', 'INVALID_STATE')
  }

  const needsApproval = await requiresApproval(po.tenantId, toNumber(po.grandTotal))
  if (needsApproval && !po.approvedBy) {
    throw new PurchaseOrderError(
      'This purchase order requires approval before sending',
      'APPROVAL_REQUIRED',
    )
  }

  const supplierEmail = extractSupplierEmail(po.supplier.supplierInfo)
  if (!supplierEmail) {
    throw new PurchaseOrderError(
      'Supplier email not configured in supplier profile',
      'SUPPLIER_EMAIL_MISSING',
    )
  }

  const pdfBuffer = await generatePODocument(poId)

  await sendSupplierEmail({
    to: supplierEmail,
    subject: `Purchase Order ${po.poNumber}`,
    body: `Dear ${po.supplier.name},\n\nPlease find attached purchase order ${po.poNumber}.\n\nThank you,\nSAIOS Procurement`,
    pdfBuffer,
    pdfFilename: `${po.poNumber}.pdf`,
  })

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { status: PurchaseOrderStatus.SENT, sentAt: new Date() },
  })

  await logPoAudit(po.tenantId, poId, 'PO_SENT', actorId, {
    poNumber: po.poNumber,
    supplierEmail,
  })

  emitPOStatusChanged(po.tenantId, {
    poId,
    poNumber: po.poNumber,
    previousStatus: po.status,
    newStatus: PurchaseOrderStatus.SENT,
    supplierId: po.supplierId,
    supplierName: po.supplier.name,
  })
}

export async function receiveGoods(
  poId: string,
  receiptData: ReceiveGoodsInput,
  receivedBy?: string,
): Promise<{ receiptId: string; receiptNumber: string; poStatus: PurchaseOrderStatus }> {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } })
  if (!po) throw new PurchaseOrderError('Purchase order not found', 'NOT_FOUND')

  const receivableStatuses: PurchaseOrderStatus[] = [
    PurchaseOrderStatus.SENT,
    PurchaseOrderStatus.ACKNOWLEDGED,
    PurchaseOrderStatus.PARTIAL,
  ]
  if (!receivableStatuses.includes(po.status)) {
    throw new PurchaseOrderError(
      'Goods can only be received for sent or partial POs',
      'INVALID_STATE',
    )
  }

  const items = parseItems(po.items)
  const receiptNumber = await nextReceiptNumber(po.tenantId)

  const receiptItems: ReceiptItem[] = receiptData.items.map((row) => {
    const poItem = items[row.poItemIndex]
    if (!poItem) {
      throw new PurchaseOrderError(`Invalid line index ${row.poItemIndex}`, 'VALIDATION_ERROR')
    }
    const remaining = poItem.quantity - poItem.quantityReceived
    if (row.quantityReceived > remaining) {
      throw new PurchaseOrderError(
        `Cannot receive ${row.quantityReceived} for line ${row.poItemIndex}; only ${remaining} remaining`,
        'VALIDATION_ERROR',
      )
    }
    return {
      poItemIndex: row.poItemIndex,
      quantityReceived: row.quantityReceived,
      unitCost: row.unitCost ?? poItem.unitCost,
      batchNumber: row.batchNumber ?? null,
      expiryDate: row.expiryDate ?? null,
    }
  })

  const receipt = await prisma.goodsReceipt.create({
    data: {
      tenantId: po.tenantId,
      purchaseOrderId: po.id,
      receiptNumber,
      warehouseId: po.warehouseId,
      status: GoodsReceiptStatus.COMPLETE,
      items: receiptItems as unknown as Prisma.InputJsonValue,
      receivedBy,
      receivedAt: new Date(),
      notes: receiptData.notes ?? null,
    },
  })

  for (const row of receiptItems) {
    const poItem = items[row.poItemIndex]
    poItem.quantityReceived += row.quantityReceived

    await recordTransaction(po.tenantId, {
      productId: poItem.productId,
      variantId: poItem.variantId,
      warehouseId: po.warehouseId,
      transactionType: 'PURCHASE',
      quantity: row.quantityReceived,
      unitCost: row.unitCost,
      referenceType: 'GOODS_RECEIPT',
      referenceId: receipt.id,
      notes: row.batchNumber ? `Batch: ${row.batchNumber}` : undefined,
      performedBy: receivedBy,
    })
  }

  const allReceived = items.every((i) => i.quantityReceived >= i.quantity)
  const anyReceived = items.some((i) => i.quantityReceived > 0)
  const newStatus = allReceived
    ? PurchaseOrderStatus.RECEIVED
    : anyReceived
      ? PurchaseOrderStatus.PARTIAL
      : po.status

  await prisma.purchaseOrder.update({
    where: { id: po.id },
    data: { status: newStatus, items: items as unknown as Prisma.InputJsonValue },
  })

  await logPoAudit(po.tenantId, po.id, 'GOODS_RECEIVED', receivedBy, {
    receiptNumber,
    poStatus: newStatus,
    items: receiptItems,
  })

  if (newStatus !== po.status) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: po.supplierId },
      select: { name: true },
    })
    emitPOStatusChanged(po.tenantId, {
      poId: po.id,
      poNumber: po.poNumber,
      previousStatus: po.status,
      newStatus,
      supplierId: po.supplierId,
      supplierName: supplier?.name,
    })
  }

  try {
    const { createFromPO } = await import('@/lib/finance/billService')
    await createFromPO(po.id, po.tenantId, receivedBy)
  } catch {
    // Draft bill creation is best-effort when no received qty yet
  }

  emitSaiosEvent(po.tenantId, 'goods_received', {
    poId: po.id,
    poNumber: po.poNumber,
    receiptId: receipt.id,
    receiptNumber,
    poStatus: newStatus,
    supplierId: po.supplierId,
  })

  return { receiptId: receipt.id, receiptNumber, poStatus: newStatus }
}

export async function getPO(tenantId: string, poId: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, tenantId },
    include: {
      supplier: { select: { id: true, name: true, supplierInfo: true } },
      warehouse: { select: { id: true, name: true, code: true, address: true } },
      creator: { select: { id: true, fullName: true, email: true } },
      approver: { select: { id: true, fullName: true, email: true } },
      receipts: {
        orderBy: { receivedAt: 'desc' },
        include: { receiver: { select: { fullName: true } } },
      },
    },
  })
  if (!po) throw new PurchaseOrderError('Purchase order not found', 'NOT_FOUND')

  const items = parseItems(po.items)
  const productIds = items.map((i) => i.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, sku: true, name: true, unit: true },
  })
  const productMap = new Map(products.map((p) => [p.id, p]))

  const needsApproval = await requiresApproval(tenantId, toNumber(po.grandTotal))
  const approvalRule = await getApprovalRuleForAmount(tenantId, toNumber(po.grandTotal))

  const timeline = await prisma.auditLog.findMany({
    where: { tenantId, resourceType: 'purchase_order', resourceId: poId },
    orderBy: { timestamp: 'desc' },
    include: { user: { select: { fullName: true, email: true } } },
  })

  return {
    ...po,
    subtotal: toNumber(po.subtotal),
    taxTotal: toNumber(po.taxTotal),
    shippingCost: toNumber(po.shippingCost),
    grandTotal: toNumber(po.grandTotal),
    items: items.map((item) => ({
      ...item,
      product: productMap.get(item.productId) ?? null,
    })),
    needsApproval,
    approvalRule,
    supplierEmail: extractSupplierEmail(po.supplier.supplierInfo),
    timeline,
  }
}

export async function listPOs(tenantId: string, filters: POListFilters = {}) {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20

  const where: Prisma.PurchaseOrderWhereInput = {
    tenantId,
    ...(filters.status && { status: filters.status }),
    ...(filters.supplierId && { supplierId: filters.supplierId }),
    ...(filters.warehouseId && { warehouseId: filters.warehouseId }),
    ...(filters.search && {
      OR: [
        { poNumber: { contains: filters.search, mode: 'insensitive' } },
        { supplier: { name: { contains: filters.search, mode: 'insensitive' } } },
      ],
    }),
    ...(filters.dateFrom || filters.dateTo
      ? {
          createdAt: {
            ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
            ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
          },
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        approver: { select: { fullName: true } },
      },
    }),
    prisma.purchaseOrder.count({ where }),
  ])

  const enriched = await Promise.all(
    rows.map(async (po) => {
      const needsApproval = await requiresApproval(tenantId, toNumber(po.grandTotal))
      return {
        ...po,
        subtotal: toNumber(po.subtotal),
        taxTotal: toNumber(po.taxTotal),
        shippingCost: toNumber(po.shippingCost),
        grandTotal: toNumber(po.grandTotal),
        needsApproval,
        approvalStatus: needsApproval
          ? po.approvedBy
            ? 'APPROVED'
            : 'PENDING'
          : 'NOT_REQUIRED',
      }
    }),
  )

  const stats = await getPOListStats(tenantId)

  return { data: enriched, total, stats, page, limit }
}

export async function getPOListStats(tenantId: string): Promise<POListStats> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [draftPos, overdue, monthAgg] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { tenantId, status: PurchaseOrderStatus.DRAFT },
      select: { grandTotal: true, approvedBy: true },
    }),
    prisma.purchaseOrder.count({
      where: {
        tenantId,
        expectedDelivery: { lt: now },
        status: {
          in: [
            PurchaseOrderStatus.SENT,
            PurchaseOrderStatus.ACKNOWLEDGED,
            PurchaseOrderStatus.PARTIAL,
          ],
        },
      },
    }),
    prisma.purchaseOrder.aggregate({
      where: { tenantId, createdAt: { gte: monthStart } },
      _sum: { grandTotal: true },
    }),
  ])

  let pendingApproval = 0
  for (const po of draftPos) {
    if ((await requiresApproval(tenantId, toNumber(po.grandTotal))) && !po.approvedBy) {
      pendingApproval++
    }
  }

  return {
    pendingApproval,
    overdueDeliveries: overdue,
    monthTotal: toNumber(monthAgg._sum.grandTotal),
  }
}
