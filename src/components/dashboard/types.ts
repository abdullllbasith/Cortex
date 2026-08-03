/* ─────────────────────────────────────────────────────────────────────────────
   Shared type definitions for the executive dashboard data
   ───────────────────────────────────────────────────────────────────────────── */

export interface KpiMetric {
  value: number
  change: number
  label: string
  prefix?: string
  suffix?: string
  sparkline: number[]
}

export interface AiCallsMetric {
  used: number
  limit: number
  label: string
  sparkline: number[]
}

export interface RevenuePoint {
  date: string
  revenue: number
  isToday: boolean
}

export interface AgentActivity {
  id: string
  agent: string
  action: string
  time: string
  type: 'alert' | 'workflow' | 'inventory' | 'analytics'
}

export interface Alert {
  id: string
  title: string
  severity: 'danger' | 'warning' | 'info'
  time: string
}

export interface WorkflowExecution {
  id: string
  name: string
  status: 'success' | 'running' | 'failed'
  duration: string
  time: string
}

export interface Prediction {
  id: string
  event: string
  confidence: number
  daysOut: number
  severity: 'danger' | 'warning' | 'info'
}

export interface Transaction {
  id: string
  customer: string
  amount: number
  status: 'paid' | 'pending' | 'overdue' | 'refunded'
  time: string
  items: number
}

export interface ExecutiveData {
  kpis: {
    revenue: KpiMetric
    activeOrders: KpiMetric
    lowStock: KpiMetric
    activeWorkflows: KpiMetric
    aiCalls: AiCallsMetric
  }
  insight: {
    summary: string
    generatedAt: string
  }
  revenueChart: RevenuePoint[]
  agentActivity: AgentActivity[]
  alerts: Alert[]
  recentWorkflows: WorkflowExecution[]
  predictions: Prediction[]
  transactions: Transaction[]
}
