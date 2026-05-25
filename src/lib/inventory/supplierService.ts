import {
  PaymentTerms,
  Prisma,
  PurchaseOrderStatus,
  SupplierType,
} from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/db/prisma'
import { encryptField, decryptField } from '@/lib/security/encryption'
import { createSupabaseServerClient } from '@/lib/auth/supabaseServer'
import { computeSupplierPerformanceAnalytics } from '@/lib/inventory/supplierPerformanceAnalytics'
import type {
  SupplierContactInput,
  SupplierCreateInput,
  SupplierProductInput,
  SupplierUpdateInput,
} from './supplierSchemas'

function toNumber(value: Decimal | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

function toDecimal(value: number): Decimal {
  return new Decimal(value)
}

async function generateSupplierCode(tenantId: string): Promise<string> {
  const count = await prisma.supplier.count({ where: { tenantId } })
  const seq = count + 1
  let code = `SUP-${String(seq).padStart(4, '0')}`
  let exists = await prisma.supplier.findFirst({ where: { tenantId, code } })
  let attempt = seq
  while (exists) {
    attempt += 1
    code = `SUP-${String(attempt).padStart(4, '0')}`
    exists = await prisma.supplier.findFirst({ where: { tenantId, code } })
  }
  return code
}

async function ensureSupplierCode(tenantId: string, supplierId: string, currentCode: string): Promise<string> {
  if (currentCode) return currentCode
  const code = await generateSupplierCode(tenantId)
  await prisma.supplier.update({ where: { id: supplierId }, data: { code } })
  return code
}

function mapBankDetails(enc: string | null, tenantId: string): Record<string, unknown> | null {
  if (!enc) return null
  try {
    return JSON.parse(decryptField(enc, tenantId)) as Record<string, unknown>
  } catch {
    return null
  }
}

export function maskBankDetails(enc: string | null, tenantId: string): Record<string, unknown> | null {
  const full = mapBankDetails(enc, tenantId)
  if (!full) return null
  const accountNumber = String(full.accountNumber ?? '')
  const last4 = accountNumber.length >= 4 ? accountNumber.slice(-4) : '****'
  return {
    bankName: full.bankName ?? null,
    accountName: full.accountName ?? null,
    accountLast4: last4,
    routingNumber: full.routingNumber ? `****${String(full.routingNumber).slice(-4)}` : null,
    swiftCode: full.swiftCode ?? null,
  }
}

export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  })
  if (!user?.passwordHash) return false
  return verifyPassword(password, user.passwordHash)
}

function serializeSupplier(
  row: Prisma.SupplierGetPayload<{
    include: {
      contacts: true
      _count: { select: { purchaseOrders: true; supplierProducts: true } }
    }
  }>,
  tenantId: string,
  extras?: { activePoCount?: number; lastOrderDate?: string | null },
) {
  const metrics = (row.reliabilityMetrics ?? {}) as Record<string, unknown>
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    contactName: row.contactName ?? String(metrics.contact ?? ''),
    email: row.email ?? String(metrics.contactEmail ?? ''),
    phone: row.phone,
    mobile: row.mobile,
    website: row.website,
    address: row.address as Record<string, unknown>,
    paymentTerms: row.paymentTerms,
    currency: row.currency,
    taxNumber: row.taxNumber,
    bankDetails: null,
    bankDetailsMasked: maskBankDetails(row.bankDetailsEnc, tenantId),
    creditLimit: row.creditLimit != null ? toNumber(row.creditLimit) : null,
    isActive: row.isActive,
    notes: row.notes,
    rating: row.rating != null ? toNumber(row.rating) : null,
    performanceScore: row.performanceScore,
    reliabilityStars: Math.round((row.performanceScore / 100) * 5 * 10) / 10,
    activePoCount: extras?.activePoCount ?? 0,
    productCount: row._count?.supplierProducts ?? 0,
    poCount: row._count?.purchaseOrders ?? 0,
    lastOrderDate: extras?.lastOrderDate ?? null,
    contacts: row.contacts?.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      designation: c.designation,
      isPrimary: c.isPrimary,
      isActive: c.isActive,
    })) ?? [],
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export interface SupplierListFilters {
  page?: number
  limit?: number
  search?: string
  type?: SupplierType
  paymentTerms?: PaymentTerms
  minScore?: number
  maxScore?: number
  status?: 'active' | 'inactive' | 'all'
  sort?: 'name' | 'reliability' | 'lastOrder'
  order?: 'asc' | 'desc'
}

