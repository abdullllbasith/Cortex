import { NotificationSeverity, NotificationType, Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/db/prisma'
import { notificationService } from '@/lib/notifications/notificationService'
import type { TenantSettings } from '@/lib/settings/types'
import { createPO } from './purchaseOrderService'

export type ReorderUrgency = 'critical' | 'warning' | 'normal' | 'all'
export type ReorderAlertUrgency = 'CRITICAL' | 'WARNING' | 'NORMAL'

export interface ReorderAlert {
  productId: string
  productName: string
  sku: string
  quantityOnHand: number
  reorderPoint: number
  reorderQuantity: number
  supplierId: string | null
  urgency: ReorderAlertUrgency
}

export interface ReorderSuggestion {
  productId: string
  sku: string
  productName: string
  quantityOnHand: number
  reorderPoint: number
  reorderQuantity: number
  suggestedQty: number
  unitCost: number
  lineTotal: number
  supplierId: string | null
  supplierName: string | null
  supplierSku: string | null
  leadTimeDays: number
  suggestedOrderDate: string
  urgency: 'critical' | 'warning'
  annualDemand: number
  eoq: number
}

export interface ReorderSupplierGroup {
  supplierId: string
  supplierName: string
  reliabilityScore: number
  paymentTerms: string
  suggestions: ReorderSuggestion[]
  totalCost: number
}

function toNumber(value: Decimal | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

function calculateEOQ(annualDemand: number, orderingCost = 50, holdingCostPerUnit = 1): number {
  if (annualDemand <= 0) return 0
  return Math.ceil(Math.sqrt((2 * annualDemand * orderingCost) / Math.max(holdingCostPerUnit, 0.01)))
}

function classifyUrgency(onHand: number, reorderPoint: number): ReorderAlertUrgency {
  if (onHand <= 0) return 'CRITICAL'
  if (onHand <= reorderPoint) return 'WARNING'
  if (reorderPoint > 0 && onHand <= reorderPoint * 1.2) return 'NORMAL'
  return 'NORMAL'
}

function toSuggestionUrgency(alert: ReorderAlertUrgency): 'critical' | 'warning' | null {
  if (alert === 'CRITICAL') return 'critical'
  if (alert === 'WARNING') return 'warning'
  return null
}

async function resolveDefaultWarehouseId(tenantId: string): Promise<string> {
  const warehouse = await prisma.warehouse.findFirst({
    where: { tenantId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  })
  if (!warehouse) throw new Error('No active warehouse configured')
  return warehouse.id
}

async function getAnnualDemand(tenantId: string, productId: string): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
  const rows = await prisma.stockLedger.groupBy({
    by: ['productId'],
    where: {
      tenantId,
      productId,
      transactionType: 'SALE',
      createdAt: { gte: thirtyDaysAgo },
    },
    _sum: { quantity: true },
  })
  const sold30d = Math.abs(toNumber(rows[0]?._sum.quantity))
  return Math.round(sold30d * 12)
}

async function touchLastChecked(tenantId: string): Promise<string> {
  const now = new Date().toISOString()
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } })
  const settings = (tenant?.settings ?? {}) as TenantSettings & { inventory?: Record<string, unknown> }
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      settings: {
        ...settings,
        inventory: { ...(settings.inventory ?? {}), lastReorderCheck: now },
      } as Prisma.InputJsonValue,
    },
  })
  return now
}

export async function getLastReorderCheck(tenantId: string): Promise<string | null> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } })
  const settings = (tenant?.settings ?? {}) as TenantSettings & { inventory?: { lastReorderCheck?: string } }
  return settings.inventory?.lastReorderCheck ?? null
}

