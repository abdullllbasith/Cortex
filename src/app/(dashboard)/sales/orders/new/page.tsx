import type { Metadata } from 'next'
import { OrderNewClient } from '@/components/sales/OrderNewClient'

export const metadata: Metadata = { title: 'New Sales Order' }

export default function NewOrderPage() {
  return <OrderNewClient />
}
