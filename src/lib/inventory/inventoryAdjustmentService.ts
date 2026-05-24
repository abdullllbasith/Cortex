import { StockTransactionType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { recordTransaction, getStockBalance } from './stockEngine'

function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

export type AdjustmentKind = 'increase' | 'decrease' | 'write_off' | 'damage'

export interface CreateAdjustmentInput {
  productId: string
  warehouseId: string
  variantId?: string | null
  kind: AdjustmentKind
  quantity: number
  reason: string
  notes?: string
  managerConfirmed?: boolean
  performedBy?: string
}

export class AdjustmentError extends Error {
  constructor(
    message: string,
    public readonly code: 'CONFIRMATION_REQUIRED' | 'VALIDATION_ERROR',
    public readonly details?: { currentStock: number; adjustmentQty: number; thresholdPct: number },
  ) {
    super(message)
    this.name = 'AdjustmentError'
  }
}

export async function createStockAdjustment(
  tenantId: string,
  input: CreateAdjustmentInput,
): Promise<{ ledgerId: string }> {
  if (input.quantity <= 0) {
    throw new AdjustmentError('Quantity must be positive', 'VALIDATION_ERROR')
  }

  const balances = await getStockBalance(tenantId, input.productId, input.warehouseId)
  const balance = balances.find(
    (b) => b.warehouseId === input.warehouseId && (b.variantId ?? null) === (input.variantId ?? null),
  )
  const currentStock = balance?.quantityOnHand ?? 0

  const adjustmentPct = currentStock > 0 ? (input.quantity / currentStock) * 100 : 100
  if (adjustmentPct > 10 && !input.managerConfirmed) {
    throw new AdjustmentError(
      'Manager confirmation required for adjustments exceeding 10% of current stock',
      'CONFIRMATION_REQUIRED',
      { currentStock, adjustmentQty: input.quantity, thresholdPct: 10 },
    )
  }

  let transactionType: StockTransactionType
  let quantity = input.quantity

  switch (input.kind) {
    case 'increase':
      transactionType = 'ADJUSTMENT'
      break
    case 'decrease':
      transactionType = 'ADJUSTMENT'
      quantity = -input.quantity
      break
    case 'write_off':
      transactionType = 'WRITE_OFF'
      break
    case 'damage':
      transactionType = 'DAMAGE'
      break
    default:
      throw new AdjustmentError('Invalid adjustment type', 'VALIDATION_ERROR')
  }

  await recordTransaction(tenantId, {
    productId: input.productId,
    variantId: input.variantId,
    warehouseId: input.warehouseId,
    transactionType,
    quantity,
    referenceType: 'STOCK_ADJUSTMENT',
    referenceId: `adj-${Date.now()}`,
    notes: [input.reason, input.notes].filter(Boolean).join(' — '),
    performedBy: input.performedBy,
  })

  const latest = await prisma.stockLedger.findFirst({
    where: {
      tenantId,
      productId: input.productId,
      warehouseId: input.warehouseId,
      referenceType: 'STOCK_ADJUSTMENT',
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: input.performedBy,
      action: 'STOCK_ADJUSTMENT',
      resourceType: 'stock_adjustment',
      resourceId: latest?.id,
      newValue: {
        kind: input.kind,
        quantity: input.quantity,
        reason: input.reason,
        managerConfirmed: input.managerConfirmed ?? false,
      },
    },
  })

  return { ledgerId: latest?.id ?? '' }
}

export async function listRecentAdjustments(tenantId: string, limit = 20) {
  const entries = await prisma.stockLedger.findMany({
    where: {
      tenantId,
      transactionType: { in: ['ADJUSTMENT', 'WRITE_OFF', 'DAMAGE'] },
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      performer: { select: { fullName: true } },
    },
  })

  return entries.map((e) => ({
    id: e.id,
    transactionType: e.transactionType,
    quantity: toNumber(e.quantity),
    notes: e.notes,
    createdAt: e.createdAt,
    product: e.product,
    warehouse: e.warehouse,
    performer: e.performer,
  }))
}
