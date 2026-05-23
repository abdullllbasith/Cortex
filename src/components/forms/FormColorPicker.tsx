'use client'

import { Controller, useFormContext, type FieldPath, type FieldValues } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { FormField } from './FormField'
import { theme } from '@/styles/theme'

/** Brand + neutral swatches for quick selection */
const SWATCHES = [
  theme.indigo[600],
  theme.indigo[500],
  theme.indigo[400],
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#64748b',
  '#0f172a',
  '#ffffff',
  '#000000',
] as const

export interface FormColorPickerProps<T extends FieldValues> {
  name: FieldPath<T>
  label?: string
  helperText?: string
  required?: boolean
  disabled?: boolean
  /** Additional custom swatches */
  swatches?: string[]
}

const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/

export function FormColorPicker<T extends FieldValues>({
  name,
  label,
  helperText,
  required,
  disabled,
  swatches = [],
}: FormColorPickerProps<T>) {
  const { control } = useFormContext<T>()
  const allSwatches = [...SWATCHES, ...swatches]

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const value = (field.value as string) ?? '#4f46e5'

        return (
          <FormField
            name={name}
            label={label}
            helperText={helperText}
            required={required}
            error={fieldState.error?.message}
          >
            <div className="flex flex-col gap-3">
              {/* Preview + hex input */}
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm"
                  style={{ backgroundColor: HEX_RE.test(value) ? value : '#4f46e5' }}
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={value}
                  disabled={disabled}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '' || HEX_RE.test(v)) field.onChange(v)
                  }}
                  placeholder="#4f46e5"
                  maxLength={7}
                  className={cn(
                    'h-9 flex-1 rounded-md border px-3 font-mono text-sm uppercase',
                    'bg-white text-slate-900 outline-none',
                    'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
                    'disabled:opacity-50 dark:bg-slate-900 dark:text-slate-100',
                    fieldState.error
                      ? 'border-red-500'
                      : 'border-slate-200 dark:border-slate-700',
                  )}
                />
                <input
                  type="color"
                  value={HEX_RE.test(value) ? value : '#4f46e5'}
                  disabled={disabled}
                  onChange={(e) => field.onChange(e.target.value)}
                  aria-label="Pick color"
                  className="h-9 w-9 cursor-pointer rounded border border-slate-200 dark:border-slate-700 bg-transparent p-0.5"
                />
              </div>

              {/* Swatch grid */}
              <div className="flex flex-wrap gap-2">
                {allSwatches.map((color) => (
                  <button
                    key={color}
                    type="button"
                    disabled={disabled}
                    aria-label={`Select color ${color}`}
                    aria-pressed={value.toLowerCase() === color.toLowerCase()}
                    onClick={() => field.onChange(color)}
                    className={cn(
                      'h-7 w-7 rounded-md border-2 transition-transform hover:scale-110',
                      value.toLowerCase() === color.toLowerCase()
                        ? 'border-indigo-600 ring-2 ring-indigo-500/30'
                        : 'border-transparent',
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </FormField>
        )
      }}
    />
  )
}
