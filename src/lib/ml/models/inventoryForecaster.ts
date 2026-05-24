import { MLModelType, MLPredictionType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { extractInventoryFeatures } from '../featureEngineering/inventoryFeatures'
import type { InventoryForecastItem } from '../types'
import { addDays, dateKey, startOfDay, wilsonEoq } from '../utils'

function urgencyLevel(daysRemaining: number | null): 'critical' | 'warning' | 'normal' {
  if (daysRemaining === null) return 'normal'
  if (daysRemaining <= 7) return 'critical'
  if (daysRemaining <= 21) return 'warning'
  return 'normal'
}

async function ensureModel(tenantId: string) {
  const existing = await prisma.mLModel.findFirst({
    where: { tenantId, modelType: MLModelType.INVENTORY_FORECAST, status: 'ACTIVE' },
  })
  if (existing) return existing
  return prisma.mLModel.create({
    data: { tenantId, modelType: MLModelType.INVENTORY_FORECAST, version: '1.0.0' },
  })
}

export async function runInventoryForecaster(tenantId: string): Promise<InventoryForecastItem[]> {
  const features = await extractInventoryFeatures(tenantId)
  const today = startOfDay(new Date())
  const model = await ensureModel(tenantId)
  const expiresAt = addDays(today, 3)

  const predictions: InventoryForecastItem[] = features.map((f) => {
    const rate = Math.max(f.dailyConsumptionRate * f.seasonalityIndex, 0.01)
    const daysRemaining = f.currentStock / rate
    const stockOutDate = daysRemaining < 365
      ? dateKey(addDays(today, Math.ceil(daysRemaining)))
      : null

    const leadTime = Math.ceil(f.leadTimeVariability + 5)
    const reorderQuantity = wilsonEoq(rate, 50, 2, leadTime)
    const recommendedOrderDate = stockOutDate
      ? dateKey(addDays(new Date(stockOutDate), -leadTime))
      : null

    return {
      productId: f.productId,
      productName: f.productName,
      currentStock: f.currentStock,
      dailyConsumptionRate: Math.round(rate * 100) / 100,
      predictedStockOutDate: stockOutDate,
      reorderQuantity,
      recommendedOrderDate,
      urgencyLevel: urgencyLevel(stockOutDate ? Math.ceil(daysRemaining) : null),
    }
  })

  predictions.sort((a, b) => {
    const order = { critical: 0, warning: 1, normal: 2 }
    return order[a.urgencyLevel] - order[b.urgencyLevel]
  })

  for (const item of predictions) {
    await prisma.mLPrediction.create({
      data: {
        tenantId,
        modelId: model.id,
        predictionType: MLPredictionType.INVENTORY_STOCKOUT,
        entityId: item.productId,
        payload: item as never,
        confidence: item.urgencyLevel === 'critical' ? 0.9 : 0.75,
        expiresAt,
      },
    })
  }

  return predictions
}

export async function getLatestInventoryForecasts(tenantId: string): Promise<InventoryForecastItem[]> {
  const preds = await prisma.mLPrediction.findMany({
    where: { tenantId, predictionType: MLPredictionType.INVENTORY_STOCKOUT },
    orderBy: { computedAt: 'desc' },
    take: 200,
  })

  const seen = new Set<string>()
  const items: InventoryForecastItem[] = []
  for (const p of preds) {
    if (p.entityId && !seen.has(p.entityId)) {
      seen.add(p.entityId)
      items.push(p.payload as unknown as InventoryForecastItem)
    }
  }

  return items.sort((a, b) => {
    const order = { critical: 0, warning: 1, normal: 2 }
    return order[a.urgencyLevel] - order[b.urgencyLevel]
  })
}
