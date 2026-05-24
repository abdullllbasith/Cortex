'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)] focus-visible:ring-offset-2 ' +
  'disabled:pointer-events-none disabled:opacity-50 shrink-0 whitespace-nowrap'

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-brand)] text-white shadow-sm ' +
    'hover:bg-[var(--color-brand-hover)] active:bg-[var(--color-brand-active)]',
  secondary:
    'bg-white text-slate-700 border border-slate-200 shadow-sm ' +
    'hover:bg-slate-50 active:bg-slate-100 ' +
    'dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 dark:active:bg-slate-600',
  ghost:
    'text-slate-700 hover:bg-slate-100 active:bg-slate-200 ' +
    'dark:text-slate-300 dark:hover:bg-slate-800 dark:active:bg-slate-700',
  danger:
    'bg-red-600 text-white shadow-sm ' +
    'hover:bg-red-500 active:bg-red-700 ' +
    'focus-visible:ring-red-500 ' +
    'dark:bg-red-500 dark:hover:bg-red-400 dark:active:bg-red-600',
  outline:
    'border border-[var(--color-brand)] text-[var(--color-brand)] ' +
    'hover:bg-[var(--color-brand-subtle)] active:bg-[var(--color-brand-muted)]',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-5 text-base',
}

const spinnerSizeMap: Record<ButtonSize, 'sm' | 'sm' | 'md'> = {
  sm: 'sm',
  md: 'sm',
  lg: 'md',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      className,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading}
        className={cn(base, variantClasses[variant], sizeClasses[size], className)}
        {...props}
      >
        {loading ? (
          <Spinner
            size={spinnerSizeMap[size]}
            variant={variant === 'primary' || variant === 'danger' ? 'white' : 'brand'}
          />
        ) : (
          leftIcon && <span aria-hidden="true" className="shrink-0">{leftIcon}</span>
        )}
        {children}
        {!loading && rightIcon && (
          <span aria-hidden="true" className="shrink-0">{rightIcon}</span>
        )}
      </button>
    )
  },
)

Button.displayName = 'Button'
