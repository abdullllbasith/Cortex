import type { Metadata } from 'next'
import { AdminAnnouncementsClient } from '@/components/admin/AdminAnnouncementsClient'

export const metadata: Metadata = { title: 'Announcements' }

export default function AdminAnnouncementsPage() {
  return <AdminAnnouncementsClient />
}
