import { MLModelType, MLPredictionType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { completeStructuredJson, isPredictionLlmAvailable } from '../llmClient'
import { extractSupplierFeatures } from '../featureEngineering/supplierFeatures'
import type { SupplierRiskPrediction } from '../types'
import { addDays } from '../utils'

const SYSTEM_PROMPT = `You are a supply chain risk analyst predicting supplier delivery delays and cost increases.
Given supplier reliability features, return strict JSON:
{ "predictions": [{ "supplierId": string, "delayProbability": number (0-1), "expectedDelayDays": number, "priceIncreaseProbability": number (0-1), "overallRiskScore": number (0-100), "mitigationSuggestions": string[] }] }
Provide 2-3 mitigationSuggestions per supplier.`

function ruleBasedRisk(features: Awaited<ReturnType<typeof extractSupplierFeatures>>): SupplierRiskPrediction[] {
  return features.map((f) => {
    const delayProbability = Math.min(1, Math.max(0, 1 - f.onTimeDeliveryRate + f.delayCount * 0.05))
    const expectedDelayDays = f.avgDelayDays
    const priceIncreaseProbability = Math.min(1, f.costVarianceCoefficient * 0.8 + (f.delayCount > 2 ? 0.15 : 0))
    const overallRiskScore = Math.round(
      (delayProbability * 50 + priceIncreaseProbability * 30 + (1 - f.onTimeDeliveryRate) * 20) * 100,
    ) / 100

    const suggestions: string[] = []
    if (delayProbability > 0.5) suggestions.push('Identify backup supplier for critical SKUs')
    if (priceIncreaseProbability > 0.4) suggestions.push('Lock in pricing with annual contract')
    if (f.onTimeDeliveryRate < 0.9) suggestions.push('Increase safety stock buffer by 15%')
    if (!suggestions.length) suggestions.push('Continue monitoring delivery performance')

    return {
      supplierId: f.supplierId,
      supplierName: f.supplierName,
      delayProbability: Math.round(delayProbability * 1000) / 1000,
      expectedDelayDays: Math.round(expectedDelayDays * 10) / 10,
      priceIncreaseProbability: Math.round(priceIncreaseProbability * 1000) / 1000,
      overallRiskScore,
      mitigationSuggestions: suggestions,
    }
  })
}

async function ensureModel(tenantId: string) {
  const existing = await prisma.mLModel.findFirst({
    where: { tenantId, modelType: MLModelType.SUPPLIER_RISK, status: 'ACTIVE' },
  })
  if (existing) return existing
  return prisma.mLModel.create({
    data: { tenantId, modelType: MLModelType.SUPPLIER_RISK, version: '1.0.0' },
  })
}

export async function runSupplierRiskPredictor(tenantId: string): Promise<SupplierRiskPrediction[]> {
  const features = await extractSupplierFeatures(tenantId)
  const model = await ensureModel(tenantId)
  const expiresAt = addDays(new Date(), 7)

  let predictions = ruleBasedRisk(features)

  if (isPredictionLlmAvailable() && features.length > 0) {
    const compact = features.map((f) => ({
      id: f.supplierId,
      otd: f.onTimeDeliveryRate,
      delay: f.avgDelayDays,
      cv: f.costVarianceCoefficient,
      orders: f.orderCount,
    }))

    const llm = await completeStructuredJson<{
      predictions: Array<{
        supplierId: string
        delayProbability: number
        expectedDelayDays: number
        priceIncreaseProbability: number
        overallRiskScore: number
        mitigationSuggestions: string[]
      }>
    }>(SYSTEM_PROMPT, JSON.stringify({ suppliers: compact }), 4096)

    if (llm?.predictions?.length) {
      const byId = new Map(llm.predictions.map((p) => [p.supplierId, p]))
      predictions = predictions.map((p) => {
        const llmP = byId.get(p.supplierId)
        if (!llmP) return p
        return {
          ...p,
          delayProbability: llmP.delayProbability,
          expectedDelayDays: llmP.expectedDelayDays,
          priceIncreaseProbability: llmP.priceIncreaseProbability,
          overallRiskScore: llmP.overallRiskScore,
          mitigationSuggestions: llmP.mitigationSuggestions.length
            ? llmP.mitigationSuggestions
            : p.mitigationSuggestions,
        }
      })
    }
  }

  for (const p of predictions) {
    await prisma.mLPrediction.create({
      data: {
        tenantId,
        modelId: model.id,
        predictionType: MLPredictionType.SUPPLIER_RISK,
        entityId: p.supplierId,
        payload: p as never,
        confidence: 1 - p.delayProbability * 0.5,
        expiresAt,
      },
    })
  }

  return predictions.sort((a, b) => b.overallRiskScore - a.overallRiskScore)
}

export async function getLatestSupplierRiskPredictions(tenantId: string): Promise<SupplierRiskPrediction[]> {
  const preds = await prisma.mLPrediction.findMany({
    where: { tenantId, predictionType: MLPredictionType.SUPPLIER_RISK },
    orderBy: { computedAt: 'desc' },
    take: 100,
  })

  const seen = new Set<string>()
  const items: SupplierRiskPrediction[] = []
  for (const p of preds) {
    if (p.entityId && !seen.has(p.entityId)) {
      seen.add(p.entityId)
      items.push(p.payload as unknown as SupplierRiskPrediction)
    }
  }
  return items.sort((a, b) => b.overallRiskScore - a.overallRiskScore)
}
