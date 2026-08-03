import { scheduleReorderJobs, startReorderWorker } from '@/lib/inventory/reorderScheduler'

async function main() {
  console.log('[reorderWorker] Starting inventory reorder worker...')
  await scheduleReorderJobs()
  const worker = startReorderWorker()
  if (!worker) {
    console.error('[reorderWorker] Failed to start — Redis unavailable')
    process.exit(1)
  }
  worker.on('completed', (job) => console.log(`[reorderWorker] Job ${job.id} completed`))
  worker.on('failed', (job, err) => console.error(`[reorderWorker] Job ${job?.id} failed`, err))
}

main().catch((err) => {
  console.error('[reorderWorker] Fatal error', err)
  process.exit(1)
})
