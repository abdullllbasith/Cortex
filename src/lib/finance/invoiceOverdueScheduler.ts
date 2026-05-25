import { Queue, Worker } from 'bullmq'
import { prisma } from '@/lib/db/prisma'
import { getBullmqConnection } from '@/lib/cache/redis'
import type { TenantSettings } from '@/lib/settings/types'
import { checkAndMarkOverdue } from './invoiceService'

const QUEUE_NAME = 'saios-finance-invoice-overdue'

let overdueQueue: Queue | null = null

function getConnection() {
  return getBullmqConnection()
}

export function getInvoiceOverdueQueue(): Queue | null {
  const conn = getConnection()
  if (!conn) return null
  if (!overdueQueue) overdueQueue = new Queue(QUEUE_NAME, { connection: conn })
  return overdueQueue
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

async function runOverdueJobForEligibleTenants(): Promise<void> {
  const tenants = await prisma.tenant.findMany({ select: { id: true, settings: true } })
  const now = new Date()

  for (const tenant of tenants) {
    const settings = (tenant.settings ?? {}) as TenantSettings
    const timezone = settings.timezone ?? 'UTC'
    if (getLocalHour(now, timezone) === 8) {
      console.log(
        `[invoiceOverdueScheduler] Running 08:00 overdue check for tenant ${tenant.id} (${timezone})`,
      )
      await checkAndMarkOverdue(tenant.id)
    }
  }
}

/** Hourly tick — marks overdue invoices for tenants where local time is 08:00 */
export async function scheduleInvoiceOverdueJobs(): Promise<void> {
  const queue = getInvoiceOverdueQueue()
  if (!queue) {
    console.warn('[invoiceOverdueScheduler] Redis unavailable — running inline overdue check once')
    await runOverdueJobForEligibleTenants()
    return
  }

  await queue.add(
    'hourly-invoice-overdue-check',
    { scope: 'all' },
    {
      repeat: { pattern: '0 * * * *' },
      jobId: 'hourly-invoice-overdue-check-all-tenants',
    },
  )
}

export function startInvoiceOverdueWorker(): Worker | null {
  const conn = getConnection()
  if (!conn) return null

  return new Worker<{ scope: string; tenantId?: string }>(
    QUEUE_NAME,
    async (job) => {
      if (job.data.tenantId) {
        await checkAndMarkOverdue(job.data.tenantId)
      } else {
        await runOverdueJobForEligibleTenants()
      }
    },
    { connection: conn, concurrency: 1 },
  )
}

export async function triggerInvoiceOverdueCheckNow(tenantId?: string): Promise<void> {
  if (tenantId) {
    await checkAndMarkOverdue(tenantId)
    return
  }
  await runOverdueJobForEligibleTenants()
}
