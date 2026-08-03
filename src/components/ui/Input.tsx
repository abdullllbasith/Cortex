'use client'

import { forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string
  helperText?: string
  error?: string
  /** Icon or text placed before the input */
  prefix?: React.ReactNode
  /** Icon or text placed after the input */
  suffix?: React.ReactNode
  /** Show character count when maxLength is set */
  showCount?: boolean
  /** Show error text below the input (disable when FormField renders errors) */
  showErrorMessage?: boolean
  /** Wrapper className */
  wrapperClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      prefix,
      suffix,
      showCount = false,
      showErrorMessage = true,
      maxLength,
      wrapperClassName,
      className,
      id: idProp,
      value,
      defaultValue,
      disabled,
      required,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId()
    const id = idProp ?? generatedId
    const helperId = `${id}-helper`
    const errorId = `${id}-error`
    const hasError = Boolean(error)
    const charCount =
      typeof value === 'string' ? value.length
      : typeof value === 'number' ? String(value).length
      : 0

    return (
      <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
        {label && (
          <label
            htmlFor={id}
            className={cn(
              'text-sm font-medium leading-none',
              disabled ? 'text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300',
            )}
          >
            {label}
            {required && (
              <span aria-hidden="true" className="ml-1 text-red-500">*</span>
            )}
          </label>
        )}

        <div className="relative flex items-center">
          {prefix && (
            <div className="pointer-events-none absolute left-3 flex items-center text-slate-400">
              {prefix}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            disabled={disabled}
            required={required}
            maxLength={maxLength}
            value={value}
            defaultValue={defaultValue}
            aria-invalid={hasError}
            aria-describedby={
              hasError ? errorId : helperText ? helperId : undefined
            }
            className={cn(
              'h-10 w-full rounded-md border bg-white text-base text-slate-900 outline-none md:h-9 md:text-sm',
              'placeholder:text-slate-400',
              'transition-colors duration-150',
              'focus:border-[#5BA8A0] focus:ring-2 focus:ring-[#5BA8A0]/20',
              'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
              'dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:border-slate-700',
              'dark:disabled:bg-slate-800 dark:disabled:text-slate-600',
              hasError
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : 'border-slate-200 dark:border-slate-700',
              prefix ? 'pl-9' : 'pl-3',
              suffix || (showCount && maxLength) ? 'pr-10' : 'pr-3',
              className,
            )}
            {...props}
          />

          {suffix && (
            <div className="pointer-events-none absolute right-3 flex items-center text-slate-400">
              {suffix}
            </div>
          )}
        </div>

        <div className="flex items-start justify-between gap-2">
          {(hasError && showErrorMessage) || helperText || (showCount && maxLength != null) ? (
            <>
              <div className="flex-1">
                {hasError && showErrorMessage ? (
                  <p id={errorId} role="alert" className="text-xs text-red-600 dark:text-red-400">
                    {error}
                  </p>
                ) : helperText ? (
                  <p id={helperId} className="text-xs text-slate-500 dark:text-slate-400">
                    {helperText}
                  </p>
                ) : null}
              </div>

              {showCount && maxLength != null && (
                <p
                  aria-live="polite"
                  className={cn(
                    'shrink-0 text-xs tabular-nums',
                    charCount >= maxLength
                      ? 'text-red-500'
                      : charCount >= maxLength * 0.9
                        ? 'text-amber-500'
                        : 'text-slate-400',
                  )}
                >
                  {charCount}/{maxLength}
                </p>
              )}
            </>
          ) : null}
        </div>
      </div>
    )
  },
)

Input.displayName = 'Input'
