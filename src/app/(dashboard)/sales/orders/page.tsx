import type { Metadata } from 'next'
import { OrdersPageClient } from '@/components/sales/OrdersPageClient'

export const metadata: Metadata = { title: 'Sales Orders' }

export default function OrdersPage() {
  return <OrdersPageClient />
}
