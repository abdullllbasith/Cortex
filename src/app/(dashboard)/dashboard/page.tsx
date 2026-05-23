import type { Metadata } from 'next'
import { WelcomeRow } from '@/components/dashboard/WelcomeRow'
import { InsightBanner } from '@/components/dashboard/InsightBanner'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { AgentActivityFeed } from '@/components/dashboard/AgentActivityFeed'
import { AlertsWidget } from '@/components/dashboard/AlertsWidget'
import { WorkflowExecutions } from '@/components/dashboard/WorkflowExecutions'
import { PredictionsWidget } from '@/components/dashboard/PredictionsWidget'
import { RecentTransactionsTable } from '@/components/dashboard/RecentTransactionsTable'
import { KpiStrip } from '@/components/dashboard/KpiStrip'

export const metadata: Metadata = { title: 'Dashboard' }

export default function DashboardPage() {
  return (
    <div className="flex min-h-full flex-col gap-5 p-5 lg:p-6">
      <WelcomeRow />
      <KpiStrip />
      <InsightBanner />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RevenueChart />
        </div>
        <div className="lg:col-span-2">
          <AgentActivityFeed />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <AlertsWidget />
        <WorkflowExecutions />
        <PredictionsWidget />
      </div>
      <RecentTransactionsTable />
    </div>
  )
}
