import {
  MLPredictionType,
  Prisma,
  StockTransferStatus,
  type StockTransactionType,
} from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/db/prisma'
import {
  emitStockBelowReorder,
  emitStockLevelChanged,
} from './inventoryWebhooks'
import { emitSalesEvent } from '@/lib/analytics/salesEventEmitter'
import { onStockBelowReorder } from './reorderService'
import {
  InventoryError,
  INBOUND_TRANSACTION_TYPES,
  OUTBOUND_TRANSACTION_TYPES,
  type StockBalanceSnapshot,
  type StockTransaction,
  parseTransferLineItems,
} from './types'

function toDecimal(value: number): Decimal {
  return new Decimal(value)
}

function toNumber(value: Decimal | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

function signedQuantity(type: StockTransactionType, quantity: number): number {
  if (OUTBOUND_TRANSACTION_TYPES.includes(type)) return -Math.abs(quantity)
  if (INBOUND_TRANSACTION_TYPES.includes(type)) return Math.abs(quantity)
  return quantity
}

async function resolveDefaultWarehouseId(tenantId: string): Promise<string> {
  const warehouse = await prisma.warehouse.findFirst({
    where: { tenantId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  })
  if (!warehouse) {
    throw new InventoryError('No active warehouse configured for tenant', 'WAREHOUSE_NOT_FOUND')
  }
  return warehouse.id
}

async function validateProduct(tenantId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId, isActive: true },
    select: {
      id: true,
      name: true,
      sku: true,
      trackInventory: true,
      reorderPoint: true,
      reorderQuantity: true,
      supplierId: true,
      leadTimeDays: true,
      inventoryLevel: true,
      costPrice: true,
      sellingPrice: true,
    },
  })
  if (!product) throw new InventoryError('Product not found for tenant', 'PRODUCT_NOT_FOUND')
  return product
}

async function validateWarehouse(tenantId: string, warehouseId: string) {
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: warehouseId, tenantId, isActive: true },
    select: { id: true },
  })
  if (!warehouse) throw new InventoryError('Warehouse not found for tenant', 'WAREHOUSE_NOT_FOUND')
  return warehouse
}

async function validateVariant(tenantId: string, productId: string, variantId?: string | null) {
  if (!variantId) return null
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, tenantId, productId, isActive: true },
    select: { id: true },
  })
  if (!variant) throw new InventoryError('Product variant not found', 'VARIANT_NOT_FOUND')
  return variant
}

type LockedBalance = {
  id: string
  quantityOnHand: Decimal
  quantityReserved: Decimal
  quantityOnOrder: Decimal
}

async function lockBalanceRow(
  tx: Prisma.TransactionClient,
  tenantId: string,
  productId: string,
  warehouseId: string,
  variantId?: string | null,
): Promise<LockedBalance> {
  const rows = await tx.$queryRaw<LockedBalance[]>`
    SELECT "id", "quantityOnHand", "quantityReserved", "quantityOnOrder"
    FROM "stock_balances"
    WHERE "tenantId" = ${tenantId}
      AND "productId" = ${productId}
      AND "warehouseId" = ${warehouseId}
      AND "variantId" IS NOT DISTINCT FROM ${variantId ?? null}
    FOR UPDATE
  `

  if (rows[0]) return rows[0]

  const created = await tx.stockBalance.create({
    data: {
      tenantId,
      productId,
      variantId: variantId ?? null,
      warehouseId,
      quantityOnHand: 0,
      quantityReserved: 0,
      quantityOnOrder: 0,
    },
    select: {
      id: true,
      quantityOnHand: true,
      quantityReserved: true,
      quantityOnOrder: true,
    },
  })

  return created
}

async function syncProductInventoryLevel(tenantId: string, productId: string): Promise<number> {
  const aggregate = await prisma.stockBalance.aggregate({
    where: { tenantId, productId },
    _sum: { quantityOnHand: true },
  })
  const total = Math.max(0, Math.floor(toNumber(aggregate._sum.quantityOnHand)))
  await prisma.product.updateMany({
    where: { id: productId, tenantId },
    data: { inventoryLevel: total },
  })
  return total
}

