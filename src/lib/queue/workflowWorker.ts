/**
 * BullMQ worker for workflow delay resume jobs.
 * Run: npm run worker:workflows
 */
import { startWorkflowWorker } from '@/lib/workflows/queue/workflowQueue'
import { triggerManager } from '@/lib/workflows/TriggerManager'
import '@/lib/workflows/nodes'

async function main() {
  await triggerManager.initialize()
  const worker = startWorkflowWorker()

  if (worker) {
    console.log('[workflowWorker] Started — delay resume + triggers loaded')
    process.on('SIGTERM', async () => {
      await worker.close()
      process.exit(0)
    })
  } else {
    console.log('[workflowWorker] No Redis — triggers initialized inline only')
    await triggerManager.initialize()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
