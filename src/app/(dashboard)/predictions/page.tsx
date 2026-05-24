import type { Metadata } from 'next'
import PredictionsPageClient from './PredictionsPageClient'

export const metadata: Metadata = { title: 'Predictions' }

export default function PredictionsPage() {
  return <PredictionsPageClient />
}
