import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SuppliersPageClient } from '@/components/inventory/SuppliersPageClient'

export const metadata: Metadata = { title: 'Suppliers' }

export default function InventorySuppliersPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Loading…</div>}>
      <SuppliersPageClient />
    </Suspense>
  )
}
