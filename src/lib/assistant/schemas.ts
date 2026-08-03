import { z } from 'zod'

export const chatRequestSchema = z.object({
  tenantId: z.string().optional(),
  userId: z.string().optional(),
  message: z.string().min(1, 'Message is required').max(8000),
  sessionId: z.string().nullish(),
})

export const createSessionSchema = z.object({
  title: z.string().max(200).optional(),
  channel: z.string().default('web'),
})

export const sessionListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  archived: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
})

export const messageListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const presenceEventSchema = z.object({
  type: z.enum(['typing', 'presence']),
  sessionId: z.string(),
  isTyping: z.boolean().optional(),
  status: z.enum(['online', 'offline', 'away']).optional(),
})

export const channelUpdateSchema = z.object({
  channel: z.enum(['whatsapp', 'slack', 'email']),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).optional(),
})
