import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/db/prisma'
import { classifyStock, type StockHealth } from '@/lib/inventory/inventoryDashboardService'
import { embedSingleRecord, hashEmbeddingContent, buildProductContent, buildSupplierContent } from '@/lib/embeddings/knowledgeIndexer'
import { EmbeddingStatus, type PaymentTerms, type SupplierType } from '@prisma/client'
import { cacheDelPattern, knowledgeCacheKey } from '@/lib/cache/redis'
import {
  computeSupplierDeliveryMetrics,
  performanceScoreToStars,
} from '@/lib/knowledge/supplierPerformanceService'

async function invalidateEntityCache(tenantId: string, entity: string) {
  await cacheDelPattern(knowledgeCacheKey(tenantId, entity, '*'))
}

function toNumber(value: Decimal | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

function toDecimal(value: number): Decimal {
  return new Decimal(value)
}

export interface KnowledgeProductFilters {
  page?: number
  limit?: number
  search?: string
  categoryId?: string
  supplierId?: string
  stockHealth?: StockHealth
  minPrice?: number
  maxPrice?: number
  status?: 'active' | 'inactive' | 'all'
}

export interface KnowledgeSupplierFilters {
  page?: number
  limit?: number
  search?: string
  minScore?: number
  maxScore?: number
  category?: string
  supplierType?: SupplierType
  paymentTerms?: PaymentTerms
  status?: 'active' | 'inactive' | 'all'
}

export async function listKnowledgeProducts(tenantId: string, filters: KnowledgeProductFilters = {}) {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20

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
    ...(filters.minPrice != null || filters.maxPrice != null
      ? {
          sellingPrice: {
            ...(filters.minPrice != null ? { gte: toDecimal(filters.minPrice) } : {}),
            ...(filters.maxPrice != null ? { lte: toDecimal(filters.maxPrice) } : {}),
          },
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        stockBalances: { select: { quantityOnHand: true } },
      },
    }),
    prisma.product.count({ where }),
  ])

  let items = rows.map((p) => {
    const onHand = p.stockBalances.reduce((s, b) => s + toNumber(b.quantityOnHand), 0)
    const reorderPoint = toNumber(p.reorderPoint)
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      imageUrls: p.imageUrls ?? [],
      category: p.category,
      supplier: p.supplier,
      costPrice: toNumber(p.costPrice),
      sellingPrice: toNumber(p.sellingPrice),
      onHand,
      stockHealth: classifyStock(onHand, reorderPoint),
      embeddingStatus: p.embeddingStatus,
      updatedAt: p.updatedAt.toISOString(),
      version: p.version,
    }
  })

  if (filters.stockHealth) {
    items = items.filter((i) => i.stockHealth === filters.stockHealth)
  }

  return { data: items, total, page, limit }
}

export async function getKnowledgeProduct(tenantId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    include: {
      category: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
      stockBalances: {
        include: { warehouse: { select: { id: true, name: true, code: true } } },
      },
    },
  })
  if (!product) return null

  const onHand = product.stockBalances.reduce((s, b) => s + toNumber(b.quantityOnHand), 0)
  const reorderPoint = toNumber(product.reorderPoint)

  return {
    id: product.id,
    sku: product.sku,
    barcode: product.barcode,
    name: product.name,
    slug: product.slug,
    description: product.description,
    categoryId: product.categoryId,
    category: product.category,
    unit: product.unit,
    costPrice: toNumber(product.costPrice),
    sellingPrice: toNumber(product.sellingPrice),
    minSellingPrice: product.minSellingPrice ? toNumber(product.minSellingPrice) : null,
    taxRate: toNumber(product.taxRate),
    supplierId: product.supplierId,
    supplier: product.supplier,
    reorderPoint,
    reorderQuantity: toNumber(product.reorderQuantity),
    leadTimeDays: product.leadTimeDays,
    imageUrls: product.imageUrls ?? [],
    isActive: product.isActive,
    onHand,
    stockHealth: classifyStock(onHand, reorderPoint),
    embeddingStatus: product.embeddingStatus,
    embeddingUpdatedAt: product.embeddingUpdatedAt?.toISOString() ?? null,
    createdAt: product.createdAt.toISOString(),
    version: product.version,
    updatedAt: product.updatedAt.toISOString(),
    stockByWarehouse: product.stockBalances.map((b) => ({
      warehouseId: b.warehouseId,
      warehouse: b.warehouse,
      quantityOnHand: toNumber(b.quantityOnHand),
      quantityReserved: toNumber(b.quantityReserved),
      quantityOnOrder: toNumber(b.quantityOnOrder),
    })),
  }
}

