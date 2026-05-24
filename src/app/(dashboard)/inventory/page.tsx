import type { Metadata } from 'next'
import { InventoryDashboardClient } from '@/components/inventory/InventoryDashboardClient'

export const metadata: Metadata = { title: 'Inventory' }

export default function InventoryDashboardPage() {
  return <InventoryDashboardClient />
}
