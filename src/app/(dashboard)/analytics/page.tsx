import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui'
import { AnalyticsPageContent } from './AnalyticsPageContent'

export const metadata: Metadata = { title: 'Analytics' }

export default function AnalyticsPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Analytics"
        subtitle="Enterprise performance metrics and trend analysis"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Analytics' }]}
      />
      <AnalyticsPageContent />
    </div>
  )
}
