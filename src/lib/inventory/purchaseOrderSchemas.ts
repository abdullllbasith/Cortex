import { z } from 'zod'

export const poLineItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional().nullable(),
  quantity: z.number().positive(),
  unitCost: z.number().min(0),
  taxRate: z.number().min(0).default(0),
})

export const createPOSchema = z.object({
  supplierId: z.string().min(1),
  warehouseId: z.string().min(1),
  items: z.array(poLineItemSchema).min(1),
  shippingCost: z.number().min(0).default(0),
  currency: z.string().min(3).max(3).default('USD'),
  expectedDelivery: z.string().datetime().optional().nullable(),
  terms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const updatePOSchema = createPOSchema.partial()

export const poListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['DRAFT', 'SENT', 'ACKNOWLEDGED', 'PARTIAL', 'RECEIVED', 'CANCELLED'])
    .optional(),
  supplierId: z.string().optional(),
  warehouseId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
})

export const receiveGoodsItemSchema = z.object({
  poItemIndex: z.number().int().min(0),
  quantityReceived: z.number().positive(),
  unitCost: z.number().min(0).optional(),
  batchNumber: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
})

export const receiveGoodsSchema = z.object({
  items: z.array(receiveGoodsItemSchema).min(1),
  notes: z.string().optional().nullable(),
})

export type CreatePOInput = z.infer<typeof createPOSchema>
export type UpdatePOInput = z.infer<typeof updatePOSchema>
export type ReceiveGoodsInput = z.infer<typeof receiveGoodsSchema>
