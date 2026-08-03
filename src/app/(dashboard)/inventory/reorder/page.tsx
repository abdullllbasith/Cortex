import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ReorderPageClient } from '@/components/inventory/ReorderPageClient'

export const metadata: Metadata = { title: 'Reorder Centre' }

export default function InventoryReorderPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Loading…</div>}>
      <ReorderPageClient />
    </Suspense>
  )
}
