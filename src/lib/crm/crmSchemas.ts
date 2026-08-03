import { z } from 'zod'

export const contactCreateSchema = z.object({
  type: z.enum(['CUSTOMER', 'LEAD', 'PROSPECT']).default('LEAD'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  source: z.enum(['MANUAL', 'IMPORT', 'WEBSITE', 'REFERRAL', 'WHATSAPP', 'SOCIAL']).default('MANUAL'),
  ownerId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional().nullable(),
  address: z.record(z.string(), z.unknown()).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  doNotContact: z.boolean().optional(),
  nextFollowUpAt: z.string().datetime().optional().nullable(),
})

export const contactUpdateSchema = contactCreateSchema.partial()

export const companySchema = z.object({
  name: z.string().min(1),
  industry: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.record(z.string(), z.unknown()).optional(),
  ownerId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  annualRevenue: z.number().optional().nullable(),
  employeeCount: z.number().int().optional().nullable(),
})

export const pipelineStageSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number().int(),
  probability: z.number().int().min(0).max(100),
  color: z.string(),
  rottenDays: z.number().int().positive().optional(),
})

export const pipelineSchema = z.object({
  name: z.string().min(1),
  isDefault: z.boolean().optional(),
  stages: z.array(pipelineStageSchema).min(1),
})

export const dealCreateSchema = z.object({
  title: z.string().min(1),
  contactId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  pipelineId: z.string().min(1),
  stageId: z.string().min(1),
  value: z.number().min(0).default(0),
  currency: z.string().default('USD'),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().optional().nullable(),
})

export const dealUpdateSchema = dealCreateSchema.partial().extend({
  status: z.enum(['OPEN', 'WON', 'LOST', 'ON_HOLD']).optional(),
  lostReason: z.string().optional().nullable(),
  stageId: z.string().optional(),
})

export const activitySchema = z.object({
  type: z.enum(['NOTE', 'CALL', 'EMAIL', 'MEETING', 'TASK', 'WHATSAPP', 'DEMO']),
  subject: z.string().min(1),
  description: z.string().optional().nullable(),
  outcome: z.string().optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
  duration: z.number().int().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  isCompleted: z.boolean().optional(),
  dealId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
})

export type PipelineStage = z.infer<typeof pipelineStageSchema>

export const contactListQuerySchema = z.object({
  segment: z.enum(['all', 'mine', 'new', 'overdue', 'high_value']).optional(),
  search: z.string().optional(),
  semantic: z.coerce.boolean().optional(),
  type: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const dealListFiltersSchema = z.object({
  pipelineId: z.string().optional(),
  ownerId: z.string().optional(),
  valueMin: z.coerce.number().optional(),
  valueMax: z.coerce.number().optional(),
  closeFrom: z.string().optional(),
  closeTo: z.string().optional(),
  summary: z.enum(['true']).optional(),
})

export const dealWonSchema = z.object({
  actualValue: z.number().min(0).optional(),
})

export const dealLostSchema = z.object({
  reason: z.string().min(1),
})

export const dealMoveSchema = z.object({
  stageId: z.string().min(1),
})

export const scheduleFollowUpSchema = z.object({
  date: z.string().min(1),
  assignTo: z.string().optional().nullable(),
})

export const contactActivityQuerySchema = z.object({
  type: z.string().optional(),
  assigneeId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})
