import type { InventoryCostingMethod, StockTransactionType } from '@prisma/client'

export type { InventoryCostingMethod, StockTransactionType }

export interface StockTransaction {
  productId: string
  variantId?: string | null
  warehouseId: string
  transactionType: StockTransactionType
  /** Positive magnitude; sign derived from transactionType for outbound types */
  quantity: number
  unitCost?: number
  referenceType?: string
  referenceId?: string
  notes?: string
  performedBy?: string
}

export interface StockBalanceSnapshot {
  productId: string
  variantId: string | null
  warehouseId: string
  quantityOnHand: number
  quantityReserved: number
  quantityOnOrder: number
  quantityAvailable: number
}

export interface TransferLineItem {
  productId: string
  variantId?: string | null
  quantity: number
  unitCost?: number
}

/** Parse StockTransfer.items JSON from Prisma into typed line items. */
export function parseTransferLineItems(raw: unknown): TransferLineItem[] {
  if (!Array.isArray(raw)) return []
  const items: TransferLineItem[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const productId = typeof r.productId === 'string' ? r.productId : ''
    const quantity = typeof r.quantity === 'number' ? r.quantity : Number(r.quantity)
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) continue
    items.push({
      productId,
      variantId: typeof r.variantId === 'string' ? r.variantId : null,
      quantity,
      unitCost: typeof r.unitCost === 'number' ? r.unitCost : undefined,
    })
  }
  return items
}

export interface ValuationLine {
  productId: string
  variantId: string | null
  warehouseId: string | null
  sku: string
  name: string
  quantityOnHand: number
  unitCost: number
  totalValue: number
}

export interface ValuationReport {
  tenantId: string
  asOfDate: Date
  costingMethod: InventoryCostingMethod
  totalValue: number
  lineCount: number
  lines: ValuationLine[]
}

export interface GrossMarginResult {
  productId: string
  periodStart: Date
  periodEnd: Date
  unitsSold: number
  revenue: number
  cogs: number
  grossMargin: number
  grossMarginPercent: number
}

export interface TenantInventorySettings {
  inventoryCostingMethod?: InventoryCostingMethod
}

export const OUTBOUND_TRANSACTION_TYPES: StockTransactionType[] = [
  'SALE',
  'TRANSFER_OUT',
  'RETURN_OUT',
  'DAMAGE',
  'WRITE_OFF',
]

export const INBOUND_TRANSACTION_TYPES: StockTransactionType[] = [
  'PURCHASE',
  'TRANSFER_IN',
  'RETURN_IN',
  'OPENING',
]

export class InventoryError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'PRODUCT_NOT_FOUND'
      | 'WAREHOUSE_NOT_FOUND'
      | 'VARIANT_NOT_FOUND'
      | 'INSUFFICIENT_STOCK'
      | 'INVALID_TRANSACTION'
      | 'TRANSFER_NOT_FOUND'
      | 'TRANSFER_INVALID_STATE'
      | 'RESERVATION_NOT_FOUND',
  ) {
    super(message)
    this.name = 'InventoryError'
  }
}
