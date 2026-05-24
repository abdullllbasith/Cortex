import { z } from 'zod'
import { FORM_MESSAGES } from '@/lib/forms/formMessages'

/* ── Primitives ─────────────────────────────────────────────────────────────── */

export const emailSchema = z
  .string({ message: FORM_MESSAGES.required })
  .min(1, FORM_MESSAGES.required)
  .email(FORM_MESSAGES.email)

export const phoneSchema = z
  .string({ message: FORM_MESSAGES.required })
  .min(1, FORM_MESSAGES.required)
  .regex(
    /^[+]?[\d\s().-]{7,20}$/,
    FORM_MESSAGES.phone,
  )

export const urlSchema = z
  .string({ message: FORM_MESSAGES.required })
  .min(1, FORM_MESSAGES.required)
  .url(FORM_MESSAGES.url)

export const slugSchema = z
  .string({ message: FORM_MESSAGES.required })
  .min(1, FORM_MESSAGES.required)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, FORM_MESSAGES.slug)

export const currencySchema = z
  .number({ message: FORM_MESSAGES.currency })
  .min(0, FORM_MESSAGES.min(0))
  .multipleOf(0.01, FORM_MESSAGES.currency)

export const percentageSchema = z
  .number({ message: FORM_MESSAGES.percentage })
  .min(0, FORM_MESSAGES.percentage)
  .max(100, FORM_MESSAGES.percentage)

export const isoDateSchema = z
  .string({ message: FORM_MESSAGES.required })
  .min(1, FORM_MESSAGES.required)
  .refine((v) => !Number.isNaN(Date.parse(v)), FORM_MESSAGES.invalidDate)

export const dateRangeSchema = z
  .object({
    from: isoDateSchema,
    to:   isoDateSchema,
  })
  .refine(
    ({ from, to }) => new Date(from) <= new Date(to),
    { message: FORM_MESSAGES.dateRange, path: ['to'] },
  )

export type Email      = z.infer<typeof emailSchema>
export type Phone      = z.infer<typeof phoneSchema>
export type Url        = z.infer<typeof urlSchema>
export type Slug       = z.infer<typeof slugSchema>
export type Currency   = z.infer<typeof currencySchema>
export type Percentage = z.infer<typeof percentageSchema>
export type IsoDate    = z.infer<typeof isoDateSchema>
export type DateRange  = z.infer<typeof dateRangeSchema>
