import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CategoriesPageClient } from '@/components/inventory/CategoriesPageClient'

export const metadata: Metadata = { title: 'Categories' }

export default function InventoryCategoriesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Loading…</div>}>
      <CategoriesPageClient />
    </Suspense>
  )
}
