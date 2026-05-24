import type { Metadata } from 'next'
import { PurchaseOrdersPageClient } from '@/components/inventory/PurchaseOrdersPageClient'

export const metadata: Metadata = { title: 'Purchase Orders' }

export default function PurchaseOrdersPage() {
  return <PurchaseOrdersPageClient />
}
