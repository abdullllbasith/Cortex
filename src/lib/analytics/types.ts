export interface ScorecardItem {
  metric: string
  value: number
  change: number
  unit: string
  rag: 'green' | 'amber' | 'red' | string
}

export interface ExecutiveAnalyticsData {
  period: string
  scorecard: ScorecardItem[]
  modules: {
    sales: {
      totalRevenue: number
      totalOrders: number
      totalMargin: number
      avgOrderValue: number
      topProducts: Array<{ productId: string; name: string; revenue: number; quantity: number }>
      topBranches: Array<{ branchId: string; name: string; revenue: number }>
    }
    customers: {
      retentionRate: number
      churnRate: number
      avgLifetimeValue: number
      newCustomers: number
      returningCustomers: number
    }
    inventory: {
      summary?: {
        totalSKUs: number
        totalValue: number
        lowStockCount: number
        outOfStockCount: number
        itemsOnOrder: number
      }
      fastMovers: Array<{ productId: string; name: string; turnoverRate?: number; inventoryLevel?: number }>
      deadStock: Array<{ productId: string; name: string; daysIdle?: number; inventoryLevel?: number }>
      reorderRequired: Array<{ productId: string; name: string; inventoryLevel?: number; reorderPoint?: number }>
      stockTurnoverRate: number
    }
    suppliers: {
      onTimeDeliveryRate: number
      avgDeliveryDays: number
      costVariance: number
      reliabilityScore: Array<{ supplierId: string; name: string; score: number; onTimeRate: number }>
    }
    finance?: FinanceAnalyticsData
    hr?: HrAnalyticsData
  }
  insight?: { summary: string; generatedAt: string }
  revenueChart: Array<{ date: string; revenue: number; marginPct: number; isToday?: boolean }>
  transactions: Array<{ id: string; productId?: string; productName?: string; revenue: number; timestamp: string }>
  funnel: { visitors: number; leads: number; customers: number; repeat: number }
  supplierRadar: Array<{ supplier: string; reliability: number; speed: number; cost: number; quality: number; communication: number }>
  kpis?: {
    revenue: { value: number; change: number; label: string; prefix?: string; sparkline?: number[] }
    orders: { value: number; change: number; label: string; sparkline?: number[] }
    customers: { value: number; change: number; label: string; sparkline?: number[] }
    grossMargin: { value: number; change: number; label: string; suffix?: string; sparkline?: number[] }
  }
  cache?: { hit: boolean; hits: number; misses: number; hitRate: number }
}

export interface SalesAnalyticsData {
  period: string
  summary: {
    totalRevenue: number
    totalOrders: number
    avgOrderValue: number
    totalMargin: number
    grossMarginPct: number
  }
  comparison: { revenueChange: number; ordersChange: number; trend: string; previousRevenue: number }
  timeseries: Array<{ date: string; revenue: number; margin: number; marginPct: number; orders: number }>
  heatmap: Array<{ day: number; hour: number; value: number }>
  topProducts: Array<{ productId: string; name: string; revenue: number; quantity: number }>
  topBranches: Array<{ branchId: string; name: string; revenue: number }>
}

export interface CustomerAnalyticsData {
  period: string
  metrics: {
    retentionRate: number
    churnRate: number
    avgLifetimeValue: number
    newCustomers: number
    returningCustomers: number
  }
  cohorts: Array<{ cohort: string; monthOffset: number; retained: number }>
  funnel: { visitors: number; leads: number; customers: number; repeat: number }
  churnRisk: Array<{ customerId: string; name: string; churnScore: number; predictedChurnDate: string; ltvAtRisk: number }>
  segments: Array<{ name: string; value: number; color: string }>
}

export interface InventoryAnalyticsData {
  metrics: {
    summary?: {
      totalSKUs: number
      totalValue: number
      lowStockCount: number
      outOfStockCount: number
      itemsOnOrder: number
    }
    fastMovers: Array<{ productId: string; name: string; turnoverRate?: number; inventoryLevel?: number }>
    deadStock: Array<{ productId: string; name: string; daysIdle?: number; inventoryLevel?: number }>
    reorderRequired: Array<{ productId: string; name: string; inventoryLevel?: number; reorderPoint?: number }>
    stockTurnoverRate: number
  }
  valueTrend?: Array<{ date: string; value: number; movement: number }>
  computedAt: string
}

export interface FinanceAnalyticsData {
  period: string
  profitAndLoss: {
    revenueTotal: number
    expenseTotal: number
    netIncome: number
    changePercent: number
  }
  accountsReceivable: {
    totalOutstanding: number
    buckets: Array<{ label: string; count: number; total: number }>
  }
  accountsPayable: {
    totalOutstanding: number
    buckets: Array<{ label: string; count: number; total: number }>
  }
  cashPosition: number
  collectedThisPeriod: number
  invoicedThisPeriod: number
}

export interface HrAnalyticsData {
  period: string
  headcount: {
    total: number
    active: number
    onLeave: number
    byDepartment: Array<{ departmentId: string | null; departmentName: string; count: number }>
    trend: Array<{ month: string; count: number }>
  }
  attendance: {
    rate: number
    presentDays: number
    recordsLogged: number
    employeeCount: number
  }
  leave: {
    pendingRequests: number
    approvedThisPeriod: number
    rejectedThisPeriod: number
    utilizationRate: number
  }
  payroll: {
    lastRunMonth: number | null
    lastRunYear: number | null
    lastRunNet: number
    employeeCount: number
  }
}

export interface SupplierAnalyticsData {
  period: string
  metrics: {
    onTimeDeliveryRate: number
    avgDeliveryDays: number
    costVariance: number
    reliabilityScore: Array<{ supplierId: string; name: string; score: number; onTimeRate: number }>
  }
  leaderboard: Array<{ supplierId: string; name: string; score: number; onTimeRate: number }>
  costTrend: Array<{ date: string; cost: number }>
  deliveryHeatmap: Array<{ supplier: string; onTime: number; score: number }>
}
