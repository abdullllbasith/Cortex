import { Prisma, StockTransactionType } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/db/prisma'
import { recordTransaction } from './stockEngine'
import { classifyStock, type StockHealth } from './inventoryDashboardService'
import { computeGrossMargin } from './valuationService'
import { resolveCategoryIdByName } from './inventoryCategoryService'

function toNumber(value: Decimal | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

function toDecimal(value: number): Decimal {
  return new Decimal(value)
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function buildProductSku(provided?: unknown): string {
  return normalizeOptionalString(provided) ?? `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function buildProductSlug(name: string, provided?: unknown): string {
  const normalized = normalizeOptionalString(provided)
  if (normalized) return normalized
  const base = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${base || 'product'}-${Date.now().toString(36)}`
}

async function resolveAuditUserId(actorId?: string): Promise<string | null> {
  if (!actorId) return null
  const user = await prisma.user.findFirst({ where: { id: actorId }, select: { id: true } })
  return user?.id ?? null
}

export interface CatalogFilters {
  page?: number
  limit?: number
  search?: string
  categoryId?: string
  supplierId?: string
  status?: 'active' | 'inactive' | 'all'
  stockHealth?: StockHealth
}

export async function listCatalogProducts(tenantId: string, filters: CatalogFilters = {}) {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 24

  const where: Prisma.ProductWhereInput = {
    tenantId,
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { sku: { contains: filters.search, mode: 'insensitive' } },
            { barcode: { contains: filters.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(filters.categoryId && { categoryId: filters.categoryId }),
    ...(filters.supplierId && { supplierId: filters.supplierId }),
    ...(filters.status === 'active' && { isActive: true }),
    ...(filters.status === 'inactive' && { isActive: false }),
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        stockBalances: {
          select: { quantityOnHand: true, quantityOnOrder: true },
        },
      },
    }),
    prisma.product.count({ where }),
  ])

  let items = products.map((p) => {
    const onHand = p.stockBalances.reduce((s, b) => s + toNumber(b.quantityOnHand), 0)
    const onOrder = p.stockBalances.reduce((s, b) => s + toNumber(b.quantityOnOrder), 0)
    const reorderPoint = toNumber(p.reorderPoint)
    return {
      id: p.id,
      sku: p.sku,
      barcode: p.barcode,
      name: p.name,
      slug: p.slug,
      description: p.description,
      category: p.category,
      supplier: p.supplier,
      unit: p.unit,
      costPrice: toNumber(p.costPrice),
      sellingPrice: toNumber(p.sellingPrice),
      imageUrls: p.imageUrls,
      isActive: p.isActive,
      trackInventory: p.trackInventory,
      onHand,
      onOrder,
      reorderPoint,
      stockHealth: classifyStock(onHand, reorderPoint),
    }
  })

  if (filters.stockHealth) {
    items = items.filter((i) => i.stockHealth === filters.stockHealth)
  }

  return { items, total, page, limit }
}

