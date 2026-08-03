'use client'

import { useState, type ReactNode } from 'react'
import { useDrag } from '@use-gesture/react'
import { cn } from '@/lib/utils'

export interface MobileTabSwipeProps {
  tabs: { id: string; label: string; content: ReactNode }[]
  activeIndex?: number
  onTabChange?: (index: number) => void
  className?: string
}

/** Swipe left/right on mobile to navigate between tab panels. */
export function MobileTabSwipe({
  tabs,
  activeIndex: controlledIndex,
  onTabChange,
  className,
}: MobileTabSwipeProps) {
  const [internalIndex, setInternalIndex] = useState(0)
  const activeIndex = controlledIndex ?? internalIndex

  const setIndex = (next: number) => {
    const clamped = Math.max(0, Math.min(tabs.length - 1, next))
    if (controlledIndex === undefined) setInternalIndex(clamped)
    onTabChange?.(clamped)
  }

  const bind = useDrag(({ movement: [mx], velocity: [vx], direction: [dx], cancel }) => {
    if (Math.abs(mx) < 40 && Math.abs(vx) < 0.4) return

    if (dx < 0 && activeIndex < tabs.length - 1) {
      setIndex(activeIndex + 1)
      cancel?.()
    } else if (dx > 0 && activeIndex > 0) {
      setIndex(activeIndex - 1)
      cancel?.()
    }
  }, { axis: 'x', filterTaps: true })

  return (
    <div className={cn('flex flex-col', className)}>
      <div
        role="tablist"
        aria-label="Sections"
        className="flex gap-1 overflow-x-auto border-b border-slate-100 px-1 dark:border-slate-800"
      >
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={i === activeIndex}
            onClick={() => setIndex(i)}
            className={cn(
              'shrink-0 px-3 py-2 text-xs font-medium transition-colors',
              i === activeIndex
                ? 'border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div {...bind()} className="touch-pan-y py-4">
        {tabs[activeIndex]?.content}
      </div>
    </div>
  )
}
