import type { Metadata } from 'next'
import PredictionsPageClient from '@/app/(dashboard)/predictions/PredictionsPageClient'

export const metadata: Metadata = { title: 'Predictions' }

export default function PredictionsPage() {
  return <PredictionsPageClient />
}
