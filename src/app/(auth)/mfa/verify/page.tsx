import type { Metadata } from 'next'
import { MfaVerifyClient } from '@/components/auth/MfaVerifyClient'

export const metadata: Metadata = { title: 'Verify MFA' }

export default function MfaVerifyPage() {
  return <MfaVerifyClient />
}
