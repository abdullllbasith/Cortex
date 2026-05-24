import type { Metadata } from 'next'
import { AuthCenteredShell } from '@/components/auth'
import { AdminLoginForm } from '@/components/admin/AdminLoginForm'

export const metadata: Metadata = { title: 'Platform Admin Sign In' }

export default function AdminLoginPage() {
  return (
    <AuthCenteredShell>
      <AdminLoginForm />
    </AuthCenteredShell>
  )
}
