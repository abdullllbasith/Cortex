'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { getSaiosLogoSrc, type LogoSurface } from '@/lib/branding/logoAssets'
import { useResolvedLogoSurface } from './useResolvedLogoSurface'

const HEIGHT = {
  xs: 18,
  sm: 24,
  md: 32,
  lg: 40,
  xl: 48,
} as const

export type SaiosLogoSize = keyof typeof HEIGHT | number

export interface SaiosLogoProps {
  /** Background the logo sits on. `auto` follows app dark/light theme. */
  surface?: LogoSurface
  size?: SaiosLogoSize
  className?: string
  priority?: boolean
}

export function SaiosLogo({
  surface = 'auto',
  size = 'md',
  className,
  priority,
}: SaiosLogoProps) {
  const height = typeof size === 'number' ? size : HEIGHT[size]
  const resolvedSurface = useResolvedLogoSurface(surface)
  const src = getSaiosLogoSrc(resolvedSurface)

  return (
    <Image
      src={src}
      alt="CORTEX"
      width={Math.round(height * 4)}
      height={height}
      priority={priority}
      unoptimized
      className={cn('w-auto object-contain object-left', className)}
      style={{ height, width: 'auto' }}
    />
  )
}
