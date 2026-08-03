import type { Metadata } from 'next'
import { StockAdjustmentsClient } from '@/components/inventory/StockAdjustmentsClient'

export const metadata: Metadata = { title: 'Stock Adjustments' }

export default function StockAdjustmentsPage() {
  return <StockAdjustmentsClient />
}
