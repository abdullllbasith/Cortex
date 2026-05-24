import { z } from 'zod'
import { WorkflowTriggerType } from '@prisma/client'

export const workflowNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  data: z.object({
    label: z.string().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
})

export const workflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
})

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  triggerType: z.nativeEnum(WorkflowTriggerType).default('MANUAL'),
  triggerConfig: z.record(z.string(), z.unknown()).optional(),
  nodes: z.array(workflowNodeSchema).default([]),
  edges: z.array(workflowEdgeSchema).default([]),
  templateId: z.string().optional(),
})

export const updateWorkflowSchema = createWorkflowSchema.partial()

export const executeWorkflowSchema = z.object({
  inputData: z.record(z.string(), z.unknown()).optional(),
})

export const activateWorkflowSchema = z.object({
  isActive: z.boolean(),
})

export const executionListQuerySchema = z.object({
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'all']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
