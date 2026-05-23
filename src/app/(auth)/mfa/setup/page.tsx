import type { Metadata } from 'next'
import { Card, CardBody } from '@/components/ui'
export const metadata: Metadata = { title: 'Set Up MFA' }
export default function MfaSetupPage() {
  return <Card><CardBody className="p-6"><h1 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">Set up two-factor authentication</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Add an extra layer of security to your account.</p><div className="mt-6 flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-700"><span className="text-xs text-slate-400">MFA setup (TOTP/QR) — Module 01</span></div></CardBody></Card>
}
