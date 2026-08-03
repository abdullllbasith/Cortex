import type { Metadata } from 'next'
import {
  HeroSection,
  HeroDashboardSection,
  FeaturesSection,
  SocialProofSection,
  HowItWorksSection,
  IntegrationsSection,
  TestimonialsSection,
  SecuritySection,
  CTABannerSection,
} from '@/components/marketing/LandingSections'
import { PricingSection } from '@/components/marketing/PricingFooter'

export const metadata: Metadata = {
  title: 'Cortex — Enterprise AI Operating System',
  description: 'Your entire business, one AI conversation. Unify intelligence, automation, and analytics with Cortex.',
}

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <HeroDashboardSection />
      <SocialProofSection />
      <HowItWorksSection />
      <FeaturesSection />
      <IntegrationsSection />
      <TestimonialsSection />
      <SecuritySection />
      <CTABannerSection />
      <PricingSection />
    </>
  )
}
