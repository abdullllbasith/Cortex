import type { Metadata } from 'next'
import { ApiKeysPageClient } from '@/components/settings/ApiKeysPageClient'

export const metadata: Metadata = { title: 'API Keys' }

export default function ApiKeysPage() {
  return <ApiKeysPageClient />
}
