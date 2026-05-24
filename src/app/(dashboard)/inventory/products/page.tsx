import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ProductCatalogClient } from '@/components/inventory/ProductCatalogClient'

export const metadata: Metadata = { title: 'Products' }

export default function InventoryProductsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Loading…</div>}>
      <ProductCatalogClient />
    </Suspense>
  )
}
