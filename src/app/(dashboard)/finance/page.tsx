import type { Metadata } from 'next'
import { FinanceDashboardClient } from '@/components/finance/FinanceDashboardClient'

export const metadata: Metadata = { title: 'Finance' }

export default function FinancePage() {
  return <FinanceDashboardClient />
}
