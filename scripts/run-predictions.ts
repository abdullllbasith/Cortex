/**
 * One-shot: compute features + predictions for all tenants (dev/CI).
 * Run: npx tsx scripts/run-predictions.ts
 */
import { prisma } from '../src/lib/db/prisma'
import { refreshPredictionsForTenant } from '../src/lib/ml/predictionOrchestrator'

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } })
  for (const t of tenants) {
    console.log(`Running predictions for ${t.slug}…`)
    const summary = await refreshPredictionsForTenant(t.id)
    console.log(JSON.stringify(summary, null, 2))
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
