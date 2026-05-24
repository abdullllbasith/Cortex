'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface TenantAction {
  label: string
  onClick: () => void
  variant?: 'default' | 'danger'
  disabled?: boolean
}

export function TenantActionsMenu({ actions }: { actions: TenantAction[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <Button
        size="sm"
        variant="secondary"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        aria-label="Actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              disabled={a.disabled}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                a.onClick()
              }}
              className={cn(
                'block w-full px-3 py-2 text-left text-sm disabled:opacity-50',
                a.variant === 'danger'
                  ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
                  : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
