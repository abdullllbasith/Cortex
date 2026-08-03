import type { Metadata } from 'next'
import { PurchaseOrderDetailClient } from '@/components/inventory/PurchaseOrderDetailClient'

export const metadata: Metadata = { title: 'Purchase Order' }

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PurchaseOrderDetailClient poId={id} />
}
