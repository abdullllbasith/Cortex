import type { Metadata } from 'next'
import { WarehousesClient } from '@/components/inventory/WarehousesClient'

export const metadata: Metadata = { title: 'Warehouses' }

export default function WarehousesPage() {
  return <WarehousesClient />
}
