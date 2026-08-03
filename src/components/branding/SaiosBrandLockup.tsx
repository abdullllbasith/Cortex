'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { SaiosLogo, type SaiosLogoProps } from './SaiosLogo'
import type { LogoSurface } from '@/lib/branding/logoAssets'

export interface SaiosBrandLockupProps {
  surface?: LogoSurface
  compact?: boolean
  /** Override logo height; defaults to sm (compact) or md. */
  size?: SaiosLogoProps['size']
  href?: string
  className?: string
  priority?: boolean
}

export function SaiosBrandLockup({
  surface = 'auto',
  compact = false,
  size,
  href = '/',
  className,
  priority,
}: SaiosBrandLockupProps) {
  const logoSize: SaiosLogoProps['size'] = size ?? (compact ? 'sm' : 'md')

  const content = (
    <div className={cn('flex flex-col', className)}>
      <SaiosLogo surface={surface} size={logoSize} priority={priority} />
    </div>
  )

  if (!href) return content

  return (
    <Link href={href} style={{ textDecoration: 'none' }} className="inline-flex">
      {content}
    </Link>
  )
}
