import type { Metadata } from 'next'
import { TrendingUp } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Predictions' }
export default function PredictionsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Predictions" subtitle="AI-generated forecasts for sales, demand, and risk" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Predictions' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<TrendingUp />} title="Predictions — Module 07" description="Demand forecasting, churn prediction, and anomaly detection." /></div>
    </div>
  )
}
