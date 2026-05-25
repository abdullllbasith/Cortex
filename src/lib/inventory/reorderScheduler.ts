import { Queue, Worker } from 'bullmq'
import { prisma } from '@/lib/db/prisma'
import { getBullmqConnection } from '@/lib/cache/redis'
import type { TenantSettings } from '@/lib/settings/types'
import { runScheduledReorderCheck } from './reorderService'

const QUEUE_NAME = 'saios-inventory-reorder'

let reorderQueue: Queue | null = null

function getConnection() {
  return getBullmqConnection()
}

export function getReorderQueue(): Queue | null {
  const conn = getConnection()
  if (!conn) return null
  if (!reorderQueue) reorderQueue = new Queue(QUEUE_NAME, { connection: conn })
  return reorderQueue
}

function getLocalHour(date: Date, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(date)
    return Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  } catch {
    return date.getUTCHours()
  }
}

async function runReorderJobForEligibleTenants(): Promise<void> {
  const tenants = await prisma.tenant.findMany({ select: { id: true, settings: true } })
  const now = new Date()

  for (const tenant of tenants) {
    const settings = (tenant.settings ?? {}) as TenantSettings
    const timezone = settings.timezone ?? 'UTC'
    if (getLocalHour(now, timezone) === 7) {
      console.log(`[reorderScheduler] Running 07:00 reorder check for tenant ${tenant.id} (${timezone})`)
      await runScheduledReorderCheck(tenant.id)
    }
  }
}

/** Hourly tick — runs reorder check for tenants where local time is 07:00 */
export async function scheduleReorderJobs(): Promise<void> {
  const queue = getReorderQueue()
  if (!queue) {
    console.warn('[reorderScheduler] Redis unavailable — running inline reorder check once')
    await runReorderJobForEligibleTenants()
    return
  }

  await queue.add(
    'hourly-reorder-check',
    { scope: 'all' },
    {
      repeat: { pattern: '0 * * * *' },
      jobId: 'hourly-reorder-check-all-tenants',
    },
  )
}

export function startReorderWorker(): Worker | null {
  const conn = getConnection()
  if (!conn) return null

  return new Worker<{ scope: string; tenantId?: string }>(
    QUEUE_NAME,
    async (job) => {
      if (job.data.tenantId) {
        await runScheduledReorderCheck(job.data.tenantId)
      } else {
        await runReorderJobForEligibleTenants()
      }
    },
    { connection: conn, concurrency: 1 },
  )
}

export async function triggerReorderCheckNow(tenantId?: string): Promise<void> {
  if (tenantId) {
    await runScheduledReorderCheck(tenantId)
    return
  }
  await runReorderJobForEligibleTenants()
}
