import type { Metadata } from 'next'
import { InviteAcceptForm } from '@/components/auth'

export const metadata: Metadata = { title: 'Accept Invitation' }

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <InviteAcceptForm token={token} />
}
