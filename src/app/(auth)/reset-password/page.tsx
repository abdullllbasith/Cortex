import type { Metadata } from 'next'
import { ResetPasswordPageClient } from '@/components/auth/ResetPasswordPageClient'

export const metadata: Metadata = { title: 'Set New Password' }

export default function ResetPasswordPage() {
  return <ResetPasswordPageClient />
}