export async function listSuppliers(tenantId: string, filters: SupplierListFilters = {}) {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20

  const where: Prisma.SupplierWhereInput = {
    tenantId,
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { code: { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
            { contactName: { contains: filters.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(filters.type && { type: filters.type }),
    ...(filters.paymentTerms && { paymentTerms: filters.paymentTerms }),
    ...(filters.minScore != null || filters.maxScore != null
      ? {
          performanceScore: {
            ...(filters.minScore != null ? { gte: filters.minScore } : {}),
            ...(filters.maxScore != null ? { lte: filters.maxScore } : {}),
          },
        }
      : {}),
    ...(filters.status === 'active' && { isActive: true }),
    ...(filters.status === 'inactive' && { isActive: false }),
  }

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  const order = filters.order ?? 'desc'
  const orderBy =
    filters.sort === 'name'
      ? { name: order }
      : filters.sort === 'reliability'
        ? { performanceScore: order }
        : { updatedAt: order }

  const [rows, total, stats] = await Promise.all([
    prisma.supplier.findMany({
      where,
      skip: filters.sort === 'lastOrder' ? 0 : (page - 1) * limit,
      take: filters.sort === 'lastOrder' ? 500 : limit,
      orderBy: filters.sort === 'lastOrder' ? { name: 'asc' } : orderBy,
      include: {
        contacts: { where: { isPrimary: true }, take: 1 },
        _count: { select: { purchaseOrders: true, supplierProducts: true } },
        purchaseOrders: {
          where: { status: { in: ['DRAFT', 'SENT', 'ACKNOWLEDGED', 'PARTIAL'] } },
          select: { id: true },
        },
      },
    }),
    prisma.supplier.count({ where }),
    prisma.$queryRaw<Array<{ total: bigint; active: bigint; avg_score: number; pos_month: bigint }>>`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE "isActive" = true) AS active,
        COALESCE(AVG("performanceScore"), 0)::float AS avg_score,
        (
          SELECT COUNT(*) FROM purchase_orders po
          WHERE po."tenantId" = ${tenantId}
            AND po."createdAt" >= ${monthStart}
        ) AS pos_month
      FROM suppliers
      WHERE "tenantId" = ${tenantId}
    `,
  ])

  const lastOrders = await prisma.purchaseOrder.groupBy({
    by: ['supplierId'],
    where: { tenantId, supplierId: { in: rows.map((r) => r.id) } },
    _max: { createdAt: true },
  })
  const lastOrderMap = new Map(lastOrders.map((o) => [o.supplierId, o._max.createdAt]))

  let items = await Promise.all(
    rows.map(async (row) => {
      const code = await ensureSupplierCode(tenantId, row.id, row.code)
      const last = lastOrderMap.get(row.id)
      return serializeSupplier(
        { ...row, code },
        tenantId,
        {
          activePoCount: row.purchaseOrders.length,
          lastOrderDate: last ? last.toISOString() : null,
        },
      )
    }),
  )

  if (filters.sort === 'lastOrder') {
    const dir = filters.order === 'asc' ? 1 : -1
    items.sort((a, b) => {
      const at = a.lastOrderDate ? new Date(a.lastOrderDate).getTime() : 0
      const bt = b.lastOrderDate ? new Date(b.lastOrderDate).getTime() : 0
      return (at - bt) * dir
    })
    items = items.slice((page - 1) * limit, page * limit)
  }

  const s = stats[0] ?? { total: BigInt(0), active: BigInt(0), avg_score: 0, pos_month: BigInt(0) }

  return {
    items,
    stats: {
      totalSuppliers: Number(s.total),
      activeSuppliers: Number(s.active),
      avgReliabilityScore: Math.round(s.avg_score * 10) / 10,
      posThisMonth: Number(s.pos_month),
    },
    page,
    limit,
    total,
  }
}

export async function getSupplier(
  tenantId: string,
  supplierId: string,
  options?: { unlockPassword?: string; actorId?: string },
) {
  const row = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId },
    include: {
      contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] },
      _count: { select: { purchaseOrders: true, supplierProducts: true, products: true } },
    },
  })
  if (!row) throw new Error('Supplier not found')

  const code = await ensureSupplierCode(tenantId, row.id, row.code)

  const [activePos, lastOrder] = await Promise.all([
    prisma.purchaseOrder.count({
      where: {
        tenantId,
        supplierId,
        status: { in: ['DRAFT', 'SENT', 'ACKNOWLEDGED', 'PARTIAL'] },
      },
    }),
    prisma.purchaseOrder.findFirst({
      where: { tenantId, supplierId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ])

  const base = serializeSupplier({ ...row, code }, tenantId, {
    activePoCount: activePos,
    lastOrderDate: lastOrder?.createdAt.toISOString() ?? null,
  })

  let bankDetails: Record<string, unknown> | null = null
  if (options?.unlockPassword && options.actorId) {
    const ok = await verifyUserPassword(options.actorId, tenantId, options.unlockPassword)
    if (ok) {
      bankDetails = mapBankDetails(row.bankDetailsEnc, tenantId)
    } else {
      throw new Error('Invalid password — cannot unlock bank details')
    }
  }

  return {
    ...base,
    bankDetails,
    deliveryHistory: row.deliveryHistory,
    costTrends: row.costTrends,
    reliabilityMetrics: row.reliabilityMetrics,
    linkedProductCount: row._count.products,
  }
}

export async function createSupplier(tenantId: string, input: SupplierCreateInput, actorId?: string) {
  void actorId
  const code = await generateSupplierCode(tenantId)

  let bankDetailsEnc: string | null = null
  if (input.bankDetails && Object.keys(input.bankDetails).length > 0) {
    bankDetailsEnc = encryptField(JSON.stringify(input.bankDetails), tenantId)
  }

  const supplier = await prisma.supplier.create({
    data: {
      tenantId,
      code,
      name: input.name,
      type: input.type as SupplierType,
      contactName: input.contactName ?? null,
      email: input.email || null,
      phone: input.phone ?? null,
      mobile: input.mobile ?? null,
      website: input.website || null,
      address: (input.address ?? {}) as Prisma.InputJsonValue,
      paymentTerms: input.paymentTerms as PaymentTerms,
      currency: input.currency ?? 'USD',
      taxNumber: input.taxNumber ?? null,
      bankDetailsEnc,
      creditLimit: input.creditLimit != null ? toDecimal(input.creditLimit) : null,
      isActive: input.isActive ?? true,
      notes: input.notes ?? null,
      rating: input.rating != null ? toDecimal(input.rating) : null,
      reliabilityMetrics: {
        contactEmail: input.email ?? null,
        contact: input.contactName ?? null,
        paymentTerms: input.paymentTerms,
        isActive: input.isActive ?? true,
      } as Prisma.InputJsonValue,
      contacts: input.contacts?.length
        ? {
            create: input.contacts.map((c) => ({
              tenantId,
              name: c.name,
              email: c.email ?? null,
              phone: c.phone ?? null,
              designation: c.designation ?? null,
              isPrimary: c.isPrimary ?? false,
            })),
          }
        : undefined,
    },
    include: {
      contacts: true,
      _count: { select: { purchaseOrders: true, supplierProducts: true } },
    },
  })

  return serializeSupplier(supplier, tenantId, { activePoCount: 0, lastOrderDate: null })
}

export async function updateSupplier(
  tenantId: string,
  supplierId: string,
  input: SupplierUpdateInput,
) {
  const existing = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } })
  if (!existing) throw new Error('Supplier not found')

  if (input.version != null && input.version !== existing.version) {
    throw new Error('Supplier was modified by another user. Please refresh and try again.')
  }

  let bankDetailsEnc = existing.bankDetailsEnc
  if (input.bankDetails !== undefined) {
    bankDetailsEnc = input.bankDetails && Object.keys(input.bankDetails).length > 0
      ? encryptField(JSON.stringify(input.bankDetails), tenantId)
      : null
  }

  const metrics = { ...(existing.reliabilityMetrics as Record<string, unknown>) }
  if (input.email !== undefined) metrics.contactEmail = input.email
  if (input.contactName !== undefined) metrics.contact = input.contactName
  if (input.paymentTerms !== undefined) metrics.paymentTerms = input.paymentTerms
  if (input.isActive !== undefined) metrics.isActive = input.isActive

  const updated = await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type as SupplierType }),
      ...(input.contactName !== undefined && { contactName: input.contactName }),
      ...(input.email !== undefined && { email: input.email || null }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.mobile !== undefined && { mobile: input.mobile }),
      ...(input.website !== undefined && { website: input.website || null }),
      ...(input.address !== undefined && { address: input.address as Prisma.InputJsonValue }),
      ...(input.paymentTerms !== undefined && { paymentTerms: input.paymentTerms as PaymentTerms }),
      ...(input.currency !== undefined && { currency: input.currency }),
      ...(input.taxNumber !== undefined && { taxNumber: input.taxNumber }),
      bankDetailsEnc,
      ...(input.creditLimit !== undefined && {
        creditLimit: input.creditLimit != null ? toDecimal(input.creditLimit) : null,
      }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.rating !== undefined && {
        rating: input.rating != null ? toDecimal(input.rating) : null,
      }),
      reliabilityMetrics: metrics as Prisma.InputJsonValue,
      version: { increment: 1 },
    },
    include: {
      contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] },
      _count: { select: { purchaseOrders: true, supplierProducts: true } },
    },
  })

  return getSupplier(tenantId, updated.id)
}

