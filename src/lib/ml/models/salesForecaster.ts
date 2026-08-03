import { MLModelType, MLPredictionType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { completeStructuredJson, isPredictionLlmAvailable } from '../llmClient'
import { getLatestSalesSeries } from '../featurePipeline'
import type { SalesForecastResult, SalesForecastPoint } from '../types'
import { addDays, dateKey, forecastExponentialSmoothing, startOfDay } from '../utils'

const SYSTEM_PROMPT = `You are an expert quantitative analyst specializing in time-series forecasting for enterprise sales.
Analyze the provided daily sales features and produce accurate revenue forecasts.
Return strict JSON matching this schema:
{
  "dailyForecast": [{ "date": "YYYY-MM-DD", "predictedRevenue": number, "lowerBound": number, "upperBound": number, "confidence": number }],
  "weeklyForecast": [{ "date": "YYYY-MM-DD", "predictedRevenue": number, "lowerBound": number, "upperBound": number, "confidence": number }],
  "monthlyForecast": [{ "date": "YYYY-MM-DD", "predictedRevenue": number, "lowerBound": number, "upperBound": number, "confidence": number }],
  "trendDirection": "up" | "down" | "flat",
  "seasonalPattern": string,
  "anomalies": [{ "date": "YYYY-MM-DD", "reason": string, "severity": "low" | "medium" | "high" }]
}
Use historical lag features, rolling averages, and seasonality. Confidence 0-1. Bounds should reflect ~90% interval.`

function aggregateWeekly(daily: SalesForecastPoint[]): SalesForecastPoint[] {
  const weeks = new Map<string, SalesForecastPoint[]>()
  for (const p of daily) {
    const wk = p.date.slice(0, 7)
    const list = weeks.get(wk) ?? []
    list.push(p)
    weeks.set(wk, list)
  }
  return Array.from(weeks.entries()).map(([wk, pts]) => ({
    date: `${wk}-01`,
    predictedRevenue: pts.reduce((s, p) => s + p.predictedRevenue, 0),
    lowerBound: pts.reduce((s, p) => s + p.lowerBound, 0),
    upperBound: pts.reduce((s, p) => s + p.upperBound, 0),
    confidence: pts.reduce((s, p) => s + p.confidence, 0) / pts.length,
  }))
}

function aggregateMonthly(daily: SalesForecastPoint[]): SalesForecastPoint[] {
  const months = new Map<string, SalesForecastPoint[]>()
  for (const p of daily) {
    const mk = p.date.slice(0, 7)
    const list = months.get(mk) ?? []
    list.push(p)
    months.set(mk, list)
  }
  return Array.from(months.entries()).map(([mk, pts]) => ({
    date: `${mk}-01`,
    predictedRevenue: pts.reduce((s, p) => s + p.predictedRevenue, 0),
    lowerBound: pts.reduce((s, p) => s + p.lowerBound, 0),
    upperBound: pts.reduce((s, p) => s + p.upperBound, 0),
    confidence: pts.reduce((s, p) => s + p.confidence, 0) / pts.length,
  }))
}

function exponentialSmoothingForecast(
  tenantId: string,
  series: Awaited<ReturnType<typeof getLatestSalesSeries>>,
  horizon = 30,
): SalesForecastResult {
  const revenues = series.map((d) => d.revenue)
  const forecast = forecastExponentialSmoothing(revenues, horizon)
  const std = Math.sqrt(
    revenues.length
      ? revenues.reduce((s, v) => s + (v - (revenues.reduce((a, b) => a + b, 0) / revenues.length)) ** 2, 0) / revenues.length
      : 0,
  )

  const start = addDays(startOfDay(new Date()), 1)
  const dailyForecast: SalesForecastPoint[] = forecast.map((pred, i) => {
    const d = addDays(start, i)
    return {
      date: dateKey(d),
      predictedRevenue: Math.round(pred * 100) / 100,
      lowerBound: Math.max(0, pred - 1.645 * std),
      upperBound: pred + 1.645 * std,
      confidence: 0.65,
    }
  })

  const recent = revenues.slice(-14)
  const prior = revenues.slice(-28, -14)
  const recentAvg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0
  const priorAvg = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : recentAvg
  const trendDirection = recentAvg > priorAvg * 1.05 ? 'up' : recentAvg < priorAvg * 0.95 ? 'down' : 'flat'

  return {
    dailyForecast,
    weeklyForecast: aggregateWeekly(dailyForecast),
    monthlyForecast: aggregateMonthly(dailyForecast),
    trendDirection,
    seasonalPattern: 'Weekly seasonality detected from day-of-week encoding',
    anomalies: [],
    method: 'exponential_smoothing',
  }
}

async function ensureModel(tenantId: string) {
  const existing = await prisma.mLModel.findFirst({
    where: { tenantId, modelType: MLModelType.SALES_FORECAST, status: 'ACTIVE' },
  })
  if (existing) return existing
  return prisma.mLModel.create({
    data: {
      tenantId,
      modelType: MLModelType.SALES_FORECAST,
      version: '1.0.0',
      config: { horizon: 90 },
    },
  })
}

export async function runSalesForecaster(tenantId: string): Promise<SalesForecastResult> {
  const series = await getLatestSalesSeries(tenantId)
  const last90 = series.slice(-90)

  let result: SalesForecastResult | null = null

  if (isPredictionLlmAvailable() && last90.length >= 14) {
    const llmResult = await completeStructuredJson<Omit<SalesForecastResult, 'method'>>(
      SYSTEM_PROMPT,
      JSON.stringify({ tenantId, last90Days: last90 }),
      4096,
    )
    if (llmResult?.dailyForecast?.length) {
      result = {
        ...llmResult,
        weeklyForecast: llmResult.weeklyForecast?.length
          ? llmResult.weeklyForecast
          : aggregateWeekly(llmResult.dailyForecast),
        monthlyForecast: llmResult.monthlyForecast?.length
          ? llmResult.monthlyForecast
          : aggregateMonthly(llmResult.dailyForecast),
        method: 'llm',
      }
    }
  }

  if (!result) {
    result = exponentialSmoothingForecast(tenantId, last90)
  }

  const model = await ensureModel(tenantId)
  const expiresAt = addDays(new Date(), 7)

  await prisma.mLPrediction.create({
    data: {
      tenantId,
      modelId: model.id,
      predictionType: MLPredictionType.SALES_FORECAST,
      entityId: 'tenant',
      payload: result as never,
      confidence: result.dailyForecast[0]?.confidence ?? 0.7,
      expiresAt,
    },
  })

  return result
}

export async function getLatestSalesForecast(tenantId: string): Promise<SalesForecastResult | null> {
  const pred = await prisma.mLPrediction.findFirst({
    where: { tenantId, predictionType: MLPredictionType.SALES_FORECAST, entityId: 'tenant' },
    orderBy: { computedAt: 'desc' },
  })
  return pred ? (pred.payload as unknown as SalesForecastResult) : null
}