export async function getProductDetail(tenantId: string, productId: string, opts: { includeAnalytics?: boolean } = {}) {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    include: {
      category: true,
      supplier: { select: { id: true, name: true, supplierInfo: true } },
      variants: {
        include: {
          stockBalances: {
            include: { warehouse: { select: { id: true, name: true, code: true } } },
          },
        },
      },
      stockBalances: {
        include: { warehouse: { select: { id: true, name: true, code: true } } },
      },
    },
  })
  if (!product) return null

  const onHand = product.stockBalances.reduce((s, b) => s + toNumber(b.quantityOnHand), 0)
  const reorderPoint = toNumber(product.reorderPoint)

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000)
  const ledgerEntries = await prisma.stockLedger.findMany({
    where: { tenantId, productId, createdAt: { gte: ninetyDaysAgo } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true, quantity: true, transactionType: true },
  })

  let running = 0
  const stockTrendByDay = new Map<string, number>()
  for (const entry of ledgerEntries) {
    const qty = toNumber(entry.quantity)
    if (['PURCHASE', 'TRANSFER_IN', 'RETURN_IN', 'OPENING'].includes(entry.transactionType)) {
      running += Math.abs(qty)
    } else if (['SALE', 'TRANSFER_OUT', 'RETURN_OUT', 'DAMAGE', 'WRITE_OFF'].includes(entry.transactionType)) {
      running -= Math.abs(qty)
    } else if (entry.transactionType === 'ADJUSTMENT') {
      running += qty
    }
    stockTrendByDay.set(entry.createdAt.toISOString().slice(0, 10), Math.max(0, running))
  }
  const stockTrend = [...stockTrendByDay.entries()].map(([date, quantityOnHand]) => ({
    date,
    quantityOnHand,
  }))

  const base = {
    ...product,
    imageUrls: product.imageUrls ?? [],
    costPrice: toNumber(product.costPrice),
    sellingPrice: toNumber(product.sellingPrice),
    minSellingPrice: product.minSellingPrice ? toNumber(product.minSellingPrice) : null,
    taxRate: toNumber(product.taxRate),
    reorderPoint: toNumber(product.reorderPoint),
    reorderQuantity: toNumber(product.reorderQuantity),
    weight: product.weight ? toNumber(product.weight) : null,
    onHand,
    stockHealth: classifyStock(onHand, reorderPoint),
    stockByWarehouse: product.stockBalances.map((b) => ({
      warehouseId: b.warehouseId,
      warehouse: b.warehouse,
      quantityOnHand: toNumber(b.quantityOnHand),
      quantityReserved: toNumber(b.quantityReserved),
      quantityOnOrder: toNumber(b.quantityOnOrder),
    })),
    variants: product.variants.map((v) => ({
      ...v,
      costPrice: v.costPrice ? toNumber(v.costPrice) : null,
      sellingPrice: v.sellingPrice ? toNumber(v.sellingPrice) : null,
      onHand: v.stockBalances.reduce((s, b) => s + toNumber(b.quantityOnHand), 0),
      stockByWarehouse: v.stockBalances.map((b) => ({
        warehouseId: b.warehouseId,
        warehouse: b.warehouse,
        quantityOnHand: toNumber(b.quantityOnHand),
      })),
    })),
    stockTrend,
  }

  if (!opts.includeAnalytics) {
    return {
      ...base,
      analytics: null,
    }
  }

  return {
    ...base,
    analytics: await getProductAnalytics(tenantId, productId, toNumber(product.sellingPrice)),
  }
}

export async function getProductAnalyticsSummary(tenantId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    select: { sellingPrice: true },
  })
  if (!product) return null
  return getProductAnalytics(tenantId, productId, toNumber(product.sellingPrice))
}

async function getProductAnalytics(tenantId: string, productId: string, sellingPrice: number) {
  const periodEnd = new Date()
  const periodStart = new Date(Date.now() - 30 * 86400000)

  const [margin, soldAgg, salesByProduct, priceRows] = await Promise.all([
    computeGrossMargin(tenantId, productId, { start: periodStart, end: periodEnd }),
    prisma.stockLedger.aggregate({
      where: {
        tenantId,
        productId,
        transactionType: 'SALE',
        createdAt: { gte: periodStart },
      },
      _sum: { quantity: true },
    }),
    prisma.stockLedger.groupBy({
      by: ['productId'],
      where: {
        tenantId,
        transactionType: 'SALE',
        createdAt: { gte: periodStart },
      },
      _sum: { quantity: true },
    }),
    prisma.product.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, sellingPrice: true },
    }),
  ])

  const totalSold = Math.abs(toNumber(soldAgg._sum.quantity))
  const revenueProxy = totalSold * sellingPrice
  const priceById = new Map(priceRows.map((p) => [p.id, toNumber(p.sellingPrice)]))

  const productRevenues = salesByProduct
    .map((row) => ({
      id: row.productId,
      revenue: Math.abs(toNumber(row._sum.quantity)) * (priceById.get(row.productId) ?? 0),
    }))
    .sort((a, b) => b.revenue - a.revenue)

  let abcClass: 'A' | 'B' | 'C' = 'C'
  const totalRev = productRevenues.reduce((s, p) => s + p.revenue, 0)
  if (totalRev > 0) {
    let cumulative = 0
    for (const row of productRevenues) {
      cumulative += row.revenue / totalRev
      if (row.id === productId) {
        abcClass = cumulative <= 0.8 ? 'A' : cumulative <= 0.95 ? 'B' : 'C'
        break
      }
    }
  }

  return {
    unitsSold30d: totalSold,
    grossMargin: margin,
    abcClass,
    revenueProxy,
  }
}

