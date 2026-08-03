'use client'

import { cn } from '@/lib/utils'

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Layout direction */
  orientation?: 'horizontal' | 'vertical'
  /** Optional label rendered at the center of a horizontal divider */
  label?: React.ReactNode
  /** Visual weight */
  variant?: 'default' | 'strong' | 'subtle'
}

const variantClasses = {
  default: 'border-slate-200 dark:border-slate-700',
  strong:  'border-slate-300 dark:border-slate-600',
  subtle:  'border-slate-100 dark:border-slate-800',
}

export function Divider({
  orientation = 'horizontal',
  label,
  variant = 'default',
  className,
  ...props
}: DividerProps) {
  if (orientation === 'vertical') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn(
          'inline-block self-stretch w-px border-l',
          variantClasses[variant],
          className,
        )}
        {...props}
      />
    )
  }

  if (label) {
    return (
      <div
        role="separator"
        aria-orientation="horizontal"
        className={cn('flex items-center gap-3', className)}
        {...props}
      >
        <span className={cn('flex-1 border-t', variantClasses[variant])} />
        <span className="shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500 select-none">
          {label}
        </span>
        <span className={cn('flex-1 border-t', variantClasses[variant])} />
      </div>
    )
  }

  return (
    <hr
      role="separator"
      aria-orientation="horizontal"
      className={cn('border-t', variantClasses[variant], className)}
      {...props}
    />
  )
}
