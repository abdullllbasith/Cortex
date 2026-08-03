import { MLModelType, MLPredictionType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { completeStructuredJson, isPredictionLlmAvailable } from '../llmClient'
import { extractCustomerFeatures } from '../featureEngineering/customerFeatures'
import type { CustomerChurnPrediction } from '../types'
import { addDays } from '../utils'

const BATCH_SIZE = 500

const SYSTEM_PROMPT = `You are a customer churn prediction specialist using RFM analysis.
Given customer feature vectors, predict churn risk for each customer.
Return strict JSON: { "predictions": [{ "customerId": string, "churnProbability": number (0-1), "churnRisk": "high"|"medium"|"low", "daysToChurn": number|null, "retentionActions": string[] }] }
High risk: churnProbability >= 0.7. Medium: 0.4-0.69. Low: < 0.4.
Provide 2-3 actionable retentionActions per high/medium risk customer.`

function ruleBasedChurn(features: Awaited<ReturnType<typeof extractCustomerFeatures>>): CustomerChurnPrediction[] {
  return features.map((f) => {
    const churnProbability = Math.min(1, Math.max(0, f.churnIndicator))
    const churnRisk = churnProbability >= 0.7 ? 'high' : churnProbability >= 0.4 ? 'medium' : 'low'
    const daysToChurn = churnRisk === 'high'
      ? Math.max(7, Math.round(f.recencyDays * 0.5))
      : churnRisk === 'medium'
        ? Math.round(f.recencyDays * 1.2)
        : null

    const actions: string[] = []
    if (churnRisk !== 'low') {
      if (f.frequencyDrop > 0.3) actions.push('Send win-back offer with 15% discount')
      if (f.complaintCount > 0) actions.push('Assign account manager for service recovery call')
      if (f.recencyDays > 60) actions.push('Schedule re-engagement email campaign')
      if (!actions.length) actions.push('Send personalized retention offer')
    }

    return {
      customerId: f.customerId,
      customerName: f.customerName,
      churnProbability: Math.round(churnProbability * 1000) / 1000,
      churnRisk,
      daysToChurn,
      ltvAtRisk: Math.round(f.monetary90d * (churnProbability || 0.5)),
      monetary90d: f.monetary90d,
      retentionActions: actions,
    }
  })
}

async function ensureModel(tenantId: string) {
  const existing = await prisma.mLModel.findFirst({
    where: { tenantId, modelType: MLModelType.CUSTOMER_CHURN, status: 'ACTIVE' },
  })
  if (existing) return existing
  return prisma.mLModel.create({
    data: { tenantId, modelType: MLModelType.CUSTOMER_CHURN, version: '1.0.0' },
  })
}

export async function runCustomerChurnPredictor(tenantId: string): Promise<CustomerChurnPrediction[]> {
  const features = await extractCustomerFeatures(tenantId)
  const model = await ensureModel(tenantId)
  const expiresAt = addDays(new Date(), 7)

  let predictions: CustomerChurnPrediction[] = ruleBasedChurn(features)

  if (isPredictionLlmAvailable() && features.length > 0) {
    for (let i = 0; i < features.length; i += BATCH_SIZE) {
      const batch = features.slice(i, i + BATCH_SIZE)
      const compact = batch.map((f) => ({
        id: f.customerId,
        r: f.recencyDays,
        f: f.frequency90d,
        m: f.monetary90d,
        g: f.gapRatio,
        fd: f.frequencyDrop,
        c: f.complaintCount,
      }))

      const llm = await completeStructuredJson<{
        predictions: Array<{
          customerId: string
          churnProbability: number
          churnRisk: 'high' | 'medium' | 'low'
          daysToChurn: number | null
          retentionActions: string[]
        }>
      }>(SYSTEM_PROMPT, JSON.stringify({ customers: compact }), 4096)

      if (llm?.predictions?.length) {
        const byId = new Map(llm.predictions.map((p) => [p.customerId, p]))
        predictions = predictions.map((p) => {
          const llmP = byId.get(p.customerId)
          if (!llmP) return p
          return {
            ...p,
            churnProbability: llmP.churnProbability,
            churnRisk: llmP.churnRisk,
            daysToChurn: llmP.daysToChurn,
            ltvAtRisk: Math.round(p.ltvAtRisk * llmP.churnProbability / (p.churnProbability || 1)),
            retentionActions: llmP.retentionActions.length ? llmP.retentionActions : p.retentionActions,
          }
        })
      }
    }
  }

  for (const p of predictions) {
    await prisma.mLPrediction.create({
      data: {
        tenantId,
        modelId: model.id,
        predictionType: MLPredictionType.CUSTOMER_CHURN,
        entityId: p.customerId,
        payload: p as never,
        confidence: 1 - p.churnProbability,
        expiresAt,
      },
    })
  }

  return predictions.sort((a, b) => b.churnProbability - a.churnProbability)
}

export async function getLatestChurnPredictions(
  tenantId: string,
  risk?: 'high' | 'medium' | 'low',
): Promise<CustomerChurnPrediction[]> {
  const preds = await prisma.mLPrediction.findMany({
    where: { tenantId, predictionType: MLPredictionType.CUSTOMER_CHURN },
    orderBy: { computedAt: 'desc' },
    take: 500,
  })

  const seen = new Set<string>()
  let items: CustomerChurnPrediction[] = []
  for (const p of preds) {
    if (p.entityId && !seen.has(p.entityId)) {
      seen.add(p.entityId)
      items.push(p.payload as unknown as CustomerChurnPrediction)
    }
  }

  if (risk) items = items.filter((i) => i.churnRisk === risk)
  return items.sort((a, b) => b.churnProbability - a.churnProbability)
}
