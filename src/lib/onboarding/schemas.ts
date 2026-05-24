import { z } from 'zod'
import { FORM_MESSAGES } from '@/lib/forms/formMessages'

export const setupStep1Schema = z.object({
  businessName: z.string({ message: FORM_MESSAGES.required }).min(2, FORM_MESSAGES.minLength(2)),
  industry: z.string({ message: FORM_MESSAGES.required }).min(1, FORM_MESSAGES.required),
  companySize: z.enum(['1-10', '11-50', '51-200', '200+']),
  timezone: z.string({ message: FORM_MESSAGES.required }),
  currency: z.string({ message: FORM_MESSAGES.required }),
  fiscalYearStart: z.string({ message: FORM_MESSAGES.required }),
})

export const setupStep2Schema = z.object({
  importMethod: z.enum(['csv', 'integration', 'demo']),
  csvFile: z.any().optional(),
  detectedType: z.enum(['products', 'customers']).optional(),
})

export const setupStep3Schema = z.object({
  workflowTemplate: z.string().optional(),
})

export const setupStep4Schema = z.object({
  invites: z.array(z.object({
    email: z.string().email().or(z.literal('')),
    role: z.enum(['admin', 'member', 'viewer']),
  })).max(5),
})

export const setupSchema = setupStep1Schema
  .merge(setupStep2Schema)
  .merge(setupStep3Schema)
  .merge(setupStep4Schema)

export type SetupFormValues = z.infer<typeof setupSchema>
