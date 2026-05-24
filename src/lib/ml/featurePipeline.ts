import { FeatureEntityType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import type { FeatureMatrix, FeatureRow } from './types'
import {
  buildOutlierBounds,
  capOutliers,
  imputeMissing,
} from './utils'
import {
  extractSalesFeatureRows,
  salesFeaturesToRow,
} from './featureEngineering/salesFeatures'
import {
  extractCustomerFeatures,
  customerFeaturesToRow,
} from './featureEngineering/customerFeatures'
import {
  extractInventoryFeatures,
  inventoryFeaturesToRow,
} from './featureEngineering/inventoryFeatures'
import {
  extractSupplierFeatures,
  supplierFeaturesToRow,
} from './featureEngineering/supplierFeatures'

export interface PipelineResult extends FeatureMatrix {
  snapshotsStored: number
}

async function persistSnapshot(
  tenantId: string,
  entityType: FeatureEntityType,
  entityId: string,
  features: Record<string, number | string | boolean | null>,
): Promise<void> {
  await prisma.featureSnapshot.upsert({
    where: {
      tenantId_entityType_entityId: { tenantId, entityType, entityId },
    },
    create: { tenantId, entityType, entityId, features: features as never },
    update: { features: features as never, computedAt: new Date() },
  })
}

export async function runFeaturePipeline(tenantId: string): Promise<PipelineResult> {
  const [sales, customers, inventory, suppliers] = await Promise.all([
    extractSalesFeatureRows(tenantId),
    extractCustomerFeatures(tenantId),
    extractInventoryFeatures(tenantId),
    extractSupplierFeatures(tenantId),
  ])

  const rawRows: FeatureRow[] = [
    { entityType: FeatureEntityType.SALES, entityId: sales.entityId, features: sales.features },
    ...customers.map((c) => ({
      entityType: FeatureEntityType.CUSTOMER,
      entityId: c.customerId,
      features: customerFeaturesToRow(c),
    })),
    ...inventory.map((p) => ({
      entityType: FeatureEntityType.INVENTORY,
      entityId: p.productId,
      features: inventoryFeaturesToRow(p),
    })),
    ...suppliers.map((s) => ({
      entityType: FeatureEntityType.SUPPLIER,
      entityId: s.supplierId,
      features: supplierFeaturesToRow(s),
    })),
  ]

  const numericRows = rawRows.map((r) => r.features)
  const imputed = imputeMissing(numericRows)
  const bounds = buildOutlierBounds(imputed)

  const normalizedRows: FeatureRow[] = rawRows.map((row, i) => ({
    ...row,
    features: capOutliers(imputed[i]!, bounds),
  }))

  let snapshotsStored = 0
  for (const row of normalizedRows) {
    await persistSnapshot(tenantId, row.entityType, row.entityId, row.features)
    snapshotsStored++
  }

  const featureNames = Array.from(
    new Set(normalizedRows.flatMap((r) => Object.keys(r.features))),
  )

  return {
    tenantId,
    computedAt: new Date().toISOString(),
    rows: normalizedRows,
    metadata: { rowCount: normalizedRows.length, featureNames },
    snapshotsStored,
  }
}

export async function getLatestSalesSeries(tenantId: string) {
  const result = await extractSalesFeatureRows(tenantId)
  return result.series
}

export { salesFeaturesToRow }
