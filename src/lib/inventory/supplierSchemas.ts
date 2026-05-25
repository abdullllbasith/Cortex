import { z } from 'zod'

export const supplierTypeEnum = z.enum(['MANUFACTURER', 'DISTRIBUTOR', 'WHOLESALER', 'SERVICE_PROVIDER'])
export const paymentTermsEnum = z.enum(['IMMEDIATE', 'NET15', 'NET30', 'NET45', 'NET60'])

const addressSchema = z.object({
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
}).passthrough()

const bankDetailsSchema = z.object({
  bankName: z.string().optional(),
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
  swiftCode: z.string().optional(),
}).passthrough()

export const supplierCreateSchema = z.object({
  name: z.string().min(1).max(200),
  type: supplierTypeEnum.default('DISTRIBUTOR'),
  contactName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal('')),
  address: addressSchema.optional(),
  paymentTerms: paymentTermsEnum.default('NET30'),
  currency: z.string().length(3).default('USD'),
  taxNumber: z.string().optional().nullable(),
  bankDetails: bankDetailsSchema.optional().nullable(),
  creditLimit: z.number().min(0).optional().nullable(),
  isActive: z.boolean().default(true),
  notes: z.string().optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
  contacts: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    designation: z.string().optional().nullable(),
    isPrimary: z.boolean().default(false),
  })).optional(),
})

export const supplierUpdateSchema = supplierCreateSchema.partial().extend({
  version: z.number().int().optional(),
})

export const supplierListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  type: supplierTypeEnum.optional(),
  paymentTerms: paymentTermsEnum.optional(),
  minScore: z.coerce.number().optional(),
  maxScore: z.coerce.number().optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  sort: z.enum(['name', 'reliability', 'lastOrder']).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
})

export const supplierProductSchema = z.object({
  productId: z.string().min(1),
  supplierSku: z.string().optional().nullable(),
  unitCost: z.number().min(0),
  minOrderQty: z.number().int().min(1).default(1),
  leadTimeDays: z.number().int().min(0).default(7),
  isPreferred: z.boolean().default(false),
})

export const supplierProductUpdateSchema = supplierProductSchema.partial().omit({ productId: true })

export const supplierContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  isPrimary: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export const supplierContactUpdateSchema = supplierContactSchema.partial()

export const supplierImportRowSchema = z.object({
  name: z.string().min(1),
  type: supplierTypeEnum.optional(),
  contactName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  paymentTerms: paymentTermsEnum.optional(),
  currency: z.string().optional(),
})

export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>
export type SupplierUpdateInput = z.infer<typeof supplierUpdateSchema>
export type SupplierProductInput = z.infer<typeof supplierProductSchema>
export type SupplierContactInput = z.infer<typeof supplierContactSchema>