export async function getProductLedger(
  tenantId: string,
  productId: string,
  opts: { page?: number; limit?: number; transactionType?: StockTransactionType } = {},
) {
  const page = opts.page ?? 1
  const limit = opts.limit ?? 20
  const where: Prisma.StockLedgerWhereInput = {
    tenantId,
    productId,
    ...(opts.transactionType && { transactionType: opts.transactionType }),
  }

  const [entries, total] = await Promise.all([
    prisma.stockLedger.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        warehouse: { select: { name: true, code: true } },
        performer: { select: { fullName: true } },
      },
    }),
    prisma.stockLedger.count({ where }),
  ])

  return {
    entries: entries.map((e) => ({
      ...e,
      quantity: toNumber(e.quantity),
      unitCost: toNumber(e.unitCost),
      totalCost: toNumber(e.totalCost),
    })),
    total,
    page,
    limit,
  }
}

export async function createCatalogProduct(
  tenantId: string,
  data: Record<string, unknown>,
  actorId?: string,
) {
  const sku = buildProductSku(data.sku)
  const slug = buildProductSlug(String(data.name), data.slug)

  const product = await prisma.product.create({
    data: {
      tenantId,
      sku,
      slug,
      name: String(data.name),
      barcode: (data.barcode as string) ?? null,
      description: (data.description as string) ?? null,
      categoryId: (data.categoryId as string) ?? null,
      supplierId: (data.supplierId as string) ?? null,
      unit: (data.unit as Prisma.ProductCreateInput['unit']) ?? 'PCS',
      costPrice: toDecimal(Number(data.costPrice ?? 0)),
      sellingPrice: toDecimal(Number(data.sellingPrice ?? 0)),
      minSellingPrice: data.minSellingPrice != null ? toDecimal(Number(data.minSellingPrice)) : null,
      taxRate: toDecimal(Number(data.taxRate ?? 0)),
      imageUrls: (data.imageUrls as string[]) ?? [],
      isActive: data.isActive !== false,
      isService: Boolean(data.isService),
      trackInventory: data.trackInventory !== false,
      reorderPoint: toDecimal(Number(data.reorderPoint ?? 0)),
      reorderQuantity: toDecimal(Number(data.reorderQuantity ?? 0)),
      leadTimeDays: Number(data.leadTimeDays ?? 7),
      weight: data.weight != null ? toDecimal(Number(data.weight)) : null,
      dimensions: (data.dimensions as Prisma.InputJsonValue) ?? {},
    },
  })

  const auditUserId = await resolveAuditUserId(actorId)
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: auditUserId,
      action: 'PRODUCT_CREATED',
      resourceType: 'product',
      resourceId: product.id,
      newValue: { sku, name: product.name },
    },
  })

  return product
}

