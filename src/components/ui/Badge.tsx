'use client'

import { cn } from '@/lib/utils'

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline'

export type BadgeSize = 'sm' | 'md'

export interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  children: React.ReactNode
  className?: string
  /** Show a leading status dot */
  dot?: boolean
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  success: 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
  danger:  'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
  info:    'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
  outline: 'bg-transparent border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-400',
}

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-slate-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
  info:    'bg-blue-500',
  outline: 'bg-slate-400',
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-xs gap-1',
  md: 'px-2 py-0.5 text-xs gap-1.5',
}

export function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn('shrink-0 rounded-full', dotColors[variant], size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')}
        />
      )}
      {children}
    </span>
  )
}
