'use client'

import { useId } from 'react'
import { useFormContext, get } from 'react-hook-form'
import { cn } from '@/lib/utils'

export interface FormFieldProps {
  /** Field name — used to read error from form context */
  name?: string
  label?: string
  helperText?: string
  /** Explicit error overrides context error */
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
  /** Hide the label visually but keep it for screen readers */
  srOnlyLabel?: boolean
}

export function FormField({
  name,
  label,
  helperText,
  error: errorProp,
  required,
  children,
  className,
  srOnlyLabel = false,
}: FormFieldProps) {
  const generatedId = useId()
  const formContext = useFormContext()
  const contextError =
    name && formContext?.formState.errors
      ? (get(formContext.formState.errors, name)?.message as string | undefined)
      : undefined
  const error = errorProp ?? contextError
  const errorId = `${generatedId}-error`
  const helperId = `${generatedId}-helper`

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label
          htmlFor={generatedId}
          className={cn(
            'text-sm font-medium leading-none text-slate-700 dark:text-slate-300',
            srOnlyLabel && 'sr-only',
          )}
        >
          {label}
          {required && (
            <span aria-hidden="true" className="ml-1 text-red-500">*</span>
          )}
        </label>
      )}

      <div
        aria-describedby={
          error ? errorId : helperText ? helperId : undefined
        }
        aria-invalid={Boolean(error)}
      >
        {children}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs text-slate-500 dark:text-slate-400">
          {helperText}
        </p>
      ) : null}
    </div>
  )
}
