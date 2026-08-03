import { cn } from '@/lib/utils'
import { SaiosAnimatedGradientBackdrop } from '@/components/branding/SaiosAnimatedGradientBackdrop'
import { HeroNetworkCanvas } from './HeroNetworkCanvas'

/** Shared hero atmosphere — clipped to the hero section only. */
export function MarketingHeroBackdrop({ className }: { className?: string }) {
  return (
    <>
      <SaiosAnimatedGradientBackdrop
        variant="light"
        hero
        className={cn(className)}
        showGrid
      />
      <HeroNetworkCanvas />
    </>
  )
}