async function flagInventoryReforecast(tenantId: string, productId: string): Promise<void> {
  await prisma.mLPrediction.deleteMany({
    where: {
      tenantId,
      entityId: productId,
      predictionType: MLPredictionType.INVENTORY_STOCKOUT,
    },
  })
}

async function maybeNotifyLowStock(
  tenantId: string,
  product: {
    id: string
    name: string
    sku: string
    reorderPoint: Decimal
    reorderQuantity?: Decimal
    supplierId?: string | null
    leadTimeDays?: number | null
  },
  quantityOnHand: number,
): Promise<void> {
  const reorderPoint = toNumber(product.reorderPoint)
  if (reorderPoint <= 0 || quantityOnHand > reorderPoint) return

  const reorderQty = toNumber(product.reorderQuantity)
  void onStockBelowReorder(tenantId, product.id, quantityOnHand).catch(() => {})

  emitStockBelowReorder(tenantId, {
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    quantityOnHand,
    currentStock: quantityOnHand,
    reorderPoint,
    supplierId: product.supplierId ?? undefined,
    leadTimeDays: product.leadTimeDays ?? 7,
    suggestedOrderQty: Math.max(
      reorderQty || reorderPoint,
      reorderPoint - quantityOnHand + (reorderQty || reorderPoint),
    ),
  })
}

export async function getStockBalance(
  tenantId: string,
  productId: string,
  warehouseId?: string,
): Promise<StockBalanceSnapshot[]> {
  const balances = await prisma.stockBalance.findMany({
    where: {
      tenantId,
      productId,
      ...(warehouseId ? { warehouseId } : {}),
    },
  })

  if (balances.length) {
    return balances.map((b) => {
      const onHand = toNumber(b.quantityOnHand)
      const reserved = toNumber(b.quantityReserved)
      return {
        productId: b.productId,
        variantId: b.variantId,
        warehouseId: b.warehouseId,
        quantityOnHand: onHand,
        quantityReserved: reserved,
        quantityOnOrder: toNumber(b.quantityOnOrder),
        quantityAvailable: onHand - reserved,
      }
    })
  }

  if (warehouseId) {
    return [
      {
        productId,
        variantId: null,
        warehouseId,
        quantityOnHand: 0,
        quantityReserved: 0,
        quantityOnOrder: 0,
        quantityAvailable: 0,
      },
    ]
  }

  return []
}

