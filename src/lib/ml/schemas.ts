import { z } from 'zod'

export const predictionHorizonSchema = z.enum(['7', '30', '90']).default('30')
export const predictionGranularitySchema = z.enum(['daily', 'weekly', 'monthly']).default('daily')

export const salesPredictionQuerySchema = z.object({
  horizon: predictionHorizonSchema,
  granularity: predictionGranularitySchema,
})

export const inventoryPredictionQuerySchema = z.object({
  urgency: z.enum(['critical', 'warning', 'normal', 'all']).default('all'),
})

export const customerPredictionQuerySchema = z.object({
  risk: z.enum(['high', 'medium', 'low', 'all']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const alertListQuerySchema = z.object({
  unreadOnly: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const alertPatchSchema = z.object({
  ids: z.array(z.string()).min(1),
  action: z.enum(['read', 'dismiss']),
})

export const alertRuleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  ruleType: z.string().min(1),
  threshold: z.number(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']),
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
})
