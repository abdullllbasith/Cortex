import type { Metadata } from 'next'
import { Suspense } from 'react'
import { QuoteBuilderClient } from '@/components/sales/QuoteBuilderClient'

export const metadata: Metadata = { title: 'New Quote' }

export default function NewQuotePage() {
  return (
    <Suspense fallback={<div className="flex h-48 items-center justify-center text-sm text-slate-500">Loading…</div>}>
      <QuoteBuilderClient />
    </Suspense>
  )
}