export async function deleteSupplier(tenantId: string, supplierId: string) {
  const poCount = await prisma.purchaseOrder.count({
    where: { tenantId, supplierId, status: { not: 'CANCELLED' } },
  })
  if (poCount > 0) {
    throw new Error('Cannot delete supplier with active purchase orders')
  }

  await prisma.supplier.deleteMany({ where: { id: supplierId, tenantId } })
  return { deleted: true }
}

export async function listSupplierProducts(tenantId: string, supplierId: string) {
  const rows = await prisma.supplierProduct.findMany({
    where: { tenantId, supplierId },
    include: {
      product: {
        select: { id: true, sku: true, name: true, costPrice: true, sellingPrice: true, isActive: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    supplierSku: r.supplierSku,
    unitCost: toNumber(r.unitCost),
    minOrderQty: r.minOrderQty,
    leadTimeDays: r.leadTimeDays,
    isPreferred: r.isPreferred,
    lastPriceDate: r.lastPriceDate?.toISOString() ?? null,
    product: {
      ...r.product,
      costPrice: toNumber(r.product.costPrice),
      sellingPrice: toNumber(r.product.sellingPrice),
    },
  }))
}

export async function upsertSupplierProduct(
  tenantId: string,
  supplierId: string,
  input: SupplierProductInput,
) {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, tenantId },
  })
  if (!product) throw new Error('Product not found')

  const row = await prisma.supplierProduct.upsert({
    where: {
      tenantId_supplierId_productId: { tenantId, supplierId, productId: input.productId },
    },
    create: {
      tenantId,
      supplierId,
      productId: input.productId,
      supplierSku: input.supplierSku ?? null,
      unitCost: toDecimal(input.unitCost),
      minOrderQty: input.minOrderQty ?? 1,
      leadTimeDays: input.leadTimeDays ?? 7,
      isPreferred: input.isPreferred ?? false,
      lastPriceDate: new Date(),
    },
    update: {
      supplierSku: input.supplierSku ?? null,
      unitCost: toDecimal(input.unitCost),
      minOrderQty: input.minOrderQty ?? 1,
      leadTimeDays: input.leadTimeDays ?? 7,
      isPreferred: input.isPreferred ?? false,
      lastPriceDate: new Date(),
    },
    include: {
      product: { select: { id: true, sku: true, name: true } },
    },
  })

  if (input.isPreferred) {
    await prisma.product.update({
      where: { id: input.productId },
      data: { supplierId, costPrice: toDecimal(input.unitCost), leadTimeDays: input.leadTimeDays ?? 7 },
    })
  }

  return {
    id: row.id,
    productId: row.productId,
    supplierSku: row.supplierSku,
    unitCost: toNumber(row.unitCost),
    minOrderQty: row.minOrderQty,
    leadTimeDays: row.leadTimeDays,
    isPreferred: row.isPreferred,
    lastPriceDate: row.lastPriceDate?.toISOString() ?? null,
    product: row.product,
  }
}

