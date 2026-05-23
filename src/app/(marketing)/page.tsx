import type { Metadata } from 'next'
import { HeroSection, FeaturesSection, SocialProofSection } from '@/components/marketing/LandingSections'
import { PricingSection } from '@/components/marketing/PricingFooter'

export const metadata: Metadata = {
  title: 'SAIOS — Enterprise AI Operating System',
  description: 'Your entire business, one AI conversation. Unify intelligence, automation, and analytics with SAIOS.',
}

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <SocialProofSection />
      <FeaturesSection />
      <PricingSection />
    </>
  )
}
