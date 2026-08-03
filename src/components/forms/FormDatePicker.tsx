'use client'

import { useState } from 'react'
import { Controller, useFormContext, type FieldPath, type FieldValues } from 'react-hook-form'
import { DayPicker } from 'react-day-picker'
import { format, parseISO, isValid } from 'date-fns'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FormField } from './FormField'
import 'react-day-picker/style.css'

export interface FormDatePickerProps<T extends FieldValues> {
  name: FieldPath<T>
  label?: string
  helperText?: string
  required?: boolean
  placeholder?: string
  disabled?: boolean
  /** Minimum selectable date */
  fromDate?: Date
  /** Maximum selectable date */
  toDate?: Date
}

export function FormDatePicker<T extends FieldValues>({
  name,
  label,
  helperText,
  required,
  placeholder = 'Pick a date',
  disabled,
  fromDate,
  toDate,
}: FormDatePickerProps<T>) {
  const { control } = useFormContext<T>()
  const [open, setOpen] = useState(false)

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const raw = field.value as string | Date | null | undefined
        const dateValue =
          typeof raw === 'string' && raw
            ? parseISO(raw)
            : raw instanceof Date
              ? raw
              : undefined
        const valid = dateValue && isValid(dateValue)

        return (
          <FormField
            name={name}
            label={label}
            helperText={helperText}
            required={required}
            error={fieldState.error?.message}
          >
            <div className="relative">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((o) => !o)}
                className={cn(
                  'flex h-9 w-full items-center gap-2 rounded-md border px-3 text-sm',
                  'bg-white text-slate-900 transition-colors outline-none',
                  'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  'dark:bg-slate-900 dark:text-slate-100',
                  fieldState.error
                    ? 'border-red-500'
                    : 'border-slate-200 dark:border-slate-700',
                  !valid && 'text-slate-400',
                )}
              >
                <Calendar className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                {valid ? format(dateValue, 'MMM d, yyyy') : placeholder}
              </button>

              {open && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    aria-hidden="true"
                    onClick={() => setOpen(false)}
                  />
                  <div
                    className={cn(
                      'absolute left-0 top-full z-50 mt-1 rounded-xl border p-3 shadow-lg',
                      'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
                      'animate-scaleIn',
                    )}
                  >
                    <DayPicker
                      mode="single"
                      selected={valid ? dateValue : undefined}
                      onSelect={(d) => {
                        field.onChange(d ? format(d, 'yyyy-MM-dd') : '')
                        setOpen(false)
                      }}
                      disabled={[
                        ...(fromDate ? [{ before: fromDate }] : []),
                        ...(toDate ? [{ after: toDate }] : []),
                      ]}
                      classNames={{
                        today: 'font-bold text-indigo-600',
                        selected: 'bg-indigo-600 text-white rounded-md',
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </FormField>
        )
      }}
    />
  )
}
