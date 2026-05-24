'use client'

import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer, Tooltip,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui'

interface SupplierRadarData {
  supplier: string
  reliability: number
  speed: number
  cost: number
  quality: number
  communication: number
}

interface SupplierRadarChartProps {
  data: SupplierRadarData[]
  loading?: boolean
  className?: string
}

const COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#ef4444']

export function SupplierRadarChart({ data, loading, className }: SupplierRadarChartProps) {
  if (loading) return <Skeleton className={cn('h-80 rounded-xl', className)} />

  if (!data.length) {
    return (
      <div className={cn('h-80 flex items-center justify-center rounded-xl border border-dashed text-sm text-slate-400', className)}>
        No supplier performance data
      </div>
    )
  }

  const chartData = [
    { metric: 'Reliability', ...Object.fromEntries(data.map((d, i) => [`s${i}`, d.reliability])) },
    { metric: 'Speed', ...Object.fromEntries(data.map((d, i) => [`s${i}`, d.speed])) },
    { metric: 'Cost', ...Object.fromEntries(data.map((d, i) => [`s${i}`, d.cost])) },
    { metric: 'Quality', ...Object.fromEntries(data.map((d, i) => [`s${i}`, d.quality])) },
    { metric: 'Communication', ...Object.fromEntries(data.map((d, i) => [`s${i}`, d.communication])) },
  ]

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4', className)}>
      <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Supplier Performance</h3>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={chartData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
          <Tooltip />
          <Legend />
          {data.map((d, i) => (
            <Radar
              key={d.supplier}
              name={d.supplier}
              dataKey={`s${i}`}
              stroke={COLORS[i % COLORS.length]}
              fill={COLORS[i % COLORS.length]}
              fillOpacity={0.15}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
