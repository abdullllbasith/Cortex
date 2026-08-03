import type { Metadata } from 'next'
import { RolesPageClient } from '@/components/settings/RolesPageClient'

export const metadata: Metadata = { title: 'Roles & Permissions' }

export default function RolesPage() {
  return <RolesPageClient />
}
