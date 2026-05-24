import type { Metadata } from 'next'
import { MfaSetupClient } from '@/components/auth/MfaSetupClient'

export const metadata: Metadata = { title: 'Set Up MFA' }

export default function MfaSetupPage() {
  return <MfaSetupClient />
}
