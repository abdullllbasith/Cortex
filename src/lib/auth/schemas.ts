import { z } from 'zod'
import { emailSchema, slugSchema } from '@/lib/schemas'
import { FORM_MESSAGES } from '@/lib/forms/formConfig'

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ message: FORM_MESSAGES.required }).min(1, FORM_MESSAGES.required),
  rememberMe: z.boolean().optional(),
})

export const registerStep1Schema = z.object({
  firstName: z.string({ message: FORM_MESSAGES.required }).min(1, FORM_MESSAGES.required),
  lastName: z.string({ message: FORM_MESSAGES.required }).min(1, FORM_MESSAGES.required),
  email: emailSchema,
  password: z
    .string({ message: FORM_MESSAGES.required })
    .min(8, FORM_MESSAGES.minLength(8))
    .regex(/[A-Z]/, 'Include at least one uppercase letter')
    .regex(/\d/, 'Include at least one number'),
})

export const registerStep2Schema = z.object({
  companyName: z.string({ message: FORM_MESSAGES.required }).min(2, FORM_MESSAGES.minLength(2)),
  slug: slugSchema,
})

export const registerStep3Schema = z.object({
  plan: z.enum(['starter', 'professional', 'enterprise']),
})

export const registerSchema = registerStep1Schema
  .merge(registerStep2Schema)
  .merge(registerStep3Schema)

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z
  .object({
    password: z
      .string({ message: FORM_MESSAGES.required })
      .min(8, FORM_MESSAGES.minLength(8)),
    confirmPassword: z.string({ message: FORM_MESSAGES.required }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const inviteAcceptSchema = z
  .object({
    password: z
      .string({ message: FORM_MESSAGES.required })
      .min(8, FORM_MESSAGES.minLength(8)),
    confirmPassword: z.string({ message: FORM_MESSAGES.required }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type LoginFormValues = z.infer<typeof loginSchema>
export type RegisterFormValues = z.infer<typeof registerSchema>
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
export type InviteAcceptValues = z.infer<typeof inviteAcceptSchema>