export async function recordTransaction(
  tenantId: string,
  txInput: StockTransaction,
): Promise<{ ledgerId: string; totalOnHand: number }> {
  if (txInput.transactionType === 'ADJUSTMENT') {
    if (txInput.quantity === 0) {
      throw new InventoryError('Quantity cannot be zero', 'INVALID_TRANSACTION')
    }
  } else if (txInput.quantity <= 0) {
    throw new InventoryError('Quantity must be positive', 'INVALID_TRANSACTION')
  }

  const product = await validateProduct(tenantId, txInput.productId)
  await validateWarehouse(tenantId, txInput.warehouseId)
  await validateVariant(tenantId, txInput.productId, txInput.variantId)

  const unitCost = txInput.unitCost ?? 0
  const totalCost = Math.abs(txInput.quantity) * unitCost
  const qtyDecimal = toDecimal(txInput.quantity)

  let ledgerId = ''

  await prisma.$transaction(async (tx) => {
    if (product.trackInventory) {
      const balance = await lockBalanceRow(
        tx,
        tenantId,
        txInput.productId,
        txInput.warehouseId,
        txInput.variantId,
      )

      if (OUTBOUND_TRANSACTION_TYPES.includes(txInput.transactionType)) {
        const available =
          toNumber(balance.quantityOnHand) - toNumber(balance.quantityReserved)
        if (available < txInput.quantity) {
          throw new InventoryError(
            `Insufficient stock: available ${available}, requested ${txInput.quantity}`,
            'INSUFFICIENT_STOCK',
          )
        }
      }

      if (txInput.transactionType === 'ADJUSTMENT' && txInput.quantity < 0) {
        const available =
          toNumber(balance.quantityOnHand) - toNumber(balance.quantityReserved)
        if (available < Math.abs(txInput.quantity)) {
          throw new InventoryError(
            `Insufficient stock for adjustment: available ${available}`,
            'INSUFFICIENT_STOCK',
          )
        }
      }
    }

    const entry = await tx.stockLedger.create({
      data: {
        tenantId,
        productId: txInput.productId,
        variantId: txInput.variantId ?? null,
        warehouseId: txInput.warehouseId,
        transactionType: txInput.transactionType,
        quantity: qtyDecimal,
        unitCost: toDecimal(unitCost),
        totalCost: toDecimal(totalCost),
        referenceType: txInput.referenceType,
        referenceId: txInput.referenceId,
        notes: txInput.notes,
        performedBy: txInput.performedBy,
      },
    })
    ledgerId = entry.id
  })

  const totalOnHand = await syncProductInventoryLevel(tenantId, txInput.productId)
  await flagInventoryReforecast(tenantId, txInput.productId)
  await maybeNotifyLowStock(tenantId, product, totalOnHand)

  emitStockLevelChanged(tenantId, {
    productId: txInput.productId,
    productName: product.name,
    sku: product.sku,
    warehouseId: txInput.warehouseId,
    transactionType: txInput.transactionType,
    quantity: txInput.quantity,
    totalOnHand,
    ledgerId,
    notes: txInput.notes,
  })

  if (
    txInput.transactionType === 'SALE' &&
    txInput.referenceType !== 'sales_order' &&
    txInput.productId
  ) {
    const qty = Math.abs(txInput.quantity)
    const unitPrice = toNumber(product.sellingPrice) || unitCost
    const revenue = qty * unitPrice
    const channel =
      txInput.referenceType === 'pos' || txInput.referenceType === 'pos_sale' ? 'POS' : 'DIRECT'
    await emitSalesEvent({
      tenantId,
      productId: txInput.productId,
      quantity: qty,
      revenue,
      cost: toNumber(product.costPrice) * qty,
      channel,
      timestamp: new Date(),
      referenceType: txInput.referenceType ?? 'stock_ledger',
      referenceId: txInput.referenceId ?? ledgerId,
    }).catch(() => {})
  }

  return { ledgerId, totalOnHand }
}

export async function reserveStock(
  tenantId: string,
  productId: string,
  quantity: number,
  referenceId: string,
  options?: { warehouseId?: string; variantId?: string | null; performedBy?: string },
): Promise<void> {
  if (quantity <= 0) throw new InventoryError('Quantity must be positive', 'INVALID_TRANSACTION')

  const product = await validateProduct(tenantId, productId)
  if (!product.trackInventory) return

  const warehouseId = options?.warehouseId ?? (await resolveDefaultWarehouseId(tenantId))
  await validateWarehouse(tenantId, warehouseId)
  await validateVariant(tenantId, productId, options?.variantId)

  await prisma.$transaction(async (tx) => {
    const balance = await lockBalanceRow(tx, tenantId, productId, warehouseId, options?.variantId)
    const available = toNumber(balance.quantityOnHand) - toNumber(balance.quantityReserved)
    if (available < quantity) {
      throw new InventoryError(
        `Insufficient stock to reserve: available ${available}, requested ${quantity}`,
        'INSUFFICIENT_STOCK',
      )
    }

    await tx.stockBalance.update({
      where: { id: balance.id },
      data: { quantityReserved: { increment: toDecimal(quantity) } },
    })

    await tx.stockReservation.create({
      data: {
        tenantId,
        productId,
        variantId: options?.variantId ?? null,
        warehouseId,
        referenceId,
        quantity: toDecimal(quantity),
      },
    })
  })
}

