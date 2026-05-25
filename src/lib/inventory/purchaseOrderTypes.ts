export interface POItem {
  productId: string
  variantId?: string | null
  quantity: number
  unitCost: number
  taxRate: number
  totalCost: number
  quantityReceived: number
}

export interface ReceiptItem {
  poItemIndex: number
  quantityReceived: number
  unitCost: number
  batchNumber?: string | null
  expiryDate?: string | null
}

export function parsePoItems(raw: unknown): POItem[] {
  if (!Array.isArray(raw)) return []
  return raw as POItem[]
}
