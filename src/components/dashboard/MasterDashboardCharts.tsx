'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { DollarSign, TrendingUp } from 'lucide-react'
import { Card, CardBody, Skeleton } from '@/components/ui'

function formatCurrency(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export interface MasterDashboardChartsProps {
  isLoading: boolean
  revenueChart14d: Array<{ date: string; revenue: number }>
  pipelineByStage: Array<{ stageId: string; name: string; count: number; value: number }>
}

/** Recharts bundle for master dashboard — loaded separately from the main dashboard shell. */
export function MasterDashboardCharts({
  isLoading,
  revenueChart14d,
  pipelineByStage,
}: MasterDashboardChartsProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardBody className="p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            Revenue — last 14 days
          </h3>
          {isLoading ? (
            <Skeleton className="h-[220px]" />
          ) : revenueChart14d.every((d) => !d.revenue) ? (
            <p className="flex h-[220px] items-center justify-center text-center text-sm text-slate-500">
              No revenue recorded in the last 14 days
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueChart14d}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0)), 'Revenue']} />
                <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            Pipeline by stage
          </h3>
          {isLoading ? (
            <Skeleton className="h-[220px]" />
          ) : pipelineByStage.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No open deals in pipeline</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pipelineByStage} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0)), 'Value']} />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
