import { MarketingNavbar } from '@/components/marketing/MarketingNavbar'
import { MarketingFooter } from '@/components/marketing/PricingFooter'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <MarketingNavbar />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  )
}
