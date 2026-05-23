import type { Metadata } from 'next'
import { CreditCard } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Billing' }
export default function BillingPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Billing" subtitle="Subscription plan, usage, and payment methods" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Settings', href: '/settings' }, { label: 'Billing' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<CreditCard />} title="Billing — Module 10" description="Plan management, usage tracking, and Stripe integration." /></div>
    </div>
  )
}
