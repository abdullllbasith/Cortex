'use client'

import { useRef, useState, type ReactNode } from 'react'
import { useDrag } from '@use-gesture/react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PullToRefreshProps {
  children: ReactNode
  onRefresh: () => Promise<void> | void
  className?: string
  disabled?: boolean
}

const THRESHOLD = 72

/** Pull-down gesture on mobile scroll containers to trigger a refresh. */
export function PullToRefresh({
  children,
  onRefresh,
  className,
  disabled = false,
}: PullToRefreshProps) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const bind = useDrag(({ movement: [, my], down, cancel }) => {
    if (disabled || refreshing) return
    const el = containerRef.current
    if (!el || el.scrollTop > 0) {
      cancel?.()
      return
    }

    if (down) {
      setPull(Math.max(0, Math.min(THRESHOLD * 1.5, my)))
    } else if (pull >= THRESHOLD) {
      setRefreshing(true)
      void Promise.resolve(onRefresh()).finally(() => {
        setRefreshing(false)
        setPull(0)
      })
    } else {
      setPull(0)
    }
  }, { axis: 'y', filterTaps: true })

  return (
    <div {...bind()} ref={containerRef} className={cn('relative overflow-y-auto', className)}>
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 flex items-end justify-center',
          'transition-opacity duration-150',
          pull > 0 || refreshing ? 'opacity-100' : 'opacity-0',
        )}
        style={{ height: refreshing ? THRESHOLD : pull }}
      >
        <RefreshCw
          className={cn(
            'mb-2 h-5 w-5 text-indigo-600 dark:text-indigo-400',
            refreshing && 'animate-spin',
          )}
        />
      </div>

      <div
        style={{
          transform: `translateY(${refreshing ? THRESHOLD : pull}px)`,
          transition: refreshing || pull === 0 ? 'transform 0.2s ease-out' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  )
}
