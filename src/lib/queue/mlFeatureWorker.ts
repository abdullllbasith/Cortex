/**
 * Standalone BullMQ worker for ML feature pipeline + predictions.
 * Run: npm run worker:ml
 */
import { scheduleFeatureJobs, startFeatureWorker } from '@/lib/ml/featureScheduler'

async function main() {
  await scheduleFeatureJobs()
  const worker = startFeatureWorker()

  if (worker) {
    console.log('[mlWorker] Started — nightly features at 02:00 UTC')
    process.on('SIGTERM', async () => {
      await worker.close()
      process.exit(0)
    })
  } else {
    console.log('[mlWorker] No Redis connection — exiting')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
