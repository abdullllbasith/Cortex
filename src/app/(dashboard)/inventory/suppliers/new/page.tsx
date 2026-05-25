import type { Metadata } from 'next'
import { SupplierNewClient } from '@/components/inventory/SupplierNewClient'

export const metadata: Metadata = { title: 'Add Supplier' }

export default function SupplierNewPage() {
  return <SupplierNewClient />
}
