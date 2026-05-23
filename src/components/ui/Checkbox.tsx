'use client'

import { forwardRef, useId } from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: string
  description?: string
  error?: string
  /** Show indeterminate state */
  indeterminate?: boolean
}

export const Checkbox = forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ label, description, error, indeterminate, className, id: idProp, disabled, ...props }, ref) => {
  const generatedId = useId()
  const id = idProp ?? generatedId
  const descId = description ? `${id}-desc` : undefined
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className="flex gap-3">
      <CheckboxPrimitive.Root
        ref={ref}
        id={id}
        disabled={disabled}
        aria-describedby={errorId ?? descId}
        checked={indeterminate ? 'indeterminate' : props.checked}
        className={cn(
          'peer h-4 w-4 shrink-0 rounded border transition-colors',
          'focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600',
          'data-[state=indeterminate]:bg-indigo-600 data-[state=indeterminate]:border-indigo-600',
          'dark:data-[state=checked]:bg-indigo-500 dark:data-[state=checked]:border-indigo-500',
          'dark:data-[state=indeterminate]:bg-indigo-500 dark:data-[state=indeterminate]:border-indigo-500',
          error
            ? 'border-red-500 dark:border-red-400'
            : 'border-slate-300 dark:border-slate-600',
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
          {indeterminate ? (
            <Minus className="h-3 w-3 stroke-[3]" aria-hidden="true" />
          ) : (
            <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
          )}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>

      {(label || description || error) && (
        <div className="flex flex-col gap-0.5 leading-none">
          {label && (
            <label
              htmlFor={id}
              className={cn(
                'text-sm font-medium cursor-pointer select-none',
                disabled
                  ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                  : 'text-slate-700 dark:text-slate-300',
              )}
            >
              {label}
            </label>
          )}
          {description && (
            <p id={descId} className="text-xs text-slate-500 dark:text-slate-400">
              {description}
            </p>
          )}
          {error && (
            <p id={errorId} role="alert" className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
})

Checkbox.displayName = 'Checkbox'
