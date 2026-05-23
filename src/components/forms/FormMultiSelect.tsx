'use client'

import { useState } from 'react'
import { Controller, useFormContext, type FieldPath, type FieldValues } from 'react-hook-form'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FormField } from './FormField'

export interface MultiSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface FormMultiSelectProps<T extends FieldValues> {
  name: FieldPath<T>
  options: MultiSelectOption[]
  label?: string
  helperText?: string
  required?: boolean
  placeholder?: string
  disabled?: boolean
  max?: number
}

export function FormMultiSelect<T extends FieldValues>({
  name,
  options,
  label,
  helperText,
  required,
  placeholder = 'Select options…',
  disabled,
  max,
}: FormMultiSelectProps<T>) {
  const { control } = useFormContext<T>()
  const [search, setSearch] = useState('')

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const selected: string[] = Array.isArray(field.value) ? field.value : []

        const filtered = options.filter((o) =>
          o.label.toLowerCase().includes(search.toLowerCase()),
        )

        const toggle = (value: string) => {
          if (selected.includes(value)) {
            field.onChange(selected.filter((v) => v !== value))
          } else if (!max || selected.length < max) {
            field.onChange([...selected, value])
          }
        }

        const remove = (value: string) =>
          field.onChange(selected.filter((v) => v !== value))

        return (
          <FormField
            name={name}
            label={label}
            helperText={helperText}
            required={required}
            error={fieldState.error?.message}
          >
            <Popover.Root>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm',
                    'bg-white text-left transition-colors outline-none',
                    'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    'dark:bg-slate-900 dark:text-slate-100',
                    fieldState.error
                      ? 'border-red-500'
                      : 'border-slate-200 dark:border-slate-700',
                  )}
                >
                  {selected.length === 0 ? (
                    <span className="text-slate-400 px-0.5">{placeholder}</span>
                  ) : (
                    selected.map((val) => {
                      const opt = options.find((o) => o.value === val)
                      return (
                        <span
                          key={val}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                            'bg-indigo-50 text-indigo-700 border border-indigo-200',
                            'dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
                          )}
                        >
                          {opt?.label ?? val}
                          <button
                            type="button"
                            aria-label={`Remove ${opt?.label ?? val}`}
                            onClick={(e) => { e.stopPropagation(); remove(val) }}
                            className="rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )
                    })
                  )}
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                </button>
              </Popover.Trigger>

              <Popover.Portal>
                <Popover.Content
                  align="start"
                  sideOffset={4}
                  className={cn(
                    'z-50 w-[var(--radix-popover-trigger-width)] rounded-xl border p-2 shadow-lg',
                    'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
                    'animate-scaleIn',
                  )}
                >
                  <div className="relative mb-2">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className={cn(
                        'h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs outline-none',
                        'focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
                      )}
                    />
                  </div>

                  <ul role="listbox" className="max-h-48 overflow-y-auto space-y-0.5">
                    {filtered.map((opt) => {
                      const isSelected = selected.includes(opt.value)
                      return (
                        <li key={opt.value}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            disabled={opt.disabled || (!isSelected && max !== undefined && selected.length >= max)}
                            onClick={() => toggle(opt.value)}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                              'hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors',
                              'disabled:opacity-40 disabled:cursor-not-allowed',
                              isSelected && 'bg-indigo-50 dark:bg-indigo-950/30',
                            )}
                          >
                            <span className={cn(
                              'flex h-4 w-4 items-center justify-center rounded border',
                              isSelected
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-slate-300 dark:border-slate-600',
                            )}>
                              {isSelected && <Check className="h-3 w-3" aria-hidden="true" />}
                            </span>
                            {opt.label}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </FormField>
        )
      }}
    />
  )
}
