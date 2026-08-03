'use client'

import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type UseFormProps,
  type UseFormReturn,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { FORM_MESSAGES } from '@/lib/forms/formMessages'

export { FORM_MESSAGES }

/* ─────────────────────────────────────────────────────────────────────────────
   Global React Hook Form configuration
   ───────────────────────────────────────────────────────────────────────────── */

export const FORM_DEFAULTS = {
  mode: 'onBlur' as const,
  reValidateMode: 'onBlur' as const,
  shouldFocusError: true,
  criteriaMode: 'firstError' as const,
} satisfies Partial<UseFormProps>

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
