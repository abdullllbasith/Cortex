import type { Metadata } from 'next'
import { SupplierDetailClient } from '@/components/inventory/SupplierDetailClient'

export const metadata: Metadata = { title: 'Supplier Details' }

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SupplierDetailClient supplierId={id} />
}
