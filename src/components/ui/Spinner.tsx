'use client'

import { cn } from '@/lib/utils'

export type SpinnerSize = 'sm' | 'md' | 'lg'
export type SpinnerVariant = 'brand' | 'white' | 'muted' | 'success' | 'danger'

export interface SpinnerProps {
  size?: SpinnerSize
  variant?: SpinnerVariant
  className?: string
  /** Accessible label read by screen readers */
  label?: string
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4',   // 16 px
  md: 'w-6 h-6',   // 24 px
  lg: 'w-10 h-10', // 40 px
}

const variantClasses: Record<SpinnerVariant, string> = {
  brand:   'text-indigo-600',
  white:   'text-white',
  muted:   'text-slate-400',
  success: 'text-green-600',
  danger:  'text-red-600',
}

export function Spinner({
  size = 'md',
  variant = 'brand',
  className,
  label = 'Loading…',
}: SpinnerProps) {
  return (
    <svg
      role="status"
      aria-label={label}
      className={cn('animate-spin shrink-0', sizeClasses[size], variantClasses[variant], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
