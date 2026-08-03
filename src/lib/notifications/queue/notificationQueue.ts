import { Queue, Worker } from 'bullmq'
import { getBullmqConnection } from '@/lib/cache/redis'
import type { NotificationPayload } from '../types'

const QUEUE_NAME = 'saios-notifications'

let notificationQueue: Queue | null = null

function getQueue(): Queue | null {
  const conn = getBullmqConnection()
  if (!conn) return null
  if (!notificationQueue) {
    notificationQueue = new Queue(QUEUE_NAME, { connection: conn })
  }
  return notificationQueue
}

export async function enqueueNotification(
  payload: NotificationPayload,
  opts?: { delayMs?: number },
): Promise<void> {
  const queue = getQueue()
  if (queue) {
    await queue.add('send', payload, {
      delay: opts?.delayMs,
      removeOnComplete: 100,
      removeOnFail: 50,
    })
    return
  }
  if (opts?.delayMs) {
    setTimeout(() => {
      void import('../notificationService').then(({ notificationService }) =>
        notificationService.send(payload),
      )
    }, opts.delayMs)
    return
  }
  const { notificationService } = await import('../notificationService')
  await notificationService.send(payload)
}

export async function enqueueBulk(
  tenantId: string,
  notifications: NotificationPayload[],
): Promise<void> {
  const queue = getQueue()
  if (queue) {
    await queue.addBulk(
      notifications.map((payload, i) => ({
        name: 'send',
        data: payload,
        opts: { jobId: `bulk-${tenantId}-${Date.now()}-${i}` },
      })),
    )
    return
  }
  for (const payload of notifications) {
    const { notificationService } = await import('../notificationService')
    await notificationService.send(payload)
  }
}

export function startNotificationWorker(): Worker | null {
  const conn = getBullmqConnection()
  if (!conn) return null

  return new Worker<NotificationPayload>(
    QUEUE_NAME,
    async (job) => {
      const { notificationService } = await import('../notificationService')
      await notificationService.send(job.data)
    },
    { connection: conn, concurrency: 5 },
  )
}
