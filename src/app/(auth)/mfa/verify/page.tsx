import type { Metadata } from 'next'
import { Card, CardBody } from '@/components/ui'
export const metadata: Metadata = { title: 'Verify MFA' }
export default function MfaVerifyPage() {
  return <Card><CardBody className="p-6"><h1 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">Two-factor verification</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Enter the 6-digit code from your authenticator app.</p><div className="mt-6 flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-700"><span className="text-xs text-slate-400">OTP input — Module 01</span></div></CardBody></Card>
}
