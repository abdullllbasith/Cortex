import { z } from 'zod'

export const lineItemSchema = z.object({
  productId: z.string().optional().nullable(),
  variantId: z.string().optional().nullable(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
  lineTotal: z.number().min(0).optional(),
  sku: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
})

export const quoteCreateSchema = z.object({
  contactId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  items: z.array(lineItemSchema).min(1),
  currency: z.string().default('USD'),
  notes: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'SENT']).optional(),
})

export const quoteUpdateSchema = quoteCreateSchema.partial()

export const orderCreateSchema = z.object({
  quoteId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  items: z.array(lineItemSchema).min(1),
  currency: z.string().default('USD'),
  shippingCost: z.number().min(0).default(0),
  shippingAddress: z.record(z.string(), z.unknown()).optional(),
  billingAddress: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().optional().nullable(),
  paymentStatus: z.enum(['UNPAID', 'PARTIAL', 'PAID']).optional(),
})

export const orderUpdateSchema = orderCreateSchema.partial().extend({
  status: z.enum(['DRAFT', 'CONFIRMED', 'PROCESSING', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED']).optional(),
})

export const fulfillmentSchema = z.object({
  warehouseId: z.string().optional().nullable(),
  status: z.enum(['PENDING', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED']).optional(),
  items: z.array(z.object({
    orderItemIndex: z.number().int().min(0),
    quantityFulfilled: z.number().positive(),
  })).optional(),
  trackingNumber: z.string().optional().nullable(),
  carrier: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  deliverAfter: z.boolean().optional(),
})

export const orderListQuerySchema = z.object({
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const quoteListQuerySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})
