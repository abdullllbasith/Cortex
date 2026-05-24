import { Queue, Worker } from 'bullmq'
import { prisma } from '@/lib/db/prisma'
import { getBullmqConnection } from '@/lib/cache/redis'
import { AnalyticsSnapshotType } from '@prisma/client'
import {
  computeSalesMetrics,
  computeCustomerMetrics,
  computeInventoryMetrics,
  computeSupplierMetrics,
} from './aggregationPipeline'
import { resolveDateRange, periodKey } from './periodUtils'

const QUEUE_NAME = 'saios-analytics-snapshots'

let snapshotQueue: Queue | null = null

function getConnection() {
  return getBullmqConnection()
}

export function getAnalyticsSnapshotQueue(): Queue | null {
  const conn = getConnection()
  if (!conn) return null
  if (!snapshotQueue) snapshotQueue = new Queue(QUEUE_NAME, { connection: conn })
  return snapshotQueue
}

async function getLastEventTimestamp(tenantId: string): Promise<Date | null> {
  const latest = await prisma.salesEvent.findFirst({
    where: { tenantId },
    orderBy: { timestamp: 'desc' },
    select: { timestamp: true },
  })
  return latest?.timestamp ?? null
}

async function shouldRecompute(
  tenantId: string,
  type: AnalyticsSnapshotType,
  period: string,
  lastEventAt: Date | null,
): Promise<boolean> {
  const existing = await prisma.analyticsSnapshot.findUnique({
    where: { tenantId_snapshotType_period: { tenantId, snapshotType: type, period } },
  })
  if (!existing) return true
  if (lastEventAt && existing.lastEventAt && lastEventAt > existing.lastEventAt) return true
  return false
}

async function computeSnapshotForTenant(
  tenantId: string,
  snapshotType: AnalyticsSnapshotType,
): Promise<void> {
  const range = resolveDateRange(
    snapshotType.includes('WEEKLY') ? 'week' : snapshotType.includes('HOURLY') ? 'today' : 'month',
  )
  const period = periodKey(range)
  const lastEventAt = await getLastEventTimestamp(tenantId)

  if (!(await shouldRecompute(tenantId, snapshotType, period, lastEventAt))) return

  let data: unknown

  switch (snapshotType) {
    case 'SALES_HOURLY':
    case 'SALES_DAILY':
    case 'SALES_WEEKLY':
      data = await computeSalesMetrics(tenantId, range)
      break
    case 'CUSTOMER_DAILY':
      data = await computeCustomerMetrics(tenantId, range)
      break
    case 'INVENTORY_HOURLY':
      data = await computeInventoryMetrics(tenantId)
      break
    case 'SUPPLIER_DAILY':
      data = await computeSupplierMetrics(tenantId, range)
      break
    case 'EXECUTIVE_DAILY':
      data = {
        sales: await computeSalesMetrics(tenantId, range),
        customers: await computeCustomerMetrics(tenantId, range),
        inventory: await computeInventoryMetrics(tenantId),
        suppliers: await computeSupplierMetrics(tenantId, range),
      }
      break
  }

  await prisma.analyticsSnapshot.upsert({
    where: { tenantId_snapshotType_period: { tenantId, snapshotType, period } },
    create: { tenantId, snapshotType, period, data: data as never, lastEventAt },
    update: { data: data as never, computedAt: new Date(), lastEventAt },
  })
}

async function runSnapshotJob(type: AnalyticsSnapshotType): Promise<void> {
  const tenants = await prisma.tenant.findMany({ select: { id: true } })
  for (const tenant of tenants) {
    await computeSnapshotForTenant(tenant.id, type)
  }
}

export async function scheduleAnalyticsSnapshots(): Promise<void> {
  const queue = getAnalyticsSnapshotQueue()
  if (!queue) {
    console.warn('[snapshotScheduler] Redis unavailable — running inline snapshot once')
    await runSnapshotJob('SALES_DAILY')
    return
  }

  await queue.add('hourly', { type: 'SALES_HOURLY' }, { repeat: { pattern: '0 * * * *' } })
  await queue.add('hourly-inventory', { type: 'INVENTORY_HOURLY' }, { repeat: { pattern: '15 * * * *' } })
  await queue.add('daily', { type: 'SALES_DAILY' }, { repeat: { pattern: '0 1 * * *' } })
  await queue.add('daily-customer', { type: 'CUSTOMER_DAILY' }, { repeat: { pattern: '30 1 * * *' } })
  await queue.add('daily-supplier', { type: 'SUPPLIER_DAILY' }, { repeat: { pattern: '0 2 * * *' } })
  await queue.add('daily-executive', { type: 'EXECUTIVE_DAILY' }, { repeat: { pattern: '30 2 * * *' } })
  await queue.add('weekly', { type: 'SALES_WEEKLY' }, { repeat: { pattern: '0 3 * * 1' } })
}

export function startAnalyticsSnapshotWorker(): Worker | null {
  const conn = getConnection()
  if (!conn) return null

  return new Worker<{ type: AnalyticsSnapshotType }>(
    QUEUE_NAME,
    async (job) => {
      await runSnapshotJob(job.data.type)
    },
    { connection: conn, concurrency: 2 },
  )
}

export async function triggerSnapshotNow(type: AnalyticsSnapshotType = 'SALES_DAILY'): Promise<void> {
  await runSnapshotJob(type)
}