export async function updateCatalogProduct(
  tenantId: string,
  productId: string,
  data: Record<string, unknown>,
  actorId?: string,
) {
  const product = await prisma.product.updateMany({
    where: { id: productId, tenantId },
    data: {
      ...(data.name !== undefined && { name: String(data.name) }),
      ...(data.sku !== undefined && normalizeOptionalString(data.sku) && {
        sku: normalizeOptionalString(data.sku),
      }),
      ...(data.barcode !== undefined && { barcode: (data.barcode as string) ?? null }),
      ...(data.description !== undefined && { description: (data.description as string) ?? null }),
      ...(data.categoryId !== undefined && { categoryId: (data.categoryId as string) ?? null }),
      ...(data.supplierId !== undefined && { supplierId: (data.supplierId as string) ?? null }),
      ...(data.costPrice !== undefined && { costPrice: toDecimal(Number(data.costPrice)) }),
      ...(data.sellingPrice !== undefined && { sellingPrice: toDecimal(Number(data.sellingPrice)) }),
      ...(data.reorderPoint !== undefined && { reorderPoint: toDecimal(Number(data.reorderPoint)) }),
      ...(data.reorderQuantity !== undefined && {
        reorderQuantity: toDecimal(Number(data.reorderQuantity)),
      }),
      ...(data.imageUrls !== undefined && { imageUrls: data.imageUrls as string[] }),
      ...(data.isActive !== undefined && { isActive: Boolean(data.isActive) }),
    },
  })

  const auditUserId = await resolveAuditUserId(actorId)
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: auditUserId,
      action: 'PRODUCT_UPDATED',
      resourceType: 'product',
      resourceId: productId,
      newValue: data as Prisma.InputJsonValue,
    },
  })

  if (!product.count) throw new Error('Product not found')
  return prisma.product.findFirstOrThrow({ where: { id: productId, tenantId } })
}

export async function deleteCatalogProduct(tenantId: string, productId: string, actorId?: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, tenantId } })
  if (!product) throw new Error('Product not found')

  await prisma.product.update({
    where: { id: productId },
    data: { isActive: false },
  })

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: await resolveAuditUserId(actorId),
      action: 'PRODUCT_DELETED',
      resourceType: 'product',
      resourceId: productId,
    },
  })

  return { id: productId, deleted: true }
}

export type DuplicateStrategy = 'skip' | 'overwrite' | 'create_new'

export interface ImportPreviewRow {
  rowIndex: number
  data: Record<string, string>
  errors: string[]
  warnings: string[]
  duplicateSku?: string
}

export async function previewCsvImport(
  tenantId: string,
  rows: Array<Record<string, string>>,
): Promise<{ preview: ImportPreviewRow[]; totalRows: number; validRows: number; errorRows: number }> {
  const preview: ImportPreviewRow[] = []
  let validRows = 0
  let errorRows = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const errors: string[] = []
    const warnings: string[] = []

    if (!row.name?.trim()) errors.push('Name is required')
    if (row.costPrice && Number.isNaN(parseFloat(row.costPrice))) errors.push('Invalid costPrice')
    if (row.sellingPrice && Number.isNaN(parseFloat(row.sellingPrice))) errors.push('Invalid sellingPrice')

    let duplicateSku: string | undefined
    if (row.sku?.trim()) {
      const existing = await prisma.product.findFirst({
        where: { tenantId, sku: row.sku.trim() },
        select: { id: true },
      })
      if (existing) {
        duplicateSku = row.sku.trim()
        warnings.push(`SKU "${row.sku.trim()}" already exists`)
      }
    }

    if (row.categoryName?.trim() && !(await resolveCategoryIdByName(tenantId, row.categoryName!))) {
      warnings.push(`Category "${row.categoryName}" not found — will be left empty`)
    }

    if (errors.length) errorRows++
    else validRows++

    if (preview.length < 5) {
      preview.push({ rowIndex: i + 1, data: row, errors, warnings, duplicateSku })
    }
  }

  return { preview, totalRows: rows.length, validRows, errorRows }
}

