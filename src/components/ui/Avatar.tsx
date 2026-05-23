'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn, getInitials } from '@/lib/utils'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type AvatarStatus = 'online' | 'away' | 'busy' | 'offline'

export interface AvatarProps {
  /** Image URL */
  src?: string
  /** Full name – used for initials fallback and alt text */
  name: string
  size?: AvatarSize
  status?: AvatarStatus
  className?: string
}

const sizeClasses: Record<AvatarSize, { wrapper: string; text: string; dot: string }> = {
  xs: { wrapper: 'w-6 h-6',  text: 'text-[10px]', dot: 'w-1.5 h-1.5 border' },
  sm: { wrapper: 'w-8 h-8',  text: 'text-xs',     dot: 'w-2 h-2 border' },
  md: { wrapper: 'w-10 h-10', text: 'text-sm',    dot: 'w-2.5 h-2.5 border-2' },
  lg: { wrapper: 'w-12 h-12', text: 'text-base',  dot: 'w-3 h-3 border-2' },
  xl: { wrapper: 'w-16 h-16', text: 'text-lg',    dot: 'w-3.5 h-3.5 border-2' },
}

const statusColors: Record<AvatarStatus, string> = {
  online:  'bg-green-500',
  away:    'bg-amber-400',
  busy:    'bg-red-500',
  offline: 'bg-slate-400 dark:bg-slate-600',
}

/** Deterministic bg color from name (avoids random flicker on re-render) */
function getColorFromName(name: string): string {
  const colors = [
    'bg-indigo-500',
    'bg-violet-500',
    'bg-blue-500',
    'bg-cyan-600',
    'bg-teal-600',
    'bg-emerald-600',
    'bg-rose-500',
    'bg-pink-500',
    'bg-orange-500',
    'bg-amber-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export function Avatar({ src, name, size = 'md', status, className }: AvatarProps) {
  const [imgError, setImgError] = useState(false)
  const { wrapper, text, dot } = sizeClasses[size]
  const showImage = Boolean(src) && !imgError

  return (
    <span className={cn('relative inline-flex shrink-0', wrapper, className)}>
      {showImage ? (
        <Image
          src={src!}
          alt={name}
          fill
          className="rounded-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          aria-label={name}
          className={cn(
            'flex h-full w-full items-center justify-center rounded-full',
            'font-semibold text-white select-none',
            getColorFromName(name),
            text,
          )}
        >
          {getInitials(name)}
        </span>
      )}

      {status && (
        <span
          aria-label={`Status: ${status}`}
          className={cn(
            'absolute bottom-0 right-0 rounded-full',
            'border-white dark:border-slate-900',
            statusColors[status],
            dot,
          )}
        />
      )}
    </span>
  )
}
