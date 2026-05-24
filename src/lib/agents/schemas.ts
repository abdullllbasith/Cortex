import { z } from 'zod'
import { AgentTaskPriority } from '@prisma/client'

export const createAgentTaskSchema = z.object({
  tenantId: z.string().optional(),
  userId: z.string().optional(),
  task: z.string().min(1).max(4000),
  preferredAgent: z.enum(['finance', 'sales', 'inventory', 'operations', 'executive']).optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
})

export const agentLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  agentType: z.enum(['finance', 'sales', 'inventory', 'operations', 'executive']).optional(),
  status: z.enum(['SUCCESS', 'FAILURE', 'PARTIAL']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export const memoryInjectSchema = z.object({
  key: z.string().min(1).max(200),
  value: z.unknown(),
  ttlSeconds: z.number().int().positive().optional(),
})

export type CreateAgentTaskInput = z.infer<typeof createAgentTaskSchema>

export const PRIORITY_ENUM = AgentTaskPriority
