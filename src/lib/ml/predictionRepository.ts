import { getLatestSalesForecast } from './models/salesForecaster'
import { getLatestInventoryForecasts } from './models/inventoryForecaster'
import { getLatestChurnPredictions } from './models/customerChurnPredictor'
import { getLatestSupplierRiskPredictions } from './models/supplierRiskPredictor'
import { extractSalesFeatures } from './featureEngineering/salesFeatures'
import type { SalesForecastPoint } from './types'

export async function getSalesPredictionResponse(
  tenantId: string,
  horizon: number,
  granularity: 'daily' | 'weekly' | 'monthly',
) {
  const forecast = await getLatestSalesForecast(tenantId)
  const history = await extractSalesFeatures(tenantId)
  const historical = history.slice(-90).map((d) => ({
    date: d.date,
    actualRevenue: d.revenue,
  }))

  if (!forecast) {
    return { historical, forecast: [], trendDirection: 'flat' as const, trendPct: 0, method: null }
  }

  let points: SalesForecastPoint[] = forecast.dailyForecast
  if (granularity === 'weekly') points = forecast.weeklyForecast
  if (granularity === 'monthly') points = forecast.monthlyForecast

  const forecastSlice = points.slice(0, horizon)

  const nextMonth = forecast.monthlyForecast[0]?.predictedRevenue ?? 0
  const prevMonth = forecast.monthlyForecast[1]?.predictedRevenue ?? nextMonth
  const trendPct = prevMonth > 0 ? Math.round(((nextMonth - prevMonth) / prevMonth) * 100) : 0

  return {
    historical,
    forecast: forecastSlice,
    trendDirection: forecast.trendDirection,
    seasonalPattern: forecast.seasonalPattern,
    anomalies: forecast.anomalies,
    trendPct,
    method: forecast.method,
  }
}

export async function getInventoryPredictionResponse(tenantId: string, urgency?: string) {
  let items = await getLatestInventoryForecasts(tenantId)
  if (urgency && urgency !== 'all') {
    items = items.filter((i) => i.urgencyLevel === urgency)
  }

  return {
    items,
    purchaseOrders: items
      .filter((i) => i.urgencyLevel !== 'normal')
      .map((i) => ({
        productId: i.productId,
        productName: i.productName,
        quantity: i.reorderQuantity,
        recommendedDate: i.recommendedOrderDate,
        urgency: i.urgencyLevel,
      })),
  }
}

export async function getCustomerPredictionResponse(
  tenantId: string,
  risk: string,
  page: number,
  pageSize: number,
) {
  const riskFilter = risk === 'all' ? undefined : (risk as 'high' | 'medium' | 'low')
  const all = await getLatestChurnPredictions(tenantId, riskFilter)
  const start = (page - 1) * pageSize
  const items = all.slice(start, start + pageSize)

  return {
    items,
    pagination: {
      page,
      pageSize,
      total: all.length,
      totalPages: Math.ceil(all.length / pageSize),
    },
  }
}

export async function getSupplierPredictionResponse(tenantId: string) {
  const items = await getLatestSupplierRiskPredictions(tenantId)
  return { items }
}
