import { MLPredictionType } from '@prisma/client'
import { runSalesForecaster } from './models/salesForecaster'
import { runInventoryForecaster } from './models/inventoryForecaster'
import { runCustomerChurnPredictor } from './models/customerChurnPredictor'
import { runSupplierRiskPredictor } from './models/supplierRiskPredictor'
import { evaluatePredictionsAndAlert } from './alertEngine'
import type { PredictionRunSummary } from './types'

export async function runPredictionOrchestrator(tenantId: string): Promise<PredictionRunSummary> {
  console.log(`[predictionOrchestrator] Running models for tenant ${tenantId}`)

  const [sales, inventory, customers, suppliers] = await Promise.all([
    runSalesForecaster(tenantId),
    runInventoryForecaster(tenantId),
    runCustomerChurnPredictor(tenantId),
    runSupplierRiskPredictor(tenantId),
  ])

  const summary: PredictionRunSummary = {
    tenantId,
    predictionTypes: [
      MLPredictionType.SALES_FORECAST,
      MLPredictionType.INVENTORY_STOCKOUT,
      MLPredictionType.CUSTOMER_CHURN,
      MLPredictionType.SUPPLIER_RISK,
    ],
    counts: {
      sales: sales.dailyForecast.length,
      inventory: inventory.length,
      customers: customers.length,
      suppliers: suppliers.length,
    },
    computedAt: new Date().toISOString(),
  }

  await evaluatePredictionsAndAlert(tenantId, {
    sales,
    inventory,
    customers,
    suppliers,
  })

  return summary
}

export async function refreshPredictionsForTenant(tenantId: string): Promise<PredictionRunSummary> {
  const { runFeaturePipeline } = await import('./featurePipeline')
  await runFeaturePipeline(tenantId)
  return runPredictionOrchestrator(tenantId)
}
