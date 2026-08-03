import type { Metadata } from 'next'
import { QuotesPageClient } from '@/components/sales/QuotesPageClient'

export const metadata: Metadata = { title: 'Quotes' }

export default function QuotesPage() {
  return <QuotesPageClient />
}
