import type { Metadata } from 'next'
import { ContactDetailClient } from '@/components/crm/ContactDetailClient'

export const metadata: Metadata = { title: 'Contact' }

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ContactDetailClient contactId={id} />
}
