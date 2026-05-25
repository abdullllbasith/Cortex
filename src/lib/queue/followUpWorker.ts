import { scheduleFollowUpJobs, startFollowUpWorker } from '@/lib/crm/followUpQueue'

async function main() {
  console.log('[followUpWorker] Starting CRM follow-up worker...')
  await scheduleFollowUpJobs()
  const worker = startFollowUpWorker()
  if (!worker) {
    console.error('[followUpWorker] Failed to start — Redis unavailable')
    process.exit(1)
  }
  worker.on('completed', (job) => console.log(`[followUpWorker] Job ${job.id} completed`))
  worker.on('failed', (job, err) => console.error(`[followUpWorker] Job ${job?.id} failed`, err))
}

main().catch((err) => {
  console.error('[followUpWorker] Fatal error', err)
  process.exit(1)
})
