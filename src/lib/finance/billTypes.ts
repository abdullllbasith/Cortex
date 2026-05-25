export interface BillLineItem {
  description: string
  quantity: number
  unitCost: number
  taxRate: number
  lineTotal: number
  productId?: string | null
}

export function normalizeBillItems(raw: unknown[]): BillLineItem[] {
  return raw.map((row) => {
    const item = row as Record<string, unknown>
    const quantity = Number(item.quantity ?? 1)
    const unitCost = Number(item.unitCost ?? 0)
    const taxRate = Number(item.taxRate ?? 0)
    const taxable = quantity * unitCost
    const taxAmt = taxable * (taxRate / 100)
    const lineTotal = Math.round((taxable + taxAmt) * 100) / 100
    return {
      description: String(item.description ?? ''),
      quantity,
      unitCost,
      taxRate,
      lineTotal,
      productId: (item.productId as string) ?? null,
    }
  })
}

export function parseBillItems(json: unknown): BillLineItem[] {
  if (!Array.isArray(json)) return []
  return normalizeBillItems(json)
}

export function calculateBillTotals(items: BillLineItem[]) {
  let subtotal = 0
  let taxTotal = 0
  for (const item of items) {
    const gross = item.quantity * item.unitCost
    subtotal += gross
    taxTotal += gross * (item.taxRate / 100)
  }
  const total = subtotal + taxTotal
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxTotal: Math.round(taxTotal * 100) / 100,
    total: Math.round(total * 100) / 100,
  }
}

export function computeBillStatus(
  amountDue: number,
  amountPaid: number,
  dueDate: Date,
  current: string,
): 'DRAFT' | 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'VOID' {
  if (current === 'VOID') return 'VOID'
  if (amountDue <= 0 && amountPaid > 0) return 'PAID'
  if (amountPaid > 0 && amountDue > 0) {
    if (dueDate < new Date() && current !== 'DRAFT') return 'OVERDUE'
    return 'PARTIAL'
  }
  if (dueDate < new Date() && ['PENDING', 'PARTIAL'].includes(current)) return 'OVERDUE'
  if (current === 'DRAFT') return 'DRAFT'
  return 'PENDING'
}
