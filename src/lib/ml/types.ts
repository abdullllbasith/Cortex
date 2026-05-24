import type { FeatureEntityType, MLPredictionType } from '@prisma/client'

export interface FeatureRow {
  entityType: FeatureEntityType
  entityId: string
  features: Record<string, number | string | boolean | null>
}

export interface FeatureMatrix {
  tenantId: string
  computedAt: string
  rows: FeatureRow[]
  metadata: {
    rowCount: number
    featureNames: string[]
  }
}

export interface DailySalesFeatures {
  date: string
  revenue: number
  lag1d: number
  lag7d: number
  lag14d: number
  lag30d: number
  rollingAvg7d: number
  rollingAvg30d: number
  dayOfWeek: number
  month: number
  isHoliday: boolean
  categoryElectronics: number
  categoryHardware: number
  categorySoftware: number
  branchAggregate: number
}

export interface SalesForecastPoint {
  date: string
  predictedRevenue: number
  lowerBound: number
  upperBound: number
  confidence: number
}

export interface SalesForecastResult {
  dailyForecast: SalesForecastPoint[]
  weeklyForecast: SalesForecastPoint[]
  monthlyForecast: SalesForecastPoint[]
  trendDirection: 'up' | 'down' | 'flat'
  seasonalPattern: string
  anomalies: Array<{ date: string; reason: string; severity: string }>
  method: 'llm' | 'exponential_smoothing'
}

export interface InventoryForecastItem {
  productId: string
  productName: string
  currentStock: number
  dailyConsumptionRate: number
  predictedStockOutDate: string | null
  reorderQuantity: number
  recommendedOrderDate: string | null
  urgencyLevel: 'critical' | 'warning' | 'normal'
}

export interface CustomerChurnPrediction {
  customerId: string
  customerName: string
  churnProbability: number
  churnRisk: 'high' | 'medium' | 'low'
  daysToChurn: number | null
  ltvAtRisk: number
  monetary90d?: number
  retentionActions: string[]
}

export interface SupplierRiskPrediction {
  supplierId: string
  supplierName: string
  delayProbability: number
  expectedDelayDays: number
  priceIncreaseProbability: number
  overallRiskScore: number
  mitigationSuggestions: string[]
}

export interface PredictionRunSummary {
  tenantId: string
  predictionTypes: MLPredictionType[]
  counts: Record<string, number>
  computedAt: string
}
