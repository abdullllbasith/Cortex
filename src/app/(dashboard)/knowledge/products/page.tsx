import type { Metadata } from 'next'
import { Package } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Products' }
export default function ProductsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Products" subtitle="Product catalogue with stock levels, pricing, and performance" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Knowledge Base', href: '/knowledge' }, { label: 'Products' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<Package />} title="Products — Module 04" description="Product catalogue, variants, and inventory signals." /></div>
    </div>
  )
}
