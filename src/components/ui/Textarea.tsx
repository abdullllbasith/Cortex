'use client'

import { forwardRef, useCallback, useEffect, useId, useRef } from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  helperText?: string
  error?: string
  /** Auto-grow to fit content */
  autoResize?: boolean
  /** Show character count when maxLength is set */
  showCount?: boolean
  /** Show error text below the textarea (disable when FormField renders errors) */
  showErrorMessage?: boolean
  /** Wrapper className */
  wrapperClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      helperText,
      error,
      autoResize = false,
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
      onChange,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId()
    const id = idProp ?? generatedId
    const helperId = `${id}-helper`
    const errorId = `${id}-error`
    const hasError = Boolean(error)
    const innerRef = useRef<HTMLTextAreaElement>(null)

    const charCount =
      typeof value === 'string' ? value.length : 0

    const resize = useCallback((el: HTMLTextAreaElement) => {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }, [])

    useEffect(() => {
      if (autoResize && innerRef.current) {
        resize(innerRef.current)
      }
    }, [autoResize, value, resize])

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (autoResize) resize(e.currentTarget)
      onChange?.(e)
    }

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

        <textarea
          ref={(node) => {
            (innerRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
          }}
          id={id}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          value={value}
          defaultValue={defaultValue}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
          onChange={handleChange}
          className={cn(
            'min-h-[80px] w-full rounded-md border bg-white px-3 py-2',
            'text-sm text-slate-900 placeholder:text-slate-400',
            'outline-none transition-colors duration-150',
            'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
            'dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500',
            'dark:disabled:bg-slate-800 dark:disabled:text-slate-600',
            autoResize ? 'resize-none overflow-hidden' : 'resize-y',
            hasError
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
              : 'border-slate-200 dark:border-slate-700',
            className,
          )}
          {...props}
        />

        <div className="flex items-start justify-between gap-2">
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
        </div>
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'