export async function importProductsFromCsv(
  tenantId: string,
  rows: Array<Record<string, string>>,
  actorId?: string,
  options: { duplicateStrategy?: DuplicateStrategy } = {},
) {
  const strategy = options.duplicateStrategy ?? 'skip'

  const created: string[] = []
  const updated: string[] = []
  const skipped: string[] = []

  for (const row of rows) {
    if (!row.name?.trim()) continue

    const sku = row.sku?.trim()
    let existing = sku
      ? await prisma.product.findFirst({ where: { tenantId, sku }, select: { id: true, sku: true } })
      : null

    const categoryId =
      row.categoryId?.trim() ||
      (row.categoryName?.trim() ? await resolveCategoryIdByName(tenantId, row.categoryName) : null) ||
      undefined

    const payload = {
      name: row.name.trim(),
      sku: sku || undefined,
      barcode: row.barcode?.trim() || undefined,
      costPrice: parseFloat(row.costPrice ?? '0'),
      sellingPrice: parseFloat(row.sellingPrice ?? '0'),
      reorderPoint: parseFloat(row.reorderPoint ?? '0'),
      reorderQuantity: parseFloat(row.reorderQuantity ?? '0'),
      categoryId: categoryId ?? undefined,
      supplierId: row.supplierId?.trim() || undefined,
      unit: row.unit?.trim() || undefined,
      description: row.description?.trim() || undefined,
    }

    if (existing) {
      if (strategy === 'skip') {
        skipped.push(existing.id)
        continue
      }
      if (strategy === 'overwrite') {
        await updateCatalogProduct(tenantId, existing.id, payload, actorId)
        updated.push(existing.id)
        continue
      }
      // create_new — drop SKU to auto-generate
      delete (payload as { sku?: string }).sku
    }

    const product = await createCatalogProduct(tenantId, payload, actorId)
    created.push(product.id)
  }

  return {
    imported: created.length,
    updated: updated.length,
    skipped: skipped.length,
    productIds: [...created, ...updated],
  }
}

export async function bulkUpdateProducts(
  tenantId: string,
  productIds: string[],
  updates: {
    categoryId?: string | null
    supplierId?: string | null
    costPrice?: number
    sellingPrice?: number
    isActive?: boolean
  },
  actorId?: string,
) {
  if (!productIds.length) throw new Error('No products selected')

  const data: Prisma.ProductUpdateManyMutationInput = {}
  if (updates.categoryId !== undefined) data.categoryId = updates.categoryId
  if (updates.supplierId !== undefined) data.supplierId = updates.supplierId
  if (updates.costPrice !== undefined) data.costPrice = toDecimal(updates.costPrice)
  if (updates.sellingPrice !== undefined) data.sellingPrice = toDecimal(updates.sellingPrice)
  if (updates.isActive !== undefined) data.isActive = updates.isActive

  const result = await prisma.product.updateMany({
    where: { tenantId, id: { in: productIds } },
    data,
  })

  const auditUserId = await resolveAuditUserId(actorId)
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: auditUserId,
      action: 'PRODUCT_BULK_UPDATE',
      resourceType: 'product',
      resourceId: productIds[0] ?? 'bulk',
      newValue: { productIds, updates } as Prisma.InputJsonValue,
    },
  })

  return { updated: result.count }
}

export async function exportProductsCsv(tenantId: string, productIds?: string[]) {
  const products = await prisma.product.findMany({
    where: {
      tenantId,
      ...(productIds?.length ? { id: { in: productIds } } : {}),
    },
    include: {
      category: { select: { name: true } },
      supplier: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  })

  const headers = [
    'name',
    'sku',
    'barcode',
    'costPrice',
    'sellingPrice',
    'reorderPoint',
    'reorderQuantity',
    'categoryName',
    'supplierId',
    'unit',
    'description',
    'isActive',
  ]

  const lines = [
    headers.join(','),
    ...products.map((p) =>
      [
        `"${p.name.replace(/"/g, '""')}"`,
        p.sku,
        p.barcode ?? '',
        toNumber(p.costPrice),
        toNumber(p.sellingPrice),
        toNumber(p.reorderPoint),
        toNumber(p.reorderQuantity),
        p.category?.name ?? '',
        p.supplierId ?? '',
        p.unit,
        `"${(p.description ?? '').replace(/"/g, '""')}"`,
        p.isActive,
      ].join(','),
    ),
  ]

  return lines.join('\n')
}
