'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, LogOut, User } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { useAdminSessionStore } from '@/store/adminSessionStore'

export function AdminTopBar() {
  const router = useRouter()
  const admin = useAdminSessionStore((s) => s.admin)

  const handleLogout = async () => {
    await fetch('/api/auth/admin/logout', { method: 'POST', credentials: 'include' })
    useAdminSessionStore.getState().clearSession()
    router.push('/admin/login')
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-3">
        <Badge variant="warning" size="sm">
          Admin Panel
        </Badge>
        <span className="hidden text-sm text-slate-500 sm:inline">Platform control center</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 text-sm text-slate-600 dark:text-slate-400 sm:flex">
          <User className="h-4 w-4" aria-hidden="true" />
          <span>{admin?.name ?? admin?.email ?? 'Platform Admin'}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} leftIcon={<LogOut className="h-4 w-4" />}>
          Sign out
        </Button>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
        >
          Exit to main app
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </header>
  )
}
