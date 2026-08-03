'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { getSoftoraLogoSrc, type LogoSurface } from '@/lib/branding/logoAssets'
import { useResolvedLogoSurface } from './useResolvedLogoSurface'

const HEIGHT = {
  xs: 16,
  sm: 20,
  md: 28,
  lg: 36,
} as const

export type SoftoraLogoSize = keyof typeof HEIGHT | number

export interface SoftoraLogoProps {
  surface?: LogoSurface
  size?: SoftoraLogoSize
  className?: string
  priority?: boolean
}

export function SoftoraLogo({
  surface = 'auto',
  size = 'md',
  className,
  priority,
}: SoftoraLogoProps) {
  const height = typeof size === 'number' ? size : HEIGHT[size]
  const resolvedSurface = useResolvedLogoSurface(surface)
  const src = getSoftoraLogoSrc(resolvedSurface)

  return (
    <Image
      src={src}
      alt="Softora"
      width={Math.round(height * 4.5)}
      height={height}
      priority={priority}
      unoptimized
      className={cn('w-auto object-contain object-left', className)}
      style={{ height, width: 'auto' }}
    />
  )
}
