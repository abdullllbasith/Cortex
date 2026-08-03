import { cn } from '@/lib/utils'

type SaiosAnimatedGradientBackdropProps = {
  /** Light = hero & auth form panel. Dark = auth branded panel. */
  variant?: 'light' | 'dark'
  /** Stronger mobile positioning + wash for marketing hero */
  hero?: boolean
  className?: string
  showGrid?: boolean
}

/**
 * Shared Cortex atmosphere — slow, elegant animated teal/navy gradient mesh
 * used on marketing hero, login, and register surfaces.
 */
export function SaiosAnimatedGradientBackdrop({
  variant = 'light',
  hero = false,
  className,
  showGrid = true,
}: SaiosAnimatedGradientBackdropProps) {
  const isLight = variant === 'light'

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        hero && 'saios-gradient-backdrop-hero',
        className,
      )}
      aria-hidden="true"
    >
      {/* Base wash */}
      <div
        className={cn(
          'absolute inset-0',
          isLight ? 'bg-[#F7FAFA] dark:bg-[#0a1520]' : 'saios-gradient-dark-base',
        )}
      />

      {/* Flowing color mesh */}
      <div
        className={cn(
          'saios-gradient-mesh absolute inset-0',
          !isLight && 'saios-gradient-mesh-dark',
        )}
      />

      {/* Soft ambient orbs */}
      <div
        className={cn(
          'saios-gradient-orb saios-gradient-orb-a',
          isLight ? 'saios-gradient-orb-a-light' : 'saios-gradient-orb-a-dark',
        )}
      />
      <div
        className={cn(
          'saios-gradient-orb saios-gradient-orb-b',
          isLight ? 'saios-gradient-orb-b-light' : 'saios-gradient-orb-b-dark',
        )}
      />
      <div
        className={cn(
          'saios-gradient-orb saios-gradient-orb-c',
          isLight ? 'saios-gradient-orb-c-light' : 'saios-gradient-orb-c-dark',
        )}
      />

      {/* Dark-mode diagonal wash (light surfaces only) */}
      {isLight && <div className="saios-gradient-dark-wash absolute inset-0" />}

      {/* Mobile hero wash — visible animated gradient on small screens in light mode */}
      {isLight && hero && <div className="saios-gradient-hero-mobile-wash absolute inset-0 md:hidden" />}

      {/* Fine grid */}
      {showGrid && (
        <div
          className={cn(
            'absolute inset-0',
            isLight ? 'saios-gradient-grid-light' : 'saios-gradient-grid-dark',
          )}
        />
      )}
    </div>
  )
}
