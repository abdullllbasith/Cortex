import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type UseFormProps,
  type UseFormReturn,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'

/* ─────────────────────────────────────────────────────────────────────────────
   Global React Hook Form configuration
   ───────────────────────────────────────────────────────────────────────────── */

export const FORM_DEFAULTS = {
  mode: 'onBlur' as const,
  reValidateMode: 'onBlur' as const,
  shouldFocusError: true,
  criteriaMode: 'firstError' as const,
} satisfies Partial<UseFormProps>

/** Standard English validation messages used across Zod schemas */
export const FORM_MESSAGES = {
  required:     'This field is required.',
  email:        'Enter a valid email address.',
  phone:        'Enter a valid phone number.',
  url:          'Enter a valid URL.',
  slug:         'Use lowercase letters, numbers, and hyphens only.',
  currency:     'Enter a valid monetary amount.',
  percentage:   'Enter a value between 0 and 100.',
  minLength:    (n: number) => `Must be at least ${n} characters.`,
  maxLength:    (n: number) => `Must be no more than ${n} characters.`,
  min:          (n: number) => `Must be at least ${n}.`,
  max:          (n: number) => `Must be no more than ${n}.`,
  invalidDate:  'Enter a valid date.',
  dateRange:    'End date must be after start date.',
  fileTooLarge: (mb: number) => `File must be smaller than ${mb} MB.`,
  fileType:     'This file type is not allowed.',
} as const

/**
 * Create a form with global defaults + Zod resolver.
 *
 * @example
 * const form = useAppForm({ schema: loginSchema, defaultValues: { email: '' } })
 */
export function useAppForm<TFieldValues extends FieldValues>({
  schema,
  defaultValues,
  ...options
}: Omit<UseFormProps<TFieldValues>, 'resolver' | 'defaultValues'> & {
  schema: z.ZodType<TFieldValues>
  defaultValues?: DefaultValues<TFieldValues>
}): UseFormReturn<TFieldValues> {
  return useForm<TFieldValues>({
    ...FORM_DEFAULTS,
    ...options,
    // Zod 4 + @hookform/resolvers typing gap — runtime is correct
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any) as UseFormProps<TFieldValues>['resolver'],
    defaultValues,
  })
}
