import type { Metadata } from 'next'
import { ContactsPageClient } from '@/components/crm/ContactsPageClient'

export const metadata: Metadata = { title: 'CRM Contacts' }

export default function CrmContactsPage() {
  return <ContactsPageClient />
}