export async function releaseReservation(referenceId: string, tenantId?: string): Promise<void> {
  const reservations = await prisma.stockReservation.findMany({
    where: {
      referenceId,
      ...(tenantId ? { tenantId } : {}),
    },
  })

  if (!reservations.length) {
    throw new InventoryError('No reservations found for reference', 'RESERVATION_NOT_FOUND')
  }

  await prisma.$transaction(async (tx) => {
    for (const reservation of reservations) {
      const balance = await lockBalanceRow(
        tx,
        reservation.tenantId,
        reservation.productId,
        reservation.warehouseId,
        reservation.variantId,
      )

      const releaseQty = Math.min(
        toNumber(reservation.quantity),
        toNumber(balance.quantityReserved),
      )

      await tx.stockBalance.update({
        where: { id: balance.id },
        data: { quantityReserved: { decrement: toDecimal(releaseQty) } },
      })
    }

    await tx.stockReservation.deleteMany({
      where: { referenceId, ...(tenantId ? { tenantId } : {}) },
    })
  })
}

export async function transferStock(
  transferId: string,
  options?: { completedBy?: string },
): Promise<void> {
  const transfer = await prisma.stockTransfer.findUnique({ where: { id: transferId } })
  if (!transfer) throw new InventoryError('Transfer not found', 'TRANSFER_NOT_FOUND')

  if (transfer.status === StockTransferStatus.COMPLETED) return
  if (transfer.status === StockTransferStatus.CANCELLED) {
    throw new InventoryError('Transfer is cancelled', 'TRANSFER_INVALID_STATE')
  }

  const items = parseTransferLineItems(transfer.items)
  if (items.length === 0) {
    throw new InventoryError('Transfer has no line items', 'TRANSFER_INVALID_STATE')
  }

  const affectedProductIds = new Set<string>()

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      if (item.quantity <= 0) continue

      const product = await validateProduct(transfer.tenantId, item.productId)
      await validateVariant(transfer.tenantId, item.productId, item.variantId)

      if (product.trackInventory) {
        const balance = await lockBalanceRow(
          tx,
          transfer.tenantId,
          item.productId,
          transfer.fromWarehouseId,
          item.variantId,
        )
        const available =
          toNumber(balance.quantityOnHand) - toNumber(balance.quantityReserved)
        if (available < item.quantity) {
          throw new InventoryError(
            `Insufficient stock for transfer: product ${item.productId}`,
            'INSUFFICIENT_STOCK',
          )
        }
      }

      const unitCost = item.unitCost ?? 0
      const qty = toDecimal(item.quantity)
      const cost = toDecimal(item.quantity * unitCost)

      await tx.stockLedger.create({
        data: {
          tenantId: transfer.tenantId,
          productId: item.productId,
          variantId: item.variantId ?? null,
          warehouseId: transfer.fromWarehouseId,
          transactionType: 'TRANSFER_OUT',
          quantity: qty,
          unitCost: toDecimal(unitCost),
          totalCost: cost,
          referenceType: 'STOCK_TRANSFER',
          referenceId: transfer.id,
          performedBy: options?.completedBy,
        },
      })

      await tx.stockLedger.create({
        data: {
          tenantId: transfer.tenantId,
          productId: item.productId,
          variantId: item.variantId ?? null,
          warehouseId: transfer.toWarehouseId,
          transactionType: 'TRANSFER_IN',
          quantity: qty,
          unitCost: toDecimal(unitCost),
          totalCost: cost,
          referenceType: 'STOCK_TRANSFER',
          referenceId: transfer.id,
          performedBy: options?.completedBy,
        },
      })

      affectedProductIds.add(item.productId)
    }

    await tx.stockTransfer.update({
      where: { id: transfer.id },
      data: {
        status: StockTransferStatus.COMPLETED,
        completedBy: options?.completedBy,
        completedAt: new Date(),
      },
    })
  })

  for (const productId of affectedProductIds) {
    await syncProductInventoryLevel(transfer.tenantId, productId)
    await flagInventoryReforecast(transfer.tenantId, productId)
  }
}

export { signedQuantity, toNumber, toDecimal }