export async function updateKnowledgeProduct(
  tenantId: string,
  productId: string,
  data: Record<string, unknown>,
  actorId?: string,
) {
  const version = Number(data.version ?? 0)
  const content = buildProductContent({
    name: String(data.name ?? ''),
    catalog: (data.catalog as Record<string, unknown>) ?? {},
    supplierInfo: {},
  })

  const result = await prisma.product.updateMany({
    where: { id: productId, tenantId, version },
    data: {
      ...(data.name !== undefined && { name: String(data.name) }),
      ...(data.sku !== undefined && { sku: String(data.sku) }),
      ...(data.barcode !== undefined && { barcode: data.barcode ? String(data.barcode) : null }),
      ...(data.description !== undefined && { description: data.description ? String(data.description) : null }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId ? String(data.categoryId) : null }),
      ...(data.unit !== undefined && { unit: data.unit as Prisma.ProductUpdateInput['unit'] }),
      ...(data.costPrice !== undefined && { costPrice: toDecimal(Number(data.costPrice)) }),
      ...(data.sellingPrice !== undefined && { sellingPrice: toDecimal(Number(data.sellingPrice)) }),
      ...(data.minSellingPrice !== undefined && {
        minSellingPrice: data.minSellingPrice == null ? null : toDecimal(Number(data.minSellingPrice)),
      }),
      ...(data.taxRate !== undefined && { taxRate: toDecimal(Number(data.taxRate)) }),
      ...(data.supplierId !== undefined && { supplierId: data.supplierId ? String(data.supplierId) : null }),
      ...(data.reorderPoint !== undefined && { reorderPoint: toDecimal(Number(data.reorderPoint)) }),
      ...(data.reorderQuantity !== undefined && { reorderQuantity: toDecimal(Number(data.reorderQuantity)) }),
      ...(data.leadTimeDays !== undefined && { leadTimeDays: Number(data.leadTimeDays) }),
      ...(data.imageUrls !== undefined && { imageUrls: data.imageUrls as string[] }),
      ...(data.isActive !== undefined && { isActive: Boolean(data.isActive) }),
      version: { increment: 1 },
      embeddingStatus: EmbeddingStatus.PENDING,
      embeddingContentHash: hashEmbeddingContent(content),
    },
  })

  if (result.count === 0) {
    throw new Error('Product was modified by another user. Please refresh and try again.')
  }

  await invalidateEntityCache(tenantId, 'products')
  void embedSingleRecord(tenantId, 'product', productId)

  return getKnowledgeProduct(tenantId, productId)
}

