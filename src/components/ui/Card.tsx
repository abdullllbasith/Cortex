'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

/* ── Types ──────────────────────────────────────────────────────────────── */

export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds hover lift + cursor-pointer style */
  interactive?: boolean
  /** Remove default border */
  borderless?: boolean
  /** Inner padding preset */
  padding?: CardPadding
}

/* ── Padding map ────────────────────────────────────────────────────────── */

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-6',
}

/* ── Card ───────────────────────────────────────────────────────────────── */

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, borderless = false, padding = 'none', children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl bg-white',
        'dark:bg-slate-900',
        !borderless && 'border border-slate-100 dark:border-slate-800',
        interactive && [
          'cursor-pointer transition-shadow duration-150',
          'hover:shadow-md hover:-translate-y-px',
          'active:shadow-sm active:translate-y-0',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
        ],
        paddingClasses[padding],
        className,
      )}
      {...(interactive ? { role: 'button', tabIndex: 0 } : {})}
      {...props}
    >
      {children}
    </div>
  ),
)
Card.displayName = 'Card'

/* ── Card.Header ────────────────────────────────────────────────────────── */

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-between gap-4',
        'px-4 py-3 border-b border-slate-100 dark:border-slate-800',
        className,
      )}
      {...props}
    />
  ),
)
CardHeader.displayName = 'CardHeader'

/* ── Card.Title ─────────────────────────────────────────────────────────── */

export const CardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-sm font-semibold text-slate-900 dark:text-slate-100', className)}
      {...props}
    />
  ),
)
CardTitle.displayName = 'CardTitle'

/* ── Card.Description ───────────────────────────────────────────────────── */

export const CardDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-xs text-slate-500 dark:text-slate-400', className)}
      {...props}
    />
  ),
)
CardDescription.displayName = 'CardDescription'

/* ── Card.Body ──────────────────────────────────────────────────────────── */

export const CardBody = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-4', className)} {...props} />
  ),
)
CardBody.displayName = 'CardBody'

/* ── Card.Footer ────────────────────────────────────────────────────────── */

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-between gap-2',
        'px-4 py-3 border-t border-slate-100 dark:border-slate-800',
        className,
      )}
      {...props}
    />
  ),
)
CardFooter.displayName = 'CardFooter'
