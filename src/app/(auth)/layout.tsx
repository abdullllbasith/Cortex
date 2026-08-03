'use client'

import { usePathname } from 'next/navigation'
import { AuthSplitShell, AuthCenteredShell } from '@/components/auth'

const CENTERED_ROUTES = ['/forgot-password', '/reset-password']

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isCentered =
    CENTERED_ROUTES.some((r) => pathname.startsWith(r)) ||
    pathname.startsWith('/invite/')

  if (isCentered) {
    return <AuthCenteredShell>{children}</AuthCenteredShell>
  }

  return <AuthSplitShell>{children}</AuthSplitShell>
}
