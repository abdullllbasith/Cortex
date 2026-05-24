'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Breadcrumb {
  label: string
  href?: string
}

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  subtitle?: string
  breadcrumbs?: Breadcrumb[]
  /** Action buttons / controls rendered to the right */
  actions?: React.ReactNode
  /** Remove bottom border */
  borderless?: boolean
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  borderless = false,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 px-4 py-3 md:px-6 lg:px-8',
        !borderless && 'border-b border-slate-100 dark:border-slate-800',
        className,
      )}
      {...props}
    >
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-1">
          <ol className="flex items-center gap-1">
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1
              return (
                <li key={i} className="flex items-center gap-1">
                  {i > 0 && (
                    <ChevronRight
                      className="h-3 w-3 text-slate-300 dark:text-slate-600 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  {isLast || !crumb.href ? (
                    <span
                      aria-current={isLast ? 'page' : undefined}
                      className={cn(
                        'text-xs',
                        isLast
                          ? 'font-medium text-slate-700 dark:text-slate-300'
                          : 'text-slate-400 dark:text-slate-500',
                      )}
                    >
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="text-xs text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
      )}

      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h1 className="font-display text-lg font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-100 truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex shrink-0 items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
