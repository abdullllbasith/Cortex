'use client'

import { useState } from 'react'
import { useDrag } from '@use-gesture/react'
import { Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SwipeableRowProps {
  children: React.ReactNode
  onEdit?: () => void
  onDelete?: () => void
  className?: string
}

const ACTION_WIDTH = 120

/** Swipe-left on mobile to reveal edit / delete action buttons. */
export function SwipeableRow({
  children,
  onEdit,
  onDelete,
  className,
}: SwipeableRowProps) {
  const [offset, setOffset] = useState(0)

  const bind = useDrag(({ movement: [mx], down }) => {
    if (!onEdit && !onDelete) return

    if (down) {
      const base = offset < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0
      setOffset(Math.min(0, Math.max(-ACTION_WIDTH, mx + base)))
    } else {
      setOffset(offset < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0)
    }
  })

  return (
    <div className={cn('relative overflow-hidden rounded-lg', className)}>
      {(onEdit || onDelete) && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 flex w-[120px] items-stretch"
        >
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit"
              className="flex flex-1 items-center justify-center bg-indigo-600 text-white"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete"
              className="flex flex-1 items-center justify-center bg-red-600 text-white"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <div
        {...bind()}
        className="relative touch-pan-y bg-white transition-transform dark:bg-slate-900"
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>
    </div>
  )
}
