import { z } from 'zod'

export const accountCreateSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(120),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  subtype: z.string().max(60).optional().nullable(),
  parentId: z.string().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  currency: z.string().length(3).optional(),
})

export const accountUpdateSchema = accountCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export const accountListQuerySchema = z.object({
  tree: z.coerce.boolean().optional(),
  byType: z.coerce.boolean().optional(),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']).optional(),
  search: z.string().optional(),
})

export const ledgerQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const journalLineSchema = z.object({
  accountId: z.string().min(1),
  description: z.string().max(500).optional(),
  debit: z.number().min(0),
  credit: z.number().min(0),
  currency: z.string().length(3).optional(),
  exchangeRate: z.number().positive().optional(),
})

export const journalCreateSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1).max(500),
  reference: z.string().max(120).optional(),
  referenceType: z
    .enum(['INVOICE', 'BILL', 'PAYMENT', 'ADJUSTMENT', 'OPENING', 'PAYROLL', 'TRANSFER'])
    .optional(),
  referenceId: z.string().optional(),
  lines: z.array(journalLineSchema).min(2),
  post: z.boolean().optional(),
})

export const journalListQuerySchema = z.object({
  status: z.enum(['DRAFT', 'POSTED', 'VOIDED']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const journalVoidSchema = z.object({
  reason: z.string().min(1).max(500),
})

export const taxRateCreateSchema = z.object({
  name: z.string().min(1).max(80),
  rate: z.number().min(0).max(100),
  type: z.enum(['SALES', 'PURCHASE', 'BOTH']).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const taxRateUpdateSchema = taxRateCreateSchema.partial().extend({
  id: z.string().min(1),
})

export const trialBalanceQuerySchema = z.object({
  asOf: z.string().optional(),
})

export const onboardingSetupSchema = z.object({
  businessName: z.string().min(1).optional(),
  currency: z.string().length(3).optional(),
  fiscalYearStart: z.string().optional(),
  timezone: z.string().optional(),
})

const invoiceLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
  productId: z.string().optional().nullable(),
})

export const invoiceCreateSchema = z.object({
  contactId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  orderId: z.string().optional().nullable(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  items: z.array(invoiceLineSchema).min(1),
  notes: z.string().max(5000).optional().nullable(),
  termsAndConditions: z.string().max(5000).optional().nullable(),
  currency: z.string().length(3).optional(),
})

export const invoiceUpdateSchema = invoiceCreateSchema.partial()

export const invoiceListQuerySchema = z.object({
  status: z
    .enum(['DRAFT', 'SENT', 'VIEWED', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID', 'CANCELLED', 'UNPAID'])
    .optional(),
  search: z.string().optional(),
  orderId: z.string().optional(),
  summary: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
})

export const invoicePaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'CREDIT']).optional(),
  paymentDate: z.string().optional(),
  reference: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
})

export const invoiceVoidSchema = z.object({
  reason: z.string().min(1).max(500),
})

const billLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitCost: z.number().min(0),
  taxRate: z.number().min(0).max(100).default(0),
  productId: z.string().optional().nullable(),
})

export const billCreateSchema = z.object({
  supplierId: z.string().min(1),
  purchaseOrderId: z.string().optional().nullable(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  items: z.array(billLineSchema).min(1),
  notes: z.string().max(5000).optional().nullable(),
  currency: z.string().length(3).optional(),
})

export const billUpdateSchema = billCreateSchema.partial().extend({
  status: z.enum(['DRAFT', 'PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID']).optional(),
})

export const billListQuerySchema = z.object({
  status: z.enum(['DRAFT', 'PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID']).optional(),
  search: z.string().optional(),
  purchaseOrderId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
})

export const billPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'CREDIT']).optional(),
  paymentDate: z.string().optional(),
  reference: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
})

export const reportDateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  asOfDate: z.string().optional(),
})
