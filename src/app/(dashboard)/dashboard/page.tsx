import type { Metadata } from 'next'
import { WelcomeRow } from '@/components/dashboard/WelcomeRow'
import { InsightBanner } from '@/components/dashboard/InsightBanner'
import { AgentActivityFeed } from '@/components/dashboard/AgentActivityFeed'
import { AlertsWidget } from '@/components/dashboard/AlertsWidget'
import { WorkflowExecutions } from '@/components/dashboard/WorkflowExecutions'
import { PredictionsWidget } from '@/components/dashboard/PredictionsWidget'
import { RecentTransactionsTable } from '@/components/dashboard/RecentTransactionsTable'
import { KpiStrip } from '@/components/dashboard/KpiStrip'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer'
import { LazyRevenueChart } from '@/lib/lazy/components'

export const metadata: Metadata = { title: 'Dashboard' }

export default function DashboardPage() {
  return (
    <DashboardShell>
      <ResponsiveContainer className="flex flex-col gap-5 py-5 lg:py-6">
      <WelcomeRow />
      <KpiStrip />
      <InsightBanner />
      <div className="grid-analytics-two-col">
        <LazyRevenueChart />
        <AgentActivityFeed />
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <AlertsWidget />
        <WorkflowExecutions />
        <PredictionsWidget />
      </div>
      <RecentTransactionsTable />
      </ResponsiveContainer>
    </DashboardShell>
  )
}
