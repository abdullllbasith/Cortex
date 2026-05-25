import type { InvoiceStatus } from '@prisma/client'

export interface InvoiceLineItem {
  description: string
  quantity: number
  unitPrice: number
  discount: number
  taxRate: number
  lineTotal: number
  productId?: string | null
  sku?: string
}

export interface InvoicePdfData {
  tenantName: string
  tenantAddress?: string | null
  logoUrl?: string | null
  invoiceNumber: string
  issueDate: string
  dueDate: string
  customerName: string
  customerEmail?: string | null
  customerCompany?: string | null
  currency: string
  lines: Array<{ description: string; quantity: number; unitPrice: number; lineTotal: number }>
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
  amountPaid: number
  amountDue: number
  notes?: string | null
  terms?: string | null
  bankDetails?: string | null
}

export interface InvoiceSummary {
  unpaidTotal: number
  overdueTotal: number
  paidThisMonth: number
  avgDaysToPayment: number
}

export interface ArAgingBucket {
  label: string
  count: number
  total: number
}

export function normalizeInvoiceItems(raw: unknown[]): InvoiceLineItem[] {
  return raw.map((row) => {
    const item = row as Record<string, unknown>
    const quantity = Number(item.quantity ?? 1)
    const unitPrice = Number(item.unitPrice ?? 0)
    const discount = Number(item.discount ?? 0)
    const taxRate = Number(item.taxRate ?? 0)
    const gross = quantity * unitPrice
    const discountAmt = gross * (discount / 100)
    const taxable = gross - discountAmt
    const taxAmt = taxable * (taxRate / 100)
    const lineTotal = Math.round((taxable + taxAmt) * 100) / 100
    return {
      description: String(item.description ?? ''),
      quantity,
      unitPrice,
      discount,
      taxRate,
      lineTotal,
      productId: (item.productId as string) ?? null,
      sku: item.sku as string | undefined,
    }
  })
}

export function parseInvoiceItems(json: unknown): InvoiceLineItem[] {
  if (!Array.isArray(json)) return []
  return normalizeInvoiceItems(json)
}

export function computeInvoiceStatus(
  amountDue: number,
  amountPaid: number,
  dueDate: Date,
  current: InvoiceStatus,
): InvoiceStatus {
  if (current === 'VOID' || current === 'CANCELLED') return current
  if (amountDue <= 0 && amountPaid > 0) return 'PAID'
  if (amountPaid > 0 && amountDue > 0) {
    if (dueDate < new Date() && current !== 'DRAFT') return 'OVERDUE'
    return 'PARTIAL'
  }
  if (dueDate < new Date() && ['SENT', 'VIEWED', 'PARTIAL'].includes(current)) return 'OVERDUE'
  return current
}
