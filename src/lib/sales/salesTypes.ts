export interface SalesLineItem {
  productId?: string | null
  variantId?: string | null
  description: string
  quantity: number
  unitPrice: number
  discount: number
  taxRate: number
  lineTotal: number
  sku?: string
  imageUrl?: string | null
}

export interface FulfillmentLineItem {
  orderItemIndex: number
  quantityFulfilled: number
}

export function calculateLineTotal(item: Pick<SalesLineItem, 'quantity' | 'unitPrice' | 'discount' | 'taxRate'>): number {
  const gross = item.quantity * item.unitPrice
  const discountAmt = gross * (item.discount / 100)
  const taxable = gross - discountAmt
  const taxAmt = taxable * (item.taxRate / 100)
  return Math.round((taxable + taxAmt) * 100) / 100
}

export function calculateOrderTotals(items: SalesLineItem[], shippingCost = 0) {
  let subtotal = 0
  let discountTotal = 0
  let taxTotal = 0

  for (const item of items) {
    const gross = item.quantity * item.unitPrice
    const discountAmt = gross * (item.discount / 100)
    const taxable = gross - discountAmt
    const taxAmt = taxable * (item.taxRate / 100)
    subtotal += gross
    discountTotal += discountAmt
    taxTotal += taxAmt
  }

  const total = subtotal - discountTotal + taxTotal + shippingCost
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountTotal: Math.round(discountTotal * 100) / 100,
    taxTotal: Math.round(taxTotal * 100) / 100,
    total: Math.round(total * 100) / 100,
  }
}

export function normalizeLineItems(raw: unknown[]): SalesLineItem[] {
  return raw.map((row) => {
    const item = row as Record<string, unknown>
    const base = {
      productId: (item.productId as string) ?? null,
      variantId: (item.variantId as string) ?? null,
      description: String(item.description ?? ''),
      quantity: Number(item.quantity ?? 1),
      unitPrice: Number(item.unitPrice ?? 0),
      discount: Number(item.discount ?? 0),
      taxRate: Number(item.taxRate ?? 0),
      sku: item.sku as string | undefined,
      imageUrl: (item.imageUrl as string) ?? null,
    }
    return { ...base, lineTotal: calculateLineTotal(base) }
  })
}

export function parseLineItems(json: unknown): SalesLineItem[] {
  if (!Array.isArray(json)) return []
  return normalizeLineItems(json)
}
