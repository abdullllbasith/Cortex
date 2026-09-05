import type { Metadata } from 'next'
import { LazyFinanceDashboardClient } from '@/lib/lazy/components'

export const metadata: Metadata = { title: 'Finance' }

export default function FinancePage() {
  return <LazyFinanceDashboardClient />
}
