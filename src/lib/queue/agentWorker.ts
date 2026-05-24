/**
 * Standalone BullMQ worker for agent task processing.
 * Run: npx tsx src/lib/queue/agentWorker.ts
 */
import { startAgentWorker } from './agentQueue'

const worker = startAgentWorker()

if (worker) {
  console.log('[agentWorker] Started — listening for agent tasks')
  process.on('SIGTERM', async () => {
    await worker.close()
    process.exit(0)
  })
} else {
  console.log('[agentWorker] No Redis connection — exiting')
  process.exit(1)
}
