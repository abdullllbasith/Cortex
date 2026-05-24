import { z } from 'zod'
import { FORM_MESSAGES } from '@/lib/forms/formMessages'

export const addressSchema = z.object({
  street: z
    .string({ message: FORM_MESSAGES.required })
    .min(1, FORM_MESSAGES.required)
    .max(200, FORM_MESSAGES.maxLength(200)),
  city: z
    .string({ message: FORM_MESSAGES.required })
    .min(1, FORM_MESSAGES.required)
    .max(100, FORM_MESSAGES.maxLength(100)),
  state: z
    .string({ message: FORM_MESSAGES.required })
    .min(1, FORM_MESSAGES.required)
    .max(100, FORM_MESSAGES.maxLength(100)),
  country: z
    .string({ message: FORM_MESSAGES.required })
    .min(2, FORM_MESSAGES.required)
    .max(100, FORM_MESSAGES.maxLength(100)),
  postalCode: z
    .string({ message: FORM_MESSAGES.required })
    .min(2, FORM_MESSAGES.required)
    .max(20, FORM_MESSAGES.maxLength(20)),
})

export type Address = z.infer<typeof addressSchema>
