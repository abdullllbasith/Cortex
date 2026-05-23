'use client'

import { Check, X, Loader2 } from 'lucide-react'
import { Controller, useFormContext, type FieldPath, type FieldValues } from 'react-hook-form'
import useSWR from 'swr'
import { useDebounce } from '@/hooks/useDebounce'
import { Input } from '@/components/ui/Input'
import { FormField } from '@/components/forms/FormField'
import { cn } from '@/lib/utils'
import { PLANS } from '@/lib/auth/plans'

async function checkSlug(slug: string) {
  if (!slug || slug.length < 3) return { available: false }
  const res = await fetch(`/api/auth/check-slug?slug=${encodeURIComponent(slug)}`)
  return res.json() as Promise<{ available: boolean }>
}

export interface SlugFieldProps<T extends FieldValues> {
  name: FieldPath<T>
  label?: string
  companyNameField?: FieldPath<T>
}

export function SlugField<T extends FieldValues>({
  name,
  label = 'Workspace URL',
  companyNameField,
}: SlugFieldProps<T>) {
  const { control, watch, setValue } = useFormContext<T>()
  const companyName = companyNameField ? watch(companyNameField) : ''
  const slug = watch(name) as string
  const debouncedSlug = useDebounce(slug, 500)

  const { data, isLoading } = useSWR(
    debouncedSlug && debouncedSlug.length >= 3 ? ['slug-check', debouncedSlug] : null,
    () => checkSlug(debouncedSlug),
  )

  const autoSlug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <FormField
          name={name}
          label={label}
          helperText="Your team will access SAIOS at saios.app/your-slug"
          required
          error={fieldState.error?.message}
        >
          <div className="flex items-center gap-0">
            <span className="flex h-10 items-center rounded-l-md border border-r-0 border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              saios.app/
            </span>
            <div className="relative flex-1">
              <Input
                {...field}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={() => {
                  if (!field.value && companyName) {
                    setValue(name, autoSlug(String(companyName)) as never)
                  }
                  field.onBlur()
                }}
                placeholder="your-company"
                className="rounded-l-none pr-10"
                error={fieldState.error?.message}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isLoading && debouncedSlug?.length >= 3 && (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                )}
                {!isLoading && data?.available === true && (
                  <Check className="h-4 w-4 text-emerald-500" aria-label="Available" />
                )}
                {!isLoading && data?.available === false && debouncedSlug?.length >= 3 && (
                  <X className="h-4 w-4 text-red-500" aria-label="Unavailable" />
                )}
              </div>
            </div>
          </div>
          {!fieldState.error && data?.available === false && debouncedSlug?.length >= 3 && (
            <p className="mt-1 text-xs text-red-500">This slug is already taken</p>
          )}
        </FormField>
      )}
    />
  )
}

export function PlanSelector<T extends FieldValues>({ name }: { name: FieldPath<T> }) {
  const { control } = useFormContext<T>()

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const selected = field.value === plan.id
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => field.onChange(plan.id)}
                className={cn(
                  'relative flex flex-col rounded-xl border p-4 text-left transition-all',
                  plan.highlighted
                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600 dark:bg-indigo-950/30'
                    : selected
                      ? 'border-indigo-600 bg-white dark:bg-slate-900'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600',
                )}
              >
                {plan.badge && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    {plan.badge}
                  </span>
                )}
                <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {plan.name}
                </p>
                <p className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {plan.price}
                  {plan.period && (
                    <span className="text-sm font-normal text-slate-500">{plan.period}</span>
                  )}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{plan.description}</p>
                <ul className="mt-4 flex-1 space-y-1.5">
                  {plan.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-indigo-600" />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>
      )}
    />
  )
}
