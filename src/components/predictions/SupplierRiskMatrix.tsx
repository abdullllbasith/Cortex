'use client'

import { useState } from 'react'
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface SupplierRiskItem {
  supplierId: string
  supplierName: string
  delayProbability: number
  expectedDelayDays: number
  priceIncreaseProbability: number
  overallRiskScore: number
  mitigationSuggestions: string[]
}

interface SupplierRiskMatrixProps {
  items: SupplierRiskItem[]
  loading?: boolean
  className?: string
}

export function SupplierRiskMatrix({ items, loading, className }: SupplierRiskMatrixProps) {
  const [selected, setSelected] = useState<SupplierRiskItem | null>(null)

  const data = items.map((s) => ({
    ...s,
    x: s.delayProbability,
    y: s.priceIncreaseProbability,
    z: Math.max(80, s.overallRiskScore * 3),
  }))

  if (loading) return <Skeleton className={cn('h-96 w-full rounded-xl', className)} />

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4', className)}>
      <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Supplier Risk Matrix</h3>
      <p className="text-xs text-slate-500 mb-4">Delay probability vs cost risk — click a supplier for details</p>

      {!data.length ? (
        <div className="h-72 flex items-center justify-center text-sm text-slate-400">No supplier predictions</div>
      ) : (
        <div className="relative">
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" name="Delay prob." domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} label={{ value: 'Delay Probability', position: 'bottom', offset: 0, fontSize: 11 }} />
              <YAxis type="number" dataKey="y" name="Cost risk" domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} label={{ value: 'Cost Risk', angle: -90, position: 'insideLeft', fontSize: 11 }} />
              <ZAxis type="number" dataKey="z" range={[60, 400]} />
              <ReferenceLine x={0.5} stroke="#94a3b8" strokeDasharray="4 4" />
              <ReferenceLine y={0.5} stroke="#94a3b8" strokeDasharray="4 4" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  const p = payload?.[0]?.payload as SupplierRiskItem & { x: number; y: number }
                  if (!p) return null
                  return (
                    <div className="rounded-lg border bg-white dark:bg-slate-900 p-2 text-xs shadow-lg">
                      <p className="font-semibold">{p.supplierName}</p>
                      <p>Delay: {Math.round(p.delayProbability * 100)}%</p>
                      <p>Cost risk: {Math.round(p.priceIncreaseProbability * 100)}%</p>
                      <p>Score: {p.overallRiskScore}</p>
                    </div>
                  )
                }}
              />
              <Scatter
                name="Suppliers"
                data={data}
                fill="#6366f1"
                onClick={(d) => setSelected(d as unknown as SupplierRiskItem)}
              />
            </ScatterChart>
          </ResponsiveContainer>

          <div className="absolute inset-0 pointer-events-none grid grid-cols-2 grid-rows-2 text-[10px] text-slate-400 font-medium">
            <span className="p-2 self-start justify-self-start">Monitor</span>
            <span className="p-2 self-start justify-self-end">Escalate</span>
            <span className="p-2 self-end justify-self-start">Manage</span>
            <span className="p-2 self-end justify-self-end">Replace</span>
          </div>
        </div>
      )}

      {selected && (
        <div className="mt-4 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 p-4">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">{selected.supplierName}</h4>
              <p className="text-xs text-slate-500 mt-1">
                Expected delay: {selected.expectedDelayDays} days · Risk score: {selected.overallRiskScore}
              </p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="text-xs text-slate-400 hover:text-slate-600">Close</button>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
            {selected.mitigationSuggestions.map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
