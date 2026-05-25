'use client'

import { ResponsiveContainer, LineChart, Line } from 'recharts'

export interface MetricSparklineProps {
  data: number[]
  positive: boolean
}

export function MetricSparkline({ data, positive }: MetricSparklineProps) {
  const chartData = data.map((v, i) => ({ i, v }))
  const color = positive ? '#10b981' : '#ef4444'

  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