/** Low-stock rows from StockBalance × Product (includes NORMAL band up to 1.2× reorder point). */
export async function checkReorderPoints(
  tenantId: string,
  options?: { skipTouch?: boolean },
): Promise<ReorderAlert[]> {
  const [balanceRows, productsWithoutBalance] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        productId: string
        quantityOnHand: Decimal
        reorderPoint: Decimal
        reorderQuantity: Decimal
        supplierId: string | null
        name: string
        sku: string
      }>
    >`
      SELECT
        sb."productId",
        COALESCE(SUM(sb."quantityOnHand"), 0) AS "quantityOnHand",
        p."reorderPoint",
        p."reorderQuantity",
        p."supplierId",
        p."name",
        p."sku"
      FROM "stock_balances" sb
      INNER JOIN "products" p ON sb."productId" = p."id"
      WHERE sb."tenantId" = ${tenantId}
        AND p."tenantId" = ${tenantId}
        AND p."isActive" = true
        AND p."trackInventory" = true
        AND p."reorderPoint" > 0
      GROUP BY sb."productId", p."reorderPoint", p."reorderQuantity", p."supplierId", p."name", p."sku"
      HAVING COALESCE(SUM(sb."quantityOnHand"), 0) <= p."reorderPoint" * 1.2
    `,
    prisma.product.findMany({
      where: {
        tenantId,
        isActive: true,
        trackInventory: true,
        reorderPoint: { gt: 0 },
        stockBalances: { none: {} },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        reorderPoint: true,
        reorderQuantity: true,
        supplierId: true,
      },
    }),
  ])

  const alerts: ReorderAlert[] = balanceRows.map((row) => {
    const quantityOnHand = toNumber(row.quantityOnHand)
    const reorderPoint = toNumber(row.reorderPoint)
    const reorderQuantity = toNumber(row.reorderQuantity)
    return {
      productId: row.productId,
      productName: row.name,
      sku: row.sku,
      quantityOnHand,
      reorderPoint,
      reorderQuantity,
      supplierId: row.supplierId,
      urgency: classifyUrgency(quantityOnHand, reorderPoint),
    }
  })

  for (const p of productsWithoutBalance) {
    const reorderPoint = toNumber(p.reorderPoint)
    if (reorderPoint <= 0) continue
    alerts.push({
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      quantityOnHand: 0,
      reorderPoint,
      reorderQuantity: toNumber(p.reorderQuantity),
      supplierId: p.supplierId,
      urgency: 'CRITICAL',
    })
  }

  if (!options?.skipTouch) {
    await touchLastChecked(tenantId)
  }
  return alerts
}

export async function getCriticalReorderCount(tenantId: string): Promise<number> {
  const alerts = await checkReorderPoints(tenantId, { skipTouch: true })
  return alerts.filter((a) => a.urgency === 'CRITICAL').length
}

/** Lightweight badge count for sidebar — avoids full EOQ suggestion build. */
export async function getReorderSuggestionCount(
  tenantId: string,
): Promise<{ count: number; lastCheckedAt: string | null }> {
  const [alerts, snoozed, lastCheckedAt] = await Promise.all([
    checkReorderPoints(tenantId, { skipTouch: true }),
    getSnoozedProductIds(tenantId),
    getLastReorderCheck(tenantId),
  ])
  const count = alerts.filter((a) => {
    const u = toSuggestionUrgency(a.urgency)
    return u && !snoozed.has(a.productId)
  }).length
  return { count, lastCheckedAt }
}

/** Fast low-stock summary for dashboard KPIs (SQL aggregation, no agent). */
export async function getLowStockSummaryForDashboard(tenantId: string, take = 5) {
  const alerts = await checkReorderPoints(tenantId, { skipTouch: true })
  const low = alerts.filter((a) => a.urgency !== 'NORMAL')
  const sorted = [...low].sort((a, b) => a.quantityOnHand - b.quantityOnHand)
  return {
    count: low.length,
    items: sorted.slice(0, take).map((a) => ({
      productId: a.productId,
      productName: a.productName,
      sku: a.sku,
      quantityOnHand: a.quantityOnHand,
      reorderPoint: a.reorderPoint,
      urgency: a.urgency === 'CRITICAL' ? 'critical' : 'warning',
    })),
  }
}

async function getSnoozedProductIds(tenantId: string): Promise<Set<string>> {
  const now = new Date()
  const rows = await prisma.reorderSnooze.findMany({
    where: { tenantId, snoozedUntil: { gt: now } },
    select: { productId: true },
  })
  return new Set(rows.map((r) => r.productId))
}