export async function listKnowledgeSuppliers(tenantId: string, filters: KnowledgeSupplierFilters = {}) {
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
          ],
        }
      : {}),
    ...(filters.supplierType && { type: filters.supplierType }),
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

  const [rows, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        purchaseOrders: {
          where: { status: { in: ['DRAFT', 'SENT', 'ACKNOWLEDGED', 'PARTIAL'] } },
          select: { id: true },
        },
      },
    }),
    prisma.supplier.count({ where }),
  ])

  const lastPoBySupplier = await prisma.purchaseOrder.groupBy({
    by: ['supplierId'],
    where: { tenantId, supplierId: { in: rows.map((r) => r.id) } },
    _max: { createdAt: true },
  })
  const lastPoMap = new Map(lastPoBySupplier.map((g) => [g.supplierId, g._max.createdAt]))

  const items = rows.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code || '—',
    type: s.type,
    contactEmail: s.email ?? '—',
    performanceScore: s.performanceScore,
    reliabilityStars: performanceScoreToStars(s.performanceScore),
    activePoCount: s.purchaseOrders.length,
    paymentTerms: s.paymentTerms,
    lastOrderAt: lastPoMap.get(s.id)?.toISOString() ?? null,
    isActive: s.isActive,
    embeddingStatus: s.embeddingStatus,
    updatedAt: s.updatedAt.toISOString(),
    version: s.version,
  }))

  return { data: items, total, page, limit }
}

export async function getKnowledgeSupplier(tenantId: string, supplierId: string) {
  const [supplier, deliveryMetrics, recentPOs, supplierProducts] = await Promise.all([
    prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
      include: {
        products: {
          take: 20,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            name: true,
            sku: true,
            sellingPrice: true,
            costPrice: true,
            embeddingStatus: true,
          },
        },
        _count: { select: { purchaseOrders: true } },
      },
    }),
    computeSupplierDeliveryMetrics(tenantId, supplierId),
    prisma.purchaseOrder.findMany({
      where: { tenantId, supplierId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        poNumber: true,
        status: true,
        grandTotal: true,
        expectedDelivery: true,
        createdAt: true,
      },
    }),
    prisma.supplierProduct.findMany({
      where: { tenantId, supplierId },
      take: 20,
      include: {
        product: { select: { id: true, name: true, sku: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
  ])

  if (!supplier) return null

  const address =
    supplier.address && typeof supplier.address === 'object'
      ? JSON.stringify(supplier.address)
      : String(supplier.address ?? '')

  const metrics = (supplier.reliabilityMetrics ?? {}) as Record<string, unknown>
  const leadTimeFromLinks = supplierProducts.length
    ? Math.round(
        supplierProducts.reduce((s, sp) => s + sp.leadTimeDays, 0) / supplierProducts.length,
      )
    : Number(metrics.leadTimeDays ?? metrics.avgLeadTimeDays ?? supplier.products[0] ? 7 : 0)

  return {
    id: supplier.id,
    code: supplier.code,
    name: supplier.name,
    type: supplier.type,
    performanceScore: supplier.performanceScore,
    reliabilityStars: performanceScoreToStars(supplier.performanceScore),
    deliveryHistory: supplier.deliveryHistory,
    reliabilityMetrics: supplier.reliabilityMetrics,
    costTrends: supplier.costTrends,
    embeddingStatus: supplier.embeddingStatus,
    embeddingUpdatedAt: supplier.embeddingUpdatedAt?.toISOString() ?? null,
    version: supplier.version,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
    isActive: supplier.isActive,
    contactEmail: supplier.email ?? String(metrics.contactEmail ?? ''),
    contactPhone: supplier.phone ?? supplier.mobile ?? String(metrics.contactPhone ?? ''),
    contactName: supplier.contactName ?? String(metrics.contactName ?? ''),
    address,
    paymentTerms: supplier.paymentTerms,
    currency: supplier.currency,
    taxNumber: supplier.taxNumber ?? '',
    leadTimeDays: leadTimeFromLinks,
    notes: supplier.notes ?? String(metrics.notes ?? ''),
    supplierMetrics: {
      onTimeDeliveryRate: deliveryMetrics.onTimeDeliveryRate,
      avgDelayDays: deliveryMetrics.avgDelayDays,
      costVariancePercent: deliveryMetrics.costVariancePercent,
      activePurchaseOrders: supplier._count.purchaseOrders,
      sampleReceipts: deliveryMetrics.sampleSize,
    },
    recentPurchaseOrders: recentPOs.map((po) => ({
      id: po.id,
      poNumber: po.poNumber,
      status: po.status,
      grandTotal: toNumber(po.grandTotal),
      expectedDelivery: po.expectedDelivery?.toISOString() ?? null,
      createdAt: po.createdAt.toISOString(),
    })),
    suppliedProducts: supplierProducts.map((sp) => ({
      id: sp.product.id,
      name: sp.product.name,
      sku: sp.product.sku,
      unitCost: toNumber(sp.unitCost),
      leadTimeDays: sp.leadTimeDays,
      isPreferred: sp.isPreferred,
    })),
    relatedProducts: supplier.products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      sellingPrice: toNumber(p.sellingPrice),
      costPrice: toNumber(p.costPrice),
      embeddingStatus: p.embeddingStatus,
    })),
  }
}

