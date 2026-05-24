'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ResizableSidebarProps {
  children: ReactNode
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  className?: string
  /** Persist width in localStorage when set */
  storageKey?: string
}

function readStoredWidth(
  storageKey: string,
  defaultWidth: number,
  minWidth: number,
  maxWidth: number,
): number {
  if (typeof window === 'undefined') return defaultWidth
  const saved = localStorage.getItem(storageKey)
  if (!saved) return defaultWidth
  const parsed = parseInt(saved, 10)
  if (Number.isNaN(parsed)) return defaultWidth
  return Math.min(maxWidth, Math.max(minWidth, parsed))
}

export function ResizableSidebar({
  children,
  defaultWidth = 320,
  minWidth = 220,
  maxWidth = 640,
  className,
  storageKey,
}: ResizableSidebarProps) {
  const [width, setWidth] = useState(() =>
    storageKey ? readStoredWidth(storageKey, defaultWidth, minWidth, maxWidth) : defaultWidth,
  )
  const widthRef = useRef(width)
  widthRef.current = width

  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, String(width))
  }, [width, storageKey])

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = widthRef.current

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const onMouseMove = (ev: MouseEvent) => {
        const delta = startX - ev.clientX
        const next = Math.min(maxWidth, Math.max(minWidth, startWidth + delta))
        setWidth(next)
      }

      const onMouseUp = () => {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [minWidth, maxWidth],
  )

  return (
    <aside
      className={cn('relative shrink-0 border-l border-slate-200 dark:border-slate-700 min-h-0', className)}
      style={{ width }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        title="Drag to resize"
        onMouseDown={onResizeStart}
        className="absolute left-0 top-0 z-10 h-full w-2 -translate-x-1/2 cursor-col-resize group"
      >
        <div className="mx-auto h-full w-0.5 bg-transparent transition-colors group-hover:bg-indigo-400/60 group-active:bg-indigo-500" />
      </div>
      {children}
    </aside>
  )
}
