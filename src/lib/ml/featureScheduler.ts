import { Queue, Worker } from 'bullmq'
import { prisma } from '@/lib/db/prisma'
import { getBullmqConnection } from '@/lib/cache/redis'
import { runFeaturePipeline } from './featurePipeline'
import { runPredictionOrchestrator } from './predictionOrchestrator'

const QUEUE_NAME = 'saios-ml-features'

let featureQueue: Queue | null = null

function getConnection() {
  return getBullmqConnection()
}

export function getFeatureQueue(): Queue | null {
  const conn = getConnection()
  if (!conn) return null
  if (!featureQueue) featureQueue = new Queue(QUEUE_NAME, { connection: conn })
  return featureQueue
}

async function runFeatureJobForTenant(tenantId: string): Promise<void> {
  console.log(`[featureScheduler] Computing features for tenant ${tenantId}`)
  await runFeaturePipeline(tenantId)
  await runPredictionOrchestrator(tenantId)
}

async function runFeatureJobForAllTenants(): Promise<void> {
  const tenants = await prisma.tenant.findMany({ select: { id: true } })
  for (const tenant of tenants) {
    await runFeatureJobForTenant(tenant.id)
  }
}

/** Schedule nightly feature recomputation at 02:00 UTC per tenant */
export async function scheduleFeatureJobs(): Promise<void> {
  const queue = getFeatureQueue()
  if (!queue) {
    console.warn('[featureScheduler] Redis unavailable — running inline feature job once')
    await runFeatureJobForAllTenants()
    return
  }

  await queue.add(
    'nightly-features',
    { scope: 'all' },
    {
      repeat: { pattern: '0 2 * * *' },
      jobId: 'nightly-features-all-tenants',
    },
  )
}

export function startFeatureWorker(): Worker | null {
  const conn = getConnection()
  if (!conn) return null

  return new Worker<{ scope: string; tenantId?: string }>(
    QUEUE_NAME,
    async (job) => {
      if (job.data.tenantId) {
        await runFeatureJobForTenant(job.data.tenantId)
      } else {
        await runFeatureJobForAllTenants()
      }
    },
    { connection: conn, concurrency: 1 },
  )
}

export async function triggerFeaturePipelineNow(tenantId?: string): Promise<void> {
  if (tenantId) {
    await runFeatureJobForTenant(tenantId)
    return
  }
  await runFeatureJobForAllTenants()
}
