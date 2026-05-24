'use client'

import useSWR from 'swr'
import { CreditCard, Download, ExternalLink } from 'lucide-react'
import { PageHeader, Button, Badge, Card, CardBody, Skeleton } from '@/components/ui'
import { swrFetcher } from '@/lib/api/apiClient'
import { cn } from '@/lib/utils'

interface UsageMeter {
  used: number
  limit: number
}

interface BillingData {
  plan: {
    id: string
    name: string
    price: number
    features: string[]
    renewalDate: string
    renewalAmount: number
  }
  usage: {
    aiCalls: UsageMeter
    workflows: UsageMeter
    storage: UsageMeter
    apiCalls: UsageMeter
    teamMembers: UsageMeter
  }
  invoices: Array<{ id: string; date: string; amount: number; status: string; pdfUrl: string | null }>
  paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number }
  comparison: Array<{ name: string; starter: boolean | string; professional: boolean | string; enterprise: boolean | string }>
  allPlans: Array<{ id: string; name: string; price: number; features: string[] }>
  stripeConfigured: boolean
}

function usageColor(pct: number): string {
  if (pct >= 90) return 'bg-red-500'
  if (pct >= 70) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function UsageBar({ label, meter }: { label: string; meter: UsageMeter }) {
  const pct = meter.limit ? Math.min(100, (meter.used / meter.limit) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-600 dark:text-slate-400">{label}</span>
        <span className="font-medium">{meter.used.toLocaleString()} / {meter.limit.toLocaleString()}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', usageColor(pct))} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function BillingSettingsPage() {
  const { data, isLoading } = useSWR<BillingData>('/settings/billing', swrFetcher)

  if (isLoading || !data) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Plan & Usage"
        subtitle="Manage your subscription and monitor resource usage"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings', href: '/settings' },
          { label: 'Billing' },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={() => window.open('/settings/billing', '_self')}>
              Upgrade plan
            </Button>
            <Button variant="secondary" size="sm" disabled={!data.stripeConfigured}>
              <ExternalLink className="h-4 w-4 mr-1" /> Manage billing
            </Button>
          </div>
        }
      />

      <div className="p-6 max-w-5xl space-y-6">
        <Card>
          <CardBody className="p-6">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <Badge variant="info" size="sm" className="mb-2">{data.plan.name} plan</Badge>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  ${data.plan.price}<span className="text-base font-normal text-slate-500">/mo</span>
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Renews {new Date(data.plan.renewalDate).toLocaleDateString()} · ${data.plan.renewalAmount}
                </p>
                <ul className="mt-3 space-y-1">
                  {data.plan.features.map((f) => (
                    <li key={f} className="text-sm text-slate-600 dark:text-slate-400">✓ {f}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-6 space-y-4">
            <h3 className="font-semibold">Usage this period</h3>
            <UsageBar label="AI calls" meter={data.usage.aiCalls} />
            <UsageBar label="Workflows" meter={data.usage.workflows} />
            <UsageBar label="Storage (GB)" meter={data.usage.storage} />
            <UsageBar label="API calls" meter={data.usage.apiCalls} />
            <UsageBar label="Team members" meter={data.usage.teamMembers} />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-0 overflow-x-auto">
            <h3 className="font-semibold px-6 pt-6 pb-2">Plan comparison</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-4 py-3 text-left">Feature</th>
                  <th className="px-4 py-3 text-center">Starter</th>
                  <th className="px-4 py-3 text-center">Professional</th>
                  <th className="px-4 py-3 text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {data.comparison.map((row) => (
                  <tr key={row.name} className="border-b border-slate-50 dark:border-slate-800/60">
                    <td className="px-4 py-2">{row.name}</td>
                    {(['starter', 'professional', 'enterprise'] as const).map((plan) => (
                      <td key={plan} className="px-4 py-2 text-center text-slate-500">
                        {typeof row[plan] === 'boolean'
                          ? row[plan] ? '✓' : '—'
                          : row[plan]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <div id="invoices">
        <Card>
          <CardBody className="p-0">
            <h3 className="font-semibold px-6 pt-6 pb-2">Invoice history</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-50 dark:border-slate-800/60">
                    <td className="px-4 py-3">{new Date(inv.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">${inv.amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={inv.status === 'paid' ? 'success' : 'warning'}>{inv.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" disabled={!inv.pdfUrl}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
        </div>

        <div id="payment">
        <Card>
          <CardBody className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-slate-400" />
              <div>
                <p className="font-medium">{data.paymentMethod.brand} •••• {data.paymentMethod.last4}</p>
                <p className="text-sm text-slate-500">
                  Expires {data.paymentMethod.expMonth}/{data.paymentMethod.expYear}
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" disabled={!data.stripeConfigured}>
              Update payment method
            </Button>
          </CardBody>
        </Card>
        </div>
      </div>
    </div>
  )
}
