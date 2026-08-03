'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FormSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  /** Enable collapsible behaviour */
  collapsible?: boolean
  /** Initial open state when collapsible */
  defaultOpen?: boolean
  className?: string
}

export function FormSection({
  title,
  description,
  children,
  collapsible = false,
  defaultOpen = true,
  className,
}: FormSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section
      className={cn(
        'rounded-xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-start justify-between gap-4 px-5 py-4',
          collapsible && 'cursor-pointer select-none',
          open && 'border-b border-slate-100 dark:border-slate-800',
        )}
        onClick={collapsible ? () => setOpen((o) => !o) : undefined}
        onKeyDown={
          collapsible
            ? (e) => e.key === 'Enter' && setOpen((o) => !o)
            : undefined
        }
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? open : undefined}
      >
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>
        {collapsible && (
          <span className="mt-0.5 text-slate-400">
            {open ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
        )}
      </div>

      {/* Body */}
      {(!collapsible || open) && (
        <div className="px-5 py-4 space-y-4 animate-fadeIn">{children}</div>
      )}
    </section>
  )
}
