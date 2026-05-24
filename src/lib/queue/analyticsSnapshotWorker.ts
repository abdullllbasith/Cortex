/**
 * Standalone BullMQ worker for analytics snapshot pre-computation.
 * Run: npm run worker:analytics
 */
import { scheduleAnalyticsSnapshots, startAnalyticsSnapshotWorker } from '@/lib/analytics/snapshotScheduler'

async function main() {
  await scheduleAnalyticsSnapshots()
  const worker = startAnalyticsSnapshotWorker()

  if (worker) {
    console.log('[analyticsWorker] Started — processing snapshot jobs')
    process.on('SIGTERM', async () => {
      await worker.close()
      process.exit(0)
    })
  } else {
    console.log('[analyticsWorker] No Redis connection — exiting')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
