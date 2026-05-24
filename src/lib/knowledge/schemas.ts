import { z } from 'zod'
import { BusinessKnowledgeType } from '@prisma/client'

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  search: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
})

export const customerCreateSchema = z.object({
  profile: z.record(z.string(), z.unknown()).default({}),
  purchaseHistory: z.array(z.record(z.string(), z.unknown())).default([]),
  preferences: z.record(z.string(), z.unknown()).default({}),
  communicationHistory: z.array(z.record(z.string(), z.unknown())).default([]),
  loyaltyData: z.record(z.string(), z.unknown()).default({}),
})

export const customerUpdateSchema = customerCreateSchema.partial().extend({
  version: z.number().int().min(0),
})

export const productCreateSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  catalog: z.record(z.string(), z.unknown()).default({}),
  inventoryLevel: z.number().int().min(0).default(0),
  supplierInfo: z.record(z.string(), z.unknown()).default({}),
  pricingHistory: z.array(z.record(z.string(), z.unknown())).default([]),
})

export const productUpdateSchema = productCreateSchema.partial().extend({
  version: z.number().int().min(0),
})

export const supplierCreateSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  performanceScore: z.number().min(0).max(100).default(0),
  deliveryHistory: z.array(z.record(z.string(), z.unknown())).default([]),
  reliabilityMetrics: z.record(z.string(), z.unknown()).default({}),
  costTrends: z.array(z.record(z.string(), z.unknown())).default([]),
})

export const supplierUpdateSchema = supplierCreateSchema.partial().extend({
  version: z.number().int().min(0),
})

export const knowledgeCreateSchema = z.object({
  type: z.nativeEnum(BusinessKnowledgeType),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

export const knowledgeUpdateSchema = knowledgeCreateSchema.partial().extend({
  version: z.number().int().min(0),
})

export const indexRequestSchema = z.object({
  entityTypes: z.array(z.enum(['customer', 'product', 'supplier', 'knowledge'])).optional(),
})

export const semanticSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  entityType: z.enum(['customer', 'product', 'supplier', 'knowledge', 'all']).default('all'),
  topK: z.coerce.number().int().min(1).max(50).default(10),
})

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>
export type ProductCreateInput = z.infer<typeof productCreateSchema>
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>
export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>
export type SupplierUpdateInput = z.infer<typeof supplierUpdateSchema>
export type KnowledgeCreateInput = z.infer<typeof knowledgeCreateSchema>
export type KnowledgeUpdateInput = z.infer<typeof knowledgeUpdateSchema>
