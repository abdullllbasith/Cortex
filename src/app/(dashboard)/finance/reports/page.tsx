import { Suspense } from 'react'
import { FinanceReportsClient } from '@/components/finance/FinanceReportsClient'

export default function FinanceReportsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Loading reports…</div>}>
      <FinanceReportsClient />
    </Suspense>
  )
}
