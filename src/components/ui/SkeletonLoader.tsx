'use client'

import { cn } from '@/lib/utils'

/* ── Base Skeleton ──────────────────────────────────────────────────────── */

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width — defaults to 'w-full' */
  width?: string
  /** Height — defaults per variant */
  height?: string
}

export function Skeleton({ className, width, height, style, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('skeleton', width ?? 'w-full', className)}
      style={{ height, ...style }}
      {...props}
    />
  )
}

/* ── Text variant ─────────────────────────────────────────────────────── */

export interface SkeletonTextProps {
  /** Number of lines */
  lines?: number
  /** Shorten last line (more natural) */
  lastLineWidth?: string
  className?: string
}

export function SkeletonText({
  lines = 3,
  lastLineWidth = 'w-2/3',
  className,
}: SkeletonTextProps) {
  return (
    <div
      aria-hidden="true"
      aria-label="Loading text"
      className={cn('flex flex-col gap-2', className)}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="14px"
          className={cn('rounded', i === lines - 1 && lines > 1 ? lastLineWidth : 'w-full')}
        />
      ))}
    </div>
  )
}

/* ── Avatar variant ───────────────────────────────────────────────────── */

export interface SkeletonAvatarProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const avatarSizes = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12' }

export function SkeletonAvatar({ size = 'md', className }: SkeletonAvatarProps) {
  return (
    <Skeleton
      aria-label="Loading avatar"
      className={cn('rounded-full shrink-0', avatarSizes[size], className)}
    />
  )
}

/* ── Card variant ─────────────────────────────────────────────────────── */

export interface SkeletonCardProps {
  /** Show a top image placeholder */
  image?: boolean
  className?: string
}

export function SkeletonCard({ image = false, className }: SkeletonCardProps) {
  return (
    <div
      aria-hidden="true"
      aria-label="Loading card"
      className={cn(
        'rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden',
        className,
      )}
    >
      {image && <Skeleton height="160px" className="rounded-none" />}
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <SkeletonAvatar size="sm" />
          <div className="flex-1 flex flex-col gap-1.5">
            <Skeleton height="12px" width="w-1/2" className="rounded" />
            <Skeleton height="10px" width="w-1/3" className="rounded" />
          </div>
        </div>
        <SkeletonText lines={3} />
        <div className="flex gap-2 pt-1">
          <Skeleton height="28px" width="w-20" className="rounded-md" />
          <Skeleton height="28px" width="w-16" className="rounded-md" />
        </div>
      </div>
    </div>
  )
}

/* ── Table row variant ────────────────────────────────────────────────── */

export interface SkeletonTableRowProps {
  /** Number of columns */
  columns?: number
  className?: string
}

export function SkeletonTableRow({ columns = 4, className }: SkeletonTableRowProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('flex items-center gap-4 px-4 py-3', className)}
    >
      <SkeletonAvatar size="sm" />
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          height="12px"
          className={cn(
            'rounded flex-1',
            i === 0 ? 'max-w-[140px]' : i === columns - 1 ? 'max-w-[80px]' : '',
          )}
        />
      ))}
    </div>
  )
}

export interface SkeletonTableProps {
  rows?: number
  columns?: number
  className?: string
}

export function SkeletonTable({ rows = 5, columns = 4, className }: SkeletonTableProps) {
  return (
    <div
      aria-label="Loading table"
      aria-busy="true"
      className={cn('rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden', className)}
    >
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        {Array.from({ length: columns + 1 }).map((_, i) => (
          <Skeleton
            key={i}
            height="10px"
            className={cn('rounded', i === 0 ? 'w-8 h-8 rounded-full' : 'flex-1')}
          />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0">
          <SkeletonTableRow columns={columns} />
        </div>
      ))}
    </div>
  )
}
