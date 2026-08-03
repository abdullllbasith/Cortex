'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useTenantBranding } from './TenantBrandingProvider'
import { SaiosLogo } from './SaiosLogo'
import type { LogoSurface } from '@/lib/branding/logoAssets'

export interface TenantLogoMarkProps {
  collapsed?: boolean
  /** Show product title + workspace name (sidebar style) */
  showLabels?: boolean
  /** Light text for dark sidebar backgrounds */
  variant?: 'dark' | 'light'
  className?: string
}

function surfaceFromVariant(variant: 'dark' | 'light'): LogoSurface {
  return variant === 'light' ? 'light' : 'dark'
}

export function TenantLogoMark({
  collapsed = false,
  showLabels = true,
  variant = 'dark',
  className,
}: TenantLogoMarkProps) {
  const branding = useTenantBranding()
  const workspaceName = branding.name?.trim() || 'Workspace'
  const surface = surfaceFromVariant(variant)
  const isLight = variant === 'light'

  return (
    <div
      className={cn(
        'flex items-center',
        collapsed ? 'justify-center' : 'gap-2.5',
        className,
      )}
    >
      {branding.logoUrl ? (
        <Image
          src={branding.logoUrl}
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 shrink-0 rounded-lg object-cover"
          unoptimized
        />
      ) : (
        <SaiosLogo
          surface={surface}
          size={collapsed ? 'xs' : 'sm'}
          className={cn(collapsed && 'max-w-[52px] object-left')}
        />
      )}

      {showLabels && !collapsed && (
        <div className="flex min-w-0 flex-col leading-none overflow-hidden">
          <span
            className={cn(
              'truncate font-display text-sm font-semibold tracking-tight',
              isLight
                ? 'text-slate-900 dark:text-slate-100'
                : 'text-white',
            )}
          >
            {workspaceName}
          </span>
          {!branding.logoUrl && (
            <span
              className={cn(
                'truncate text-[10px] tracking-wide',
                isLight ? 'text-slate-500 dark:text-slate-400' : 'text-slate-500',
              )}
            >
              Cortex
            </span>
          )}
        </div>
      )}
    </div>
  )
}
