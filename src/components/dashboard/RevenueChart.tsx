'use client'

import useSWR from 'swr'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts'
import { Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { ExecutiveData } from './types'

/* ── Custom tooltip ──────────────────────────────────────────────────────── */

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-md dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
        ${payload[0].value.toLocaleString()}
      </p>
    </div>
  )
}

/* ── RevenueChart ────────────────────────────────────────────────────────── */

export function RevenueChart() {
  const { data, isLoading } = useSWR<ExecutiveData>('/api/analytics/executive')

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 h-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Revenue — Last 7 Days
          </h2>
          {data && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Today{' '}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                ${data.kpis.revenue.value.toLocaleString()}
              </span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-indigo-200 dark:bg-indigo-900" />
            Previous
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-indigo-600" />
            Today
          </span>
        </div>
      </div>

      {isLoading || !data ? (
        <Skeleton height="200px" className="rounded-lg" />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={data.revenueChart}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            barSize={28}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="currentColor"
              className="text-slate-100 dark:text-slate-800"
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-slate-400"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-slate-400"
              axisLine={false}
              tickLine={false}
              width={42}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
            <Bar dataKey="revenue" radius={[4, 4, 0, 0]} isAnimationActive>
              {data.revenueChart.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.isToday ? '#4f46e5' : '#c7d2fe'}
                  className={cn(!entry.isToday && 'dark:fill-indigo-900/60')}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
