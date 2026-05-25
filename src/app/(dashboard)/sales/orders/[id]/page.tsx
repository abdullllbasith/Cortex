import type { Metadata } from 'next'
import { OrderDetailClient } from '@/components/sales/OrderDetailClient'

export const metadata: Metadata = { title: 'Order Detail' }

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OrderDetailClient orderId={id} />
}
