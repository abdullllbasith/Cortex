'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, ComposedChart } from 'recharts'

interface WorkflowAnalyticsProps {
  data: {
    total: number
    successRate: number
    failureRate: number
    avgDurationMs: number
    mostTriggered: Array<{ name: string; count: number }>
    dailySuccess: Array<{ date: string; successRate: number; total: number }>
  } | null
  loading?: boolean
}

export function WorkflowAnalytics({ data, loading }: WorkflowAnalyticsProps) {
  if (loading || !data) {
    return <div className="h-48 rounded-xl border border-dashed border-slate-200 animate-pulse" />
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
        <p className="text-xs text-slate-500">Success Rate (30d)</p>
        <p className="text-2xl font-bold text-emerald-600">{Math.round(data.successRate * 100)}%</p>
        <p className="text-xs text-slate-400">{data.total} total runs · avg {(data.avgDurationMs / 1000).toFixed(1)}s</p>
      </div>

      <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Daily Success Rate</p>
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={data.dailySuccess}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} domain={[0, 1]} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => (typeof v === 'number' ? `${Math.round(v * 100)}%` : String(v))} />
            <Line type="monotone" dataKey="successRate" stroke="#6366f1" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <p className="text-xs font-semibold mb-2">Most Triggered Workflows</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={data.mostTriggered}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
