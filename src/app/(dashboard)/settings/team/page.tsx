import type { Metadata } from 'next'
import { TeamPageClient } from '@/components/settings/TeamPageClient'

export const metadata: Metadata = { title: 'Team' }

export default function TeamSettingsPage() {
  return <TeamPageClient />
}
