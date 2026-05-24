import type { Metadata } from 'next'
import { ProductNewClient } from '@/components/inventory/ProductNewClient'

export const metadata: Metadata = { title: 'Add Product' }

export default function ProductNewPage() {
  return <ProductNewClient />
}
