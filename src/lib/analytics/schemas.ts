import { z } from 'zod'

export const analyticsQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month', 'last_month', 'quarter', 'year', 'custom']).default('month'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  branchId: z.string().optional(),
  productId: z.string().optional(),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
})

export const customerAnalyticsSchema = analyticsQuerySchema.omit({ branchId: true, productId: true, granularity: true })
export const inventoryAnalyticsSchema = analyticsQuerySchema.omit({ branchId: true, productId: true, granularity: true })
export const supplierAnalyticsSchema = analyticsQuerySchema.omit({ branchId: true, productId: true, granularity: true })

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>