export async function updateKnowledgeSupplier(
  tenantId: string,
  supplierId: string,
  data: Record<string, unknown>,
  actorId?: string,
) {
  const existing = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } })
  if (!existing) throw new Error('Supplier not found')

  const version = Number(data.version ?? existing.version)
  const prevMetrics = (existing.reliabilityMetrics ?? {}) as Record<string, unknown>

  const reliabilityMetrics = {
    ...prevMetrics,
    ...(data.leadTimeDays !== undefined && { leadTimeDays: data.leadTimeDays, avgLeadTimeDays: data.leadTimeDays }),
    ...(data.notes !== undefined && { notes: data.notes }),
  }

  let addressJson: Prisma.InputJsonValue | undefined
  if (data.address !== undefined) {
    try {
      addressJson = typeof data.address === 'string' ? JSON.parse(data.address) : (data.address as Prisma.InputJsonValue)
    } catch {
      addressJson = { line1: String(data.address) }
    }
  }

  const content = buildSupplierContent({
    name: String(data.name ?? existing.name),
    performanceScore: Number(data.performanceScore ?? existing.performanceScore),
    reliabilityMetrics,
  })

  const result = await prisma.supplier.updateMany({
    where: { id: supplierId, tenantId, version },
    data: {
      ...(data.name !== undefined && { name: String(data.name) }),
      ...(data.code !== undefined && { code: String(data.code) }),
      ...(data.type !== undefined && { type: data.type as SupplierType }),
      ...(data.contactEmail !== undefined && { email: data.contactEmail ? String(data.contactEmail) : null }),
      ...(data.contactPhone !== undefined && { phone: data.contactPhone ? String(data.contactPhone) : null }),
      ...(data.contactName !== undefined && { contactName: data.contactName ? String(data.contactName) : null }),
      ...(addressJson !== undefined && { address: addressJson }),
      ...(data.paymentTerms !== undefined && { paymentTerms: data.paymentTerms as PaymentTerms }),
      ...(data.currency !== undefined && { currency: String(data.currency) }),
      ...(data.taxNumber !== undefined && { taxNumber: data.taxNumber ? String(data.taxNumber) : null }),
      ...(data.notes !== undefined && { notes: data.notes ? String(data.notes) : null }),
      ...(data.performanceScore !== undefined && { performanceScore: Number(data.performanceScore) }),
      ...(data.isActive !== undefined && { isActive: Boolean(data.isActive) }),
      reliabilityMetrics: reliabilityMetrics as Prisma.InputJsonValue,
      version: { increment: 1 },
      embeddingStatus: EmbeddingStatus.PENDING,
      embeddingContentHash: hashEmbeddingContent(content),
    },
  })

  if (result.count === 0) {
    throw new Error('Supplier was modified by another user. Please refresh and try again.')
  }

  await invalidateEntityCache(tenantId, 'suppliers')
  void embedSingleRecord(tenantId, 'supplier', supplierId)

  return getKnowledgeSupplier(tenantId, supplierId)
}