export async function generateReorderSuggestions(
  tenantId: string,
  urgencyFilter: ReorderUrgency = 'all',
  options?: { productId?: string },
): Promise<{ lastCheckedAt: string; groups: ReorderSupplierGroup[]; totalSuggestions: number }> {
  const snoozed = await getSnoozedProductIds(tenantId)
  const alerts = await checkReorderPoints(tenantId)

  let productIds = alerts
    .filter((a) => {
      const u = toSuggestionUrgency(a.urgency)
      if (!u) return false
      if (urgencyFilter === 'critical') return u === 'critical'
      if (urgencyFilter === 'warning') return u === 'warning'
      return true
    })
    .map((a) => a.productId)
    .filter((id) => !snoozed.has(id))
  if (options?.productId) {
    productIds = productIds.filter((id) => id === options.productId)
  }
  if (!productIds.length) {
    return { lastCheckedAt: await getLastReorderCheck(tenantId) ?? new Date().toISOString(), groups: [], totalSuggestions: 0 }
  }

  const [products, supplierProducts, suppliers] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds }, tenantId },
      select: {
        id: true,
        sku: true,
        name: true,
        reorderPoint: true,
        reorderQuantity: true,
        costPrice: true,
        leadTimeDays: true,
        supplierId: true,
        supplier: { select: { id: true, name: true, performanceScore: true, paymentTerms: true } },
      },
    }),
    prisma.supplierProduct.findMany({
      where: { tenantId, productId: { in: productIds } },
      include: { supplier: { select: { id: true, name: true, performanceScore: true, paymentTerms: true } } },
    }),
    prisma.supplier.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, performanceScore: true, paymentTerms: true },
    }),
  ])

  const onHandMap = new Map(alerts.map((a) => [a.productId, a.quantityOnHand]))
  const preferredByProduct = new Map<string, typeof supplierProducts[0]>()
  const lowestCostByProduct = new Map<string, typeof supplierProducts[0]>()
  for (const sp of supplierProducts) {
    const existingPreferred = preferredByProduct.get(sp.productId)
    if (!existingPreferred || sp.isPreferred) preferredByProduct.set(sp.productId, sp)

    const existingLow = lowestCostByProduct.get(sp.productId)
    if (!existingLow || toNumber(sp.unitCost) < toNumber(existingLow.unitCost)) {
      lowestCostByProduct.set(sp.productId, sp)
    }
  }

  const suggestions: ReorderSuggestion[] = []

  for (const product of products) {
    const onHand = onHandMap.get(product.id) ?? 0
    const reorderPoint = toNumber(product.reorderPoint)
    const reorderQty = toNumber(product.reorderQuantity) || reorderPoint
    const urgency: 'critical' | 'warning' = onHand <= 0 ? 'critical' : 'warning'

    if (urgencyFilter === 'critical' && urgency !== 'critical') continue
    if (urgencyFilter === 'warning' && urgency !== 'warning') continue

    const preferred = preferredByProduct.get(product.id)
    const lowestCost = lowestCostByProduct.get(product.id)
    const supplierLink = preferred?.isPreferred ? preferred : preferred ?? lowestCost
    const supplier =
      supplierLink?.supplier ??
      product.supplier ??
      (product.supplierId ? suppliers.find((s) => s.id === product.supplierId) : null)

    const annualDemand = await getAnnualDemand(tenantId, product.id)
    const eoq =
      annualDemand > 0
        ? calculateEOQ(annualDemand, 50, Math.max(toNumber(product.costPrice) * 0.2, 1))
        : 0
    const suggestedQty = Math.max(
      reorderQty || reorderPoint,
      eoq || 0,
      Math.ceil(reorderPoint - onHand + (reorderQty || reorderPoint)),
    )
    const unitCost = supplierLink ? toNumber(supplierLink.unitCost) : toNumber(product.costPrice)
    const leadTimeDays = supplierLink?.leadTimeDays ?? product.leadTimeDays ?? 7
    const avgDailyUsage = annualDemand > 0 ? annualDemand / 365 : reorderQty / 30 || 1
    const daysUntilStockout = avgDailyUsage > 0 ? onHand / avgDailyUsage : 0
    const orderOffsetDays = Math.max(0, Math.floor(daysUntilStockout - leadTimeDays))
    const suggestedOrderDate =
      urgency === 'critical'
        ? new Date().toISOString().slice(0, 10)
        : new Date(Date.now() + orderOffsetDays * 86400000).toISOString().slice(0, 10)

    suggestions.push({
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      quantityOnHand: onHand,
      reorderPoint,
      reorderQuantity: reorderQty,
      suggestedQty,
      unitCost,
      lineTotal: suggestedQty * unitCost,
      supplierId: supplier?.id ?? null,
      supplierName: supplier?.name ?? 'Unassigned',
      supplierSku: supplierLink?.supplierSku ?? null,
      leadTimeDays,
      suggestedOrderDate,
      urgency,
      annualDemand,
      eoq,
    })
  }

  const groupMap = new Map<string, ReorderSupplierGroup>()
  for (const s of suggestions) {
    const key = s.supplierId ?? '__unassigned__'
    const existing = groupMap.get(key)
    if (existing) {
      existing.suggestions.push(s)
      existing.totalCost += s.lineTotal
    } else {
      const supplier = suppliers.find((sup) => sup.id === s.supplierId)
      groupMap.set(key, {
        supplierId: s.supplierId ?? key,
        supplierName: s.supplierName ?? 'Unassigned',
        reliabilityScore: supplier?.performanceScore ?? 0,
        paymentTerms: String(supplier?.paymentTerms ?? 'NET30'),
        suggestions: [s],
        totalCost: s.lineTotal,
      })
    }
  }

  const groups = [...groupMap.values()].sort((a, b) => b.totalCost - a.totalCost)
  return {
    lastCheckedAt: (await getLastReorderCheck(tenantId)) ?? new Date().toISOString(),
    groups,
    totalSuggestions: suggestions.length,
  }
}

