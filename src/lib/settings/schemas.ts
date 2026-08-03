import { z } from 'zod'

const persistedAssetUrl = z
  .union([
    z
      .string()
      .url()
      .refine((url) => !url.startsWith('blob:'), 'Upload must be saved to storage'),
    z.string().regex(/^\//),
  ])
  .nullable()
  .optional()

export const tenantGeneralUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  settings: z
    .object({
      logoUrl: persistedAssetUrl,
      industry: z.string().optional(),
      companySize: z.string().optional(),
      foundedYear: z.number().int().min(1800).max(2100).optional(),
      website: z.string().url().optional().or(z.literal('')),
      description: z.string().max(2000).optional(),
      timezone: z.string().optional(),
      currency: z.string().optional(),
      dateFormat: z.string().optional(),
      numberFormat: z.string().optional(),
      language: z.string().optional(),
      fiscalYearStartMonth: z.number().int().min(0).max(11).optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
    })
    .optional(),
})

export const profileUpdateSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  jobTitle: z.string().max(120).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  avatarUrl: persistedAssetUrl,
  timezone: z.string().nullable().optional(),
  profileSettings: z
    .object({
      notifyEmail: z.boolean().optional(),
      theme: z.enum(['light', 'dark', 'system']).optional(),
    })
    .optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
})

export const webhookCreateSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
})
