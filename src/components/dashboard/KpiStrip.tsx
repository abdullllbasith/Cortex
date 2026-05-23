'use client'

import useSWR from 'swr'
import { MetricCard } from './MetricCard'
import type { ExecutiveData } from './types'

export function KpiStrip() {
  const { data, isLoading } = useSWR<ExecutiveData>('/api/analytics/executive')

  const cards = [
    {
      label:     data?.kpis.revenue.label     ?? "Today's Revenue",
      value:     data?.kpis.revenue.value     ?? 0,
      change:    data?.kpis.revenue.change,
      prefix:    '$',
      sparkline: data?.kpis.revenue.sparkline,
      delay:     0,
    },
    {
      label:     data?.kpis.activeOrders.label     ?? 'Active Orders',
      value:     data?.kpis.activeOrders.value     ?? 0,
      change:    data?.kpis.activeOrders.change,
      sparkline: data?.kpis.activeOrders.sparkline,
      delay:     100,
    },
    {
      label:        data?.kpis.lowStock.label ?? 'Low Stock Items',
      value:        data?.kpis.lowStock.value ?? 0,
      change:       data?.kpis.lowStock.change,
      positiveIsGood: false,
      sparkline:    data?.kpis.lowStock.sparkline,
      urgent:       true,
      delay:        200,
    },
    {
      label:     data?.kpis.activeWorkflows.label     ?? 'Active Workflows',
      value:     data?.kpis.activeWorkflows.value     ?? 0,
      change:    data?.kpis.activeWorkflows.change,
      sparkline: data?.kpis.activeWorkflows.sparkline,
      delay:     300,
    },
    {
      label:       data?.kpis.aiCalls.label ?? 'AI Calls Today',
      value:       0, // unused for ratio display
      numerator:   data?.kpis.aiCalls.used,
      denominator: data?.kpis.aiCalls.limit,
      sparkline:   data?.kpis.aiCalls.sparkline,
      delay:       400,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card, i) => (
        <MetricCard
          key={i}
          label={card.label}
          value={card.value}
          change={card.change}
          positiveIsGood={card.positiveIsGood}
          prefix={card.prefix}
          sparkline={card.sparkline}
          urgent={card.urgent}
          numerator={card.numerator}
          denominator={card.denominator}
          loading={isLoading}
          animationDelay={card.delay}
        />
      ))}
    </div>
  )
}