export async function dismissSuggestion(tenantId: string, productId: string, days = 7): Promise<void> {
  const snoozedUntil = new Date(Date.now() + days * 86400000)
  await prisma.reorderSnooze.upsert({
    where: { tenantId_productId: { tenantId, productId } },
    create: { tenantId, productId, snoozedUntil },
    update: { snoozedUntil },
  })
}

export async function createDraftPO(
  tenantId: string,
  supplierId: string,
  suggestions: ReorderSuggestion[],
  createdBy?: string,
): Promise<{ id: string; poNumber: string }> {
  if (!suggestions.length) throw new Error('No suggestions to order')
  if (supplierId === '__unassigned__') throw new Error('Cannot create PO without a supplier')

  const warehouseId = await resolveDefaultWarehouseId(tenantId)
  const items = suggestions.map((s) => ({
    productId: s.productId,
    quantity: s.suggestedQty,
    unitCost: s.unitCost,
    taxRate: 0,
  }))

  return createPO(
    tenantId,
    {
      supplierId,
      warehouseId,
      items,
      notes: `Auto-generated from reorder suggestions (${suggestions.length} line items)`,
    },
    createdBy,
  )
}

/** Alias for batch draft PO creation grouped by supplier. */
export async function createDraftPOsFromSuggestions(
  tenantId: string,
  groups: ReorderSupplierGroup[],
  createdBy?: string,
): Promise<Array<{ supplierId: string; poNumber: string; id: string }>> {
  return createAllDraftPOs(tenantId, groups, createdBy)
}

export async function createAllDraftPOs(
  tenantId: string,
  groups: ReorderSupplierGroup[],
  createdBy?: string,
): Promise<Array<{ supplierId: string; poNumber: string; id: string }>> {
  const results: Array<{ supplierId: string; poNumber: string; id: string }> = []
  for (const group of groups) {
    if (!group.supplierId || group.supplierId === '__unassigned__') continue
    const po = await createDraftPO(tenantId, group.supplierId, group.suggestions, createdBy)
    results.push({ supplierId: group.supplierId, ...po })
  }
  return results
}

export async function notifyStockThreshold(
  tenantId: string,
  product: { id: string; name: string; sku: string; reorderPoint: Decimal | number },
  quantityOnHand: number,
): Promise<void> {
  const reorderPoint = toNumber(product.reorderPoint)
  if (reorderPoint <= 0 || quantityOnHand > reorderPoint) return

  const isCritical = quantityOnHand <= 0
  await notificationService.send({
    tenantId,
    roleTarget: 'MANAGER',
    type: NotificationType.ALERT,
    severity: isCritical ? NotificationSeverity.CRITICAL : NotificationSeverity.WARNING,
    title: isCritical ? `${product.name} out of stock` : `${product.name} stock low`,
    body: isCritical
      ? `0 units remaining — immediate reorder required for ${product.sku}.`
      : `${quantityOnHand} units remaining — reorder needed (reorder point: ${reorderPoint}).`,
    actionUrl: '/inventory/reorder',
    actionLabel: 'Open reorder centre',
    entityId: `${product.id}:${isCritical ? 'critical' : 'warning'}`,
    metadata: { productId: product.id, quantityOnHand, reorderPoint, urgency: isCritical ? 'critical' : 'warning' },
  })
}

export async function runScheduledReorderCheck(tenantId: string): Promise<void> {
  const { groups } = await generateReorderSuggestions(tenantId)
  if (!groups.length) return

  const totalItems = groups.reduce((s, g) => s + g.suggestions.length, 0)
  await notificationService.send({
    tenantId,
    roleTarget: 'MANAGER',
    type: NotificationType.REMINDER,
    severity: NotificationSeverity.WARNING,
    title: 'Daily reorder review',
    body: `${totalItems} product(s) across ${groups.length} supplier(s) need reorder attention.`,
    actionUrl: '/inventory/reorder',
    actionLabel: 'Review suggestions',
    entityId: `reorder-daily-${new Date().toISOString().slice(0, 10)}`,
  })
}

export async function onStockBelowReorder(
  tenantId: string,
  productId: string,
  quantityOnHand: number,
): Promise<void> {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    select: {
      id: true,
      name: true,
      sku: true,
      reorderPoint: true,
      supplierId: true,
      leadTimeDays: true,
    },
  })
  if (!product) return
  await notifyStockThreshold(tenantId, product, quantityOnHand)
  void generateReorderSuggestions(tenantId, 'all', { productId }).catch(() => {})
}

export async function dismissSupplierGroup(
  tenantId: string,
  productIds: string[],
  days = 7,
): Promise<void> {
  await Promise.all(productIds.map((id) => dismissSuggestion(tenantId, id, days)))
}
