import type { Metadata } from 'next'
import { Users2 } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Customers' }
export default function CustomersPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Customers" subtitle="Customer records, health scores, and AI-generated insights" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Knowledge Base', href: '/knowledge' }, { label: 'Customers' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<Users2 />} title="Customers — Module 04" description="Customer list with search, filters, and enrichment." /></div>
    </div>
  )
}
