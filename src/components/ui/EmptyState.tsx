'use client'

import { cn } from '@/lib/utils'
import { Button, type ButtonProps } from './Button'

export interface EmptyStateAction
  extends Omit<ButtonProps, 'children'> {
  label: string
}

export interface EmptyStateProps {
  /** Illustration or icon node */
  icon?: React.ReactNode
  title: string
  description?: string
  /** Primary CTA */
  action?: EmptyStateAction
  /** Secondary CTA */
  secondaryAction?: EmptyStateAction
  /** Layout orientation */
  orientation?: 'vertical' | 'horizontal'
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  orientation = 'vertical',
  className,
}: EmptyStateProps) {
  const isVertical = orientation === 'vertical'

  return (
    <div
      role="status"
      aria-label={title}
      className={cn(
        'flex items-center gap-4 rounded-xl border border-dashed',
        'border-slate-200 dark:border-slate-700',
        'bg-slate-50/50 dark:bg-slate-900/30',
        isVertical
          ? 'flex-col justify-center py-16 px-8 text-center'
          : 'flex-row justify-start p-6',
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full',
            'bg-slate-100 dark:bg-slate-800',
            isVertical ? 'h-14 w-14' : 'h-12 w-12',
          )}
        >
          <span className="text-slate-400 dark:text-slate-500 [&>svg]:h-6 [&>svg]:w-6">
            {icon}
          </span>
        </div>
      )}

      <div className={cn('flex flex-col gap-1', isVertical ? 'items-center' : 'items-start')}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
        {description && (
          <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}

        {(action || secondaryAction) && (
          <div className={cn('flex flex-wrap gap-2', isVertical ? 'mt-4 justify-center' : 'mt-3')}>
            {action && (
              <Button size="sm" {...action}>
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button size="sm" variant="secondary" {...secondaryAction}>
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
