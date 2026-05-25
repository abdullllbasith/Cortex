import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield } from 'lucide-react'
import { PageHeader, Card, CardBody, Button } from '@/components/ui'
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer'

export const metadata: Metadata = { title: 'Security' }

export default function SecuritySettingsPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Security"
        subtitle="Two-factor authentication and session security"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings', href: '/settings/general' },
          { label: 'Security' },
        ]}
      />
      <ResponsiveContainer className="flex-1 space-y-6 py-6">
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-indigo-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Two-factor authentication</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Protect your account with an authenticator app and backup codes.
                </p>
              </div>
            </div>
            <Link href="/mfa/setup">
              <Button size="sm">Set up MFA</Button>
            </Link>
          </CardBody>
        </Card>
      </ResponsiveContainer>
    </div>
  )
}