export async function listSupplierPurchaseOrders(
  tenantId: string,
  supplierId: string,
  status?: PurchaseOrderStatus,
) {
  const rows = await prisma.purchaseOrder.findMany({
    where: {
      tenantId,
      supplierId,
      ...(status && { status }),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      poNumber: true,
      status: true,
      grandTotal: true,
      currency: true,
      expectedDelivery: true,
      createdAt: true,
      warehouse: { select: { name: true, code: true } },
    },
  })

  return rows.map((r) => ({
    ...r,
    grandTotal: toNumber(r.grandTotal),
    expectedDelivery: r.expectedDelivery?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function getSupplierPerformance(tenantId: string, supplierId: string) {
  return computeSupplierPerformanceAnalytics(tenantId, supplierId)
}

export async function deleteSupplierProduct(
  tenantId: string,
  supplierId: string,
  linkId: string,
) {
  const row = await prisma.supplierProduct.findFirst({
    where: { id: linkId, tenantId, supplierId },
  })
  if (!row) throw new Error('Supplier product link not found')
  await prisma.supplierProduct.delete({ where: { id: linkId } })
  return { deleted: true }
}

export async function updateSupplierProduct(
  tenantId: string,
  supplierId: string,
  linkId: string,
  input: Partial<{
    supplierSku: string | null
    unitCost: number
    minOrderQty: number
    leadTimeDays: number
    isPreferred: boolean
  }>,
) {
  const existing = await prisma.supplierProduct.findFirst({
    where: { id: linkId, tenantId, supplierId },
  })
  if (!existing) throw new Error('Supplier product link not found')

  const row = await prisma.supplierProduct.update({
    where: { id: linkId },
    data: {
      ...(input.supplierSku !== undefined && { supplierSku: input.supplierSku }),
      ...(input.unitCost !== undefined && { unitCost: toDecimal(input.unitCost) }),
      ...(input.minOrderQty !== undefined && { minOrderQty: input.minOrderQty }),
      ...(input.leadTimeDays !== undefined && { leadTimeDays: input.leadTimeDays }),
      ...(input.isPreferred !== undefined && { isPreferred: input.isPreferred }),
      lastPriceDate: new Date(),
    },
    include: { product: { select: { id: true, sku: true, name: true } } },
  })

  if (input.isPreferred) {
    await prisma.product.update({
      where: { id: row.productId },
      data: {
        supplierId,
        costPrice: input.unitCost != null ? toDecimal(input.unitCost) : row.unitCost,
        leadTimeDays: input.leadTimeDays ?? row.leadTimeDays,
      },
    })
  }

  return {
    id: row.id,
    productId: row.productId,
    supplierSku: row.supplierSku,
    unitCost: toNumber(row.unitCost),
    minOrderQty: row.minOrderQty,
    leadTimeDays: row.leadTimeDays,
    isPreferred: row.isPreferred,
    lastPriceDate: row.lastPriceDate?.toISOString() ?? null,
    product: row.product,
  }
}

export async function bulkUpdateSupplierProductPrices(
  tenantId: string,
  supplierId: string,
  rows: Array<{ productId: string; unitCost: number }>,
) {
  let updated = 0
  for (const row of rows) {
    if (!row.productId || row.unitCost == null || Number.isNaN(row.unitCost)) continue
    await upsertSupplierProduct(tenantId, supplierId, {
      productId: row.productId,
      unitCost: Number(row.unitCost),
      minOrderQty: 1,
      leadTimeDays: 7,
      isPreferred: false,
    })
    updated++
  }
  return { updated }
}

export async function listSupplierContacts(tenantId: string, supplierId: string) {
  return prisma.supplierContact.findMany({
    where: { tenantId, supplierId },
    orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
  })
}

export async function createSupplierContact(
  tenantId: string,
  supplierId: string,
  input: SupplierContactInput,
) {
  if (input.isPrimary) {
    await prisma.supplierContact.updateMany({
      where: { tenantId, supplierId },
      data: { isPrimary: false },
    })
  }

  return prisma.supplierContact.create({
    data: {
      tenantId,
      supplierId,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      designation: input.designation ?? null,
      isPrimary: input.isPrimary ?? false,
      isActive: input.isActive ?? true,
    },
  })
}

export async function deleteSupplierContact(tenantId: string, supplierId: string, contactId: string) {
  const contact = await prisma.supplierContact.findFirst({
    where: { id: contactId, tenantId, supplierId },
  })
  if (!contact) throw new Error('Contact not found')
  await prisma.supplierContact.delete({ where: { id: contactId } })
  return { deleted: true }
}

export async function importSuppliersFromCsv(tenantId: string, rows: Array<Record<string, string>>) {
  const created: string[] = []
  for (const row of rows) {
    if (!row.name?.trim()) continue
    const supplier = await createSupplier(tenantId, {
      name: row.name.trim(),
      type: (row.type?.toUpperCase() as SupplierCreateInput['type']) || 'DISTRIBUTOR',
      contactName: row.contactName?.trim() || row.contact?.trim() || null,
      email: row.email?.trim() || null,
      phone: row.phone?.trim() || null,
      paymentTerms: (row.paymentTerms?.toUpperCase().replace(/\s/g, '') as SupplierCreateInput['paymentTerms']) || 'NET30',
      currency: row.currency?.trim()?.toUpperCase() || 'USD',
      isActive: true,
    })
    created.push(supplier.id)
  }
  return { imported: created.length, ids: created }
}
