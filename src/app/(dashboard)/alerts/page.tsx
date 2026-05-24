import type { Metadata } from 'next'
import AlertsPageClient from './AlertsPageClient'

export const metadata: Metadata = { title: 'Alerts' }

export default function AlertsPage() {
  return <AlertsPageClient />
}
