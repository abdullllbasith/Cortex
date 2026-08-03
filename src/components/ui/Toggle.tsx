'use client'

import { forwardRef, useId } from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

export type ToggleSize = 'sm' | 'md' | 'lg'

export interface ToggleProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  label?: string
  description?: string
  size?: ToggleSize
}

const trackSizes: Record<ToggleSize, string> = {
  sm: 'h-4 w-7',
  md: 'h-5 w-9',
  lg: 'h-6 w-11',
}

/** Full class strings so Tailwind JIT can detect checked translations. */
const thumbSizes: Record<ToggleSize, string> = {
  sm: 'h-3 w-3 translate-x-0.5 data-[state=checked]:translate-x-3.5',
  md: 'h-4 w-4 translate-x-0.5 data-[state=checked]:translate-x-4.5',
  lg: 'h-5 w-5 translate-x-0.5 data-[state=checked]:translate-x-5.5',
}

export const Toggle = forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  ToggleProps
>(({ label, description, size = 'md', className, id: idProp, disabled, ...props }, ref) => {
  const generatedId = useId()
  const id = idProp ?? generatedId
  const descId = description ? `${id}-desc` : undefined

  return (
    <div className="flex items-start gap-3">
      <SwitchPrimitive.Root
        ref={ref}
        id={id}
        disabled={disabled}
        aria-describedby={descId}
        className={cn(
          'relative inline-flex shrink-0 cursor-pointer items-center rounded-full',
          'border-2 border-transparent transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
          'dark:focus-visible:ring-offset-slate-900',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'bg-slate-200 dark:bg-slate-700',
          'data-[state=checked]:bg-indigo-600 dark:data-[state=checked]:bg-indigo-500',
          trackSizes[size],
          className,
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            'pointer-events-none block rounded-full bg-white shadow-sm',
            'ring-0 transition-transform duration-200 will-change-transform',
            thumbSizes[size],
          )}
        />
      </SwitchPrimitive.Root>

      {(label || description) && (
        <div className="flex flex-col gap-0.5 leading-none pt-px">
          {label && (
            <label
              htmlFor={id}
              className={cn(
                'text-sm font-medium select-none',
                disabled
                  ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                  : 'text-slate-700 dark:text-slate-300 cursor-pointer',
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
        </div>
      )}
    </div>
  )
})

Toggle.displayName = 'Toggle'
