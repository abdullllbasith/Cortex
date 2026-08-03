import { Queue, Worker } from 'bullmq'
import { getBullmqConnection } from '@/lib/cache/redis'
import { runFollowUpDueCheckAllTenants } from './followUpScheduler'

const QUEUE_NAME = 'saios-crm-follow-up'

function getConnection() {
  return getBullmqConnection()
}

export function getFollowUpQueue(): Queue | null {
  const conn = getConnection()
  if (!conn) return null
  return new Queue(QUEUE_NAME, { connection: conn })
}

/** Hourly check for overdue contact follow-ups → emits follow_up_due events */
export async function scheduleFollowUpJobs(): Promise<void> {
  const queue = getFollowUpQueue()
  if (!queue) {
    console.warn('[followUpScheduler] Redis unavailable — running inline follow-up check once')
    await runFollowUpDueCheckAllTenants()
    return
  }

  await queue.add(
    'hourly-follow-up-check',
    { scope: 'all' },
    {
      repeat: { pattern: '0 * * * *' },
      jobId: 'hourly-follow-up-check-all-tenants',
    },
  )
}

export function startFollowUpWorker(): Worker | null {
  const conn = getConnection()
  if (!conn) return null

  return new Worker<{ scope: string }>(
    QUEUE_NAME,
    async () => {
      await runFollowUpDueCheckAllTenants()
    },
    { connection: conn, concurrency: 1 },
  )
}
